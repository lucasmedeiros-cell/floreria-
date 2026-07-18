import { NextRequest } from "next/server";
import { plainAttrs } from "@/lib/products";
import { queryOne } from "@/lib/db";
import { bad, handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// Toda ruta de la API resuelve a qué negocio pertenece la request (lee headers
// en `handler()`), así que nunca se puede renderizar estáticamente.
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const row = await queryOne(
    `SELECT id, name, description AS desc, price, cost, barcode, image, images, attributes, category,
            featured, stock, status
       FROM products WHERE id = $1`,
    [params.id]
  );
  return row ? ok(row) : notFound("Producto no encontrado");
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  if (!getSession("employee")) return unauthorized();
  const b = await req.json();

  const nextId = (b.id ?? params.id).trim();
  if (nextId.toLowerCase() !== params.id.toLowerCase()) {
    const dup = await queryOne(`SELECT 1 FROM products WHERE lower(id)=lower($1)`, [
      nextId,
    ]);
    if (dup) return bad("Ya existe un producto con ese SKU.");
  }

  // Código de barras: único. Si el que llega ya es de otro producto, se avisa
  // en vez de romper con el error del índice.
  const barcode = b.barcode != null ? String(b.barcode).trim() : null;
  if (barcode) {
    const taken = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM products WHERE barcode = $1 AND id <> $2`,
      [barcode, params.id]
    );
    if (taken) {
      return bad(
        `El código de barras ${barcode} ya es del producto ${taken.id} · ${taken.name}.`
      );
    }
  }

  // Imágenes: si llega `images` (arreglo), reemplaza todas y `image` pasa a ser
  // la primera. Si no llega, ambas quedan igual (COALESCE con null).
  let images: string[] | null = null;
  let primary: string | null = b.image ?? null;
  if (Array.isArray(b.images)) {
    const filtered = b.images.filter(
      (u: unknown): u is string => typeof u === "string" && u.trim() !== ""
    );
    images = filtered;
    primary = filtered[0] ?? "";
  }

  // Atributos del rubro: si llegan, reemplazan el JSON; si no, queda igual.
  const attributes =
    b.attributes != null ? JSON.stringify(plainAttrs(b.attributes)) : null;

  const row = await queryOne(
    `UPDATE products SET
       id          = $2,
       name        = COALESCE($3, name),
       description = COALESCE($4, description),
       price       = COALESCE($5, price),
       cost        = COALESCE($6, cost),
       barcode     = COALESCE($7, barcode),
       image       = COALESCE($8, image),
       images      = COALESCE($9, images),
       attributes  = COALESCE($10::jsonb, attributes),
       category    = COALESCE($11, category),
       featured    = COALESCE($12, featured),
       stock       = COALESCE($13, stock),
       status      = COALESCE($14::product_status, status),
       updated_at  = now()
     WHERE id = $1
     RETURNING id, name, description AS desc, price, cost, barcode, image, images, attributes, category,
               featured, stock, status`,
    [
      params.id,
      nextId,
      b.name ?? null,
      b.desc ?? b.description ?? null,
      b.price != null ? Math.round(Number(b.price)) : null,
      b.cost != null ? Math.round(Number(b.cost)) : null,
      barcode,
      primary,
      images,
      attributes,
      b.category ?? null,
      typeof b.featured === "boolean" ? b.featured : null,
      b.stock != null ? Math.round(Number(b.stock)) : null,
      b.status ?? null,
    ]
  );
  return row ? ok(row) : notFound("Producto no encontrado");
});

export const DELETE = handler(async (_req: NextRequest, { params }: Params) => {
  if (!getSession("employee")) return unauthorized();
  const row = await queryOne(`DELETE FROM products WHERE id = $1 RETURNING id`, [
    params.id,
  ]);
  return row ? ok({ ok: true }) : notFound("Producto no encontrado");
});
