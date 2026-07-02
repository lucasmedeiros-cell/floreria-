import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { bad, handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const row = await queryOne(
    `SELECT id, name, description AS desc, price, image, category, featured, stock, status
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

  const row = await queryOne(
    `UPDATE products SET
       id          = $2,
       name        = COALESCE($3, name),
       description = COALESCE($4, description),
       price       = COALESCE($5, price),
       image       = COALESCE($6, image),
       category    = COALESCE($7, category),
       featured    = COALESCE($8, featured),
       stock       = COALESCE($9, stock),
       status      = COALESCE($10, status),
       updated_at  = now()
     WHERE id = $1
     RETURNING id, name, description AS desc, price, image, category, featured, stock, status`,
    [
      params.id,
      nextId,
      b.name ?? null,
      b.desc ?? b.description ?? null,
      b.price != null ? Math.round(Number(b.price)) : null,
      b.image ?? null,
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
