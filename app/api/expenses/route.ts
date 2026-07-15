import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// Toda ruta de la API resuelve a qué negocio pertenece la request (lee headers
// en `handler()`), así que nunca se puede renderizar estáticamente.
export const dynamic = "force-dynamic";

const EXPENSE_SELECT = `
  SELECT id, category, description, amount::float AS amount,
         to_char(spent_at, 'YYYY-MM-DD') AS "spentAt",
         created_by AS "createdBy", created_at AS "createdAt"
    FROM expenses`;

// GET /api/expenses  — lista los gastos recientes (solo empleados del CRM)
export const GET = handler(async () => {
  if (!getSession("employee")) return unauthorized();
  const rows = await query(
    `${EXPENSE_SELECT} ORDER BY spent_at DESC, created_at DESC LIMIT 200`
  );
  return ok(rows);
});

// POST /api/expenses  — registra un gasto/egreso (solo empleados del CRM)
export const POST = handler(async (req: NextRequest) => {
  const emp = getSession("employee");
  if (!emp) return unauthorized();
  const b = await req.json();
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return bad("El monto del gasto debe ser mayor a 0.");

  const row = await queryOne(
    `INSERT INTO expenses (category, description, amount, spent_at, created_by)
     VALUES ($1, $2, $3, COALESCE($4::date, current_date), $5)
     RETURNING id`,
    [
      (b.category ?? "General").trim() || "General",
      (b.description ?? "").trim(),
      amount,
      b.spentAt || null,
      emp.name,
    ]
  );
  return ok({ id: row?.id }, { status: 201 });
});
