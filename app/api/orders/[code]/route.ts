import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

type Params = { params: { code: string } };

const STATUSES = [
  "borrador",
  "programado",
  "enCamino",
  "entregado",
  "cancelado",
];

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  if (!getSession("employee") && !getSession("customer")) return unauthorized();
  const rows = await query(
    `SELECT o.code, o.client_name AS "clientName", o.status,
            to_char(o.delivery_date,'YYYY-MM-DD') AS "deliveryDate", o.delivery_time AS "deliveryTime",
            t.total::float AS total,
            COALESCE((SELECT json_agg(json_build_object('name',i.name,'qty',i.qty,
              'unitPrice',i.unit_price::float,'discountPct',i.discount_pct::float))
              FROM order_items i WHERE i.order_id=o.id),'[]') AS items
       FROM orders o LEFT JOIN order_totals t ON t.id=o.id
      WHERE o.code = $1`,
    [params.code]
  );
  return rows[0] ? ok(rows[0]) : notFound("Pedido no encontrado");
});

// PATCH /api/orders/[code]  { status }  (empleados)
export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  if (!getSession("employee")) return unauthorized();
  const { status } = await req.json();
  if (!STATUSES.includes(status)) return bad("Estado inválido.");
  const row = await queryOne(
    `UPDATE orders SET status = $2 WHERE code = $1 RETURNING code, status`,
    [params.code, status]
  );
  return row ? ok(row) : notFound("Pedido no encontrado");
});

// DELETE /api/orders/[code]  (empleados) — elimina el pedido y sus ítems.
export const DELETE = handler(async (_req: NextRequest, { params }: Params) => {
  if (!getSession("employee")) return unauthorized();
  const row = await queryOne(
    `DELETE FROM orders WHERE code = $1 RETURNING code`,
    [params.code]
  );
  return row ? ok({ code: row.code }) : notFound("Pedido no encontrado");
});
