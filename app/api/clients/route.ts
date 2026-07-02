import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/clients?q=   (con estadísticas del CRM)
export const GET = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const params: unknown[] = [];
  let where = "";
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE c.name ILIKE $1 OR c.phone ILIKE $1`;
  }
  const rows = await query(
    `SELECT c.id, c.name, c.phone, c.address, c.reference, c.location, c.notes,
            COALESCE(s.orders_count, 0)       AS "ordersCount",
            COALESCE(s.total_spent, 0)::float AS "totalSpent",
            to_char(s.last_order, 'DD/MM/YYYY') AS "lastOrder"
       FROM clients c
       LEFT JOIN client_stats s ON s.id = c.id
       ${where}
      ORDER BY c.name`,
    params
  );
  return ok(rows);
});

// POST /api/clients   (empleados)
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const b = await req.json();
  if (!b.name?.trim()) return bad("El nombre es obligatorio.");
  const row = await queryOne(
    `INSERT INTO clients (name, phone, address, reference, location, notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, name, phone, address, reference, location, notes`,
    [
      b.name.trim(),
      b.phone ?? "",
      b.address ?? "",
      b.reference ?? "",
      b.location ?? "",
      b.notes ?? "",
    ]
  );
  return ok(row, { status: 201 });
});
