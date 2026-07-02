import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/products?category=&q=&status=
export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category");
  const q = sp.get("q")?.trim();
  const status = sp.get("status");

  const where: string[] = [];
  const params: unknown[] = [];
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
    `SELECT id, name, description AS desc, price, image, category, featured, stock, status
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

  const row = await queryOne(
    `INSERT INTO products (id, name, description, price, image, category, featured, stock, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'activo'))
     RETURNING id, name, description AS desc, price, image, category, featured, stock, status`,
    [
      id,
      b.name.trim(),
      b.desc ?? b.description ?? "",
      Math.round(Number(b.price) || 0),
      b.image ?? "",
      b.category ?? "Ramos",
      !!b.featured,
      Math.round(Number(b.stock) || 0),
      b.status ?? null,
    ]
  );
  return ok(row, { status: 201 });
});
