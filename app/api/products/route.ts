import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

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
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(
      `(id ILIKE $${params.length} OR name ILIKE $${params.length} OR category ILIKE $${params.length} OR description ILIKE $${params.length})`
    );
  }
  const rows = await query(
    `SELECT id, name, description AS desc, price, cost, barcode, image, category,
            featured, stock, status
       FROM products
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC`,
    params
  );
  return ok(rows);
});

// POST /api/products  (solo empleados)
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const b = await req.json();
  const id = (b.id ?? "").trim();
  if (!id) return bad("El SKU es obligatorio.");
  if (!b.name?.trim()) return bad("El nombre es obligatorio.");

  const dup = await queryOne(`SELECT 1 FROM products WHERE lower(id)=lower($1)`, [id]);
  if (dup) return bad("Ya existe un producto con ese SKU.");

  // El código de barras es único: si ya está tomado, el alta se rechaza con un
  // mensaje que dice CUÁL es el producto, para que el usuario no cree duplicados.
  const barcode = (b.barcode ?? "").trim();
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

  const row = await queryOne(
    // El cast a product_status es necesario: sin él, un status nulo llega como
    // text y Postgres rechaza el INSERT (la columna es un enum).
    `INSERT INTO products (id, name, description, price, cost, barcode, image,
                           category, featured, stock, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::product_status,'activo'))
     RETURNING id, name, description AS desc, price, cost, barcode, image, category,
               featured, stock, status`,
    [
      id,
      b.name.trim(),
      b.desc ?? b.description ?? "",
      Math.round(Number(b.price) || 0),
      Math.round(Number(b.cost) || 0),
      barcode,
      b.image ?? "",
      b.category ?? "General",
      !!b.featured,
      Math.round(Number(b.stock) || 0),
      b.status ?? null,
    ]
  );
  return ok(row, { status: 201 });
});
