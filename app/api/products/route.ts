import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { puedeGestionarProductos } from "@/lib/perms";
import { hasDeviceToken } from "@/lib/pairing";
import { plainAttrs } from "@/lib/products";
import {
  negocioBase,
  resolvePhotoRefs,
  withPhotoRefs,
} from "@/lib/productsStore";

export const runtime = "nodejs";

// Toda ruta de la API resuelve a qué negocio pertenece la request (lee headers
// en `handler()`), así que nunca se puede renderizar estáticamente.
export const dynamic = "force-dynamic";

// GET /api/products?category=&q=&status=
export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category");
  const q = sp.get("q")?.trim();
  const status = sp.get("status");
  const barcode = sp.get("barcode")?.trim();
  const empleado = getSession("employee");

  const where: string[] = [];
  const params: unknown[] = [];
  if (barcode) {
    params.push(barcode);
    where.push(`barcode = $${params.length}`);
  }
  if (category && category !== "Todos") {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  // El público (sin sesión) solo ve productos ACTIVOS (no discontinuados); el
  // empleado puede filtrar por estado o ver todos.
  if (!empleado) {
    params.push("activo");
    where.push(`status = $${params.length}::product_status`);
  } else if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (q) {
    // Cada palabra debe aparecer en algún dato del producto (incluidos los
    // atributos del rubro: marca, modelo y año de compatibilidad para repuestos).
    // Así "toyota corolla 2015" encuentra los repuestos compatibles.
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
    for (const t of terms) {
      params.push(`%${t}%`);
      const i = params.length;
      where.push(
        `(id ILIKE $${i} OR name ILIKE $${i} OR category ILIKE $${i} OR description ILIKE $${i} OR barcode ILIKE $${i} OR attributes::text ILIKE $${i})`
      );
    }
  }

  // Paginación opcional para catálogos grandes (miles de productos): la app
  // pide de a `limit` y va cargando más al hacer scroll. Sin `limit` en la
  // query se devuelve todo (compatibilidad con el CRM web).
  const hasLimit = sp.has("limit");
  let pageClause = "";
  if (hasLimit) {
    const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 50));
    const offset = Math.max(0, Number(sp.get("offset")) || 0);
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    pageClause = ` LIMIT $${limitIdx} OFFSET $${params.length}`;
  }

  const rows = await query(
    `SELECT id, name, description AS desc, price, cost, barcode, image, images, attributes, category,
            featured, stock, status
       FROM products
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC${pageClause}`,
    params
  );
  // El costo de compra es dato interno: solo viaja si hay sesión de empleado.
  // Un GET público (catálogo de la tienda) recibe todo menos `cost`, para no
  // filtrar el margen del negocio.
  //
  // Y las fotos van como enlace (`/api/products/<sku>/image/<n>`) en vez de
  // embebidas: el catálogo de un negocio con fotos pesa megabytes, y así el
  // navegador las pide aparte y las cachea. El CRM sí recibe el dato crudo,
  // que es lo que edita y vuelve a guardar.
  if (empleado) return ok(rows);

  const sinCosto = (rows as Array<Record<string, unknown>>).map(
    ({ cost: _cost, ...r }) => r
  );

  // Los enlaces solo valen para la web, que los resuelve contra este mismo
  // origen. Un cliente PAREADO (app móvil, programa de PC) pinta la foto desde
  // su propia ventana, así que a él se le manda la imagen tal cual está.
  if (hasDeviceToken()) return ok(sinCosto);

  const base = negocioBase();
  return ok(
    sinCosto.map((r) => withPhotoRefs(r as Parameters<typeof withPhotoRefs>[0], base))
  );
});

// POST /api/products  (solo empleados CON permiso de catálogo)
export const POST = handler(async (req: NextRequest) => {
  const s = getSession("employee");
  if (!s) return unauthorized();
  if (!(await puedeGestionarProductos(s)))
    return bad("Tu cuenta no tiene permiso para registrar productos. Pedíselo al administrador.", 403);
  const b = await req.json();
  // String() y no .trim() directo: un body con `{"id": 123}` no debe tirar 500.
  const id = String(b.id ?? "").trim();
  if (!id) return bad("El SKU es obligatorio.");
  if (!String(b.name ?? "").trim()) return bad("El nombre es obligatorio.");

  const dup = await queryOne(`SELECT 1 FROM products WHERE lower(id)=lower($1)`, [id]);
  if (dup) return bad("Ya existe un producto con ese SKU.");

  // El código de barras es único: si ya está tomado, el alta se rechaza con un
  // mensaje que dice CUÁL es el producto, para que el usuario no cree duplicados.
  const barcode = String(b.barcode ?? "").trim();
  if (barcode) {
    const taken = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM products WHERE barcode = $1`,
      [barcode]
    );
    if (taken) {
      return bad(
        `El código de barras ${barcode} ya es del producto ${taken.id} · ${taken.name}.`
      );
    }
  }

  // Imágenes: se acepta `images` (arreglo de URLs) y/o `image` (una sola, por
  // compatibilidad). La principal es la primera del arreglo.
  const images: string[] = Array.isArray(b.images)
    ? b.images.filter((u: unknown) => typeof u === "string" && u.trim() !== "")
    : [];
  const single = (b.image ?? "").trim();
  if (single && !images.includes(single)) images.unshift(single);
  // Una foto que llega como enlace (`/api/products/…/image/0`) se cambia por la
  // imagen real: si no, se guardaría el enlace y la foto se perdería.
  const fotos = await resolvePhotoRefs(images);
  const primary = fotos[0] ?? "";

  // Atributos del rubro (marca, compatibilidad…): JSON libre. Se filtran a un
  // objeto plano de strings para no guardar basura.
  const attributes = plainAttrs(b.attributes);

  const row = await queryOne(
    // El cast a product_status es necesario: sin él, un status nulo llega como
    // text y Postgres rechaza el INSERT (la columna es un enum).
    `INSERT INTO products (id, name, description, price, cost, barcode, image, images,
                           attributes, category, featured, stock, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13::product_status,'activo'))
     RETURNING id, name, description AS desc, price, cost, barcode, image, images, attributes, category,
               featured, stock, status`,
    [
      id,
      String(b.name).trim(),
      b.desc ?? b.description ?? "",
      Math.round(Number(b.price) || 0),
      Math.round(Number(b.cost) || 0),
      barcode,
      primary,
      fotos,
      JSON.stringify(attributes),
      b.category ?? "General",
      !!b.featured,
      Math.round(Number(b.stock) || 0),
      b.status ?? null,
    ]
  );
  return ok(row, { status: 201 });
});
