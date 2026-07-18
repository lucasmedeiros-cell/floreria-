import { NextRequest } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/sales/[id] — venta con sus ítems (para reimprimir el comprobante).
export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  if (!getSession("employee")) return unauthorized();
  const rows = await query(
    `SELECT s.id, s.code, s.kind, s.client_name AS "clientName", s.client_phone AS "clientPhone",
            s.subtotal::float AS subtotal, s.discount::float AS discount,
            s.total::float AS total, s.pay_method AS "payMethod",
            s.created_at AS "createdAt", s.voided,
            COALESCE(json_agg(json_build_object(
              'name', i.name, 'qty', i.qty, 'unitPrice', i.unit_price::float,
              'discountPct', i.discount_pct::float) ORDER BY i.id)
              FILTER (WHERE i.id IS NOT NULL), '[]') AS items
       FROM sales s
       LEFT JOIN sale_items i ON i.sale_id = s.id
      WHERE s.id = $1
      GROUP BY s.id`,
    [params.id]
  );
  return rows[0] ? ok(rows[0]) : notFound("Venta no encontrada");
});

/**
 * PATCH /api/sales/[id]  { void: true } — anula una venta.
 * Si era una FACTURA no anulada, DEVUELVE el stock de cada ítem. Idempotente:
 * anular dos veces no devuelve stock de más.
 */
export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  if (!getSession("employee")) return unauthorized();
  const b = await req.json();
  if (b.void !== true) return ok({ noop: true });

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query<{ kind: string; voided: boolean }>(
      `SELECT kind, voided FROM sales WHERE id = $1 FOR UPDATE`,
      [params.id]
    );
    if (rows.length === 0) return null;
    if (rows[0].voided) return { alreadyVoided: true };

    // Devolver stock solo si era factura (la proforma nunca lo tocó).
    if (rows[0].kind === "factura") {
      const { rows: its } = await client.query<{ product_id: string | null; qty: number }>(
        `SELECT product_id, qty FROM sale_items WHERE sale_id = $1`,
        [params.id]
      );
      for (const it of its) {
        if (it.product_id) {
          await client.query(
            `UPDATE products SET stock = stock + $2, updated_at = now() WHERE id = $1`,
            [it.product_id, it.qty]
          );
        }
      }
    }
    await client.query(
      `UPDATE sales SET voided = true, voided_at = now() WHERE id = $1`,
      [params.id]
    );
    return { voided: true };
  });

  return result ? ok(result) : notFound("Venta no encontrada");
});
