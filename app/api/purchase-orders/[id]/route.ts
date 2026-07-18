import { NextRequest } from "next/server";
import { withTransaction } from "@/lib/db";
import { bad, handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

/**
 * PATCH /api/purchase-orders/[id] — cambia el estado del pedido.
 * Al pasar a 'recibido' (y solo la primera vez), SUBE el stock del inventario
 * por cada ítem que apunte a un producto del catálogo. Todo en una transacción.
 */
export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  if (!getSession("employee")) return unauthorized();
  const { status } = await req.json();
  if (!["solicitado", "recibido", "cancelado"].includes(status)) {
    return bad("Estado inválido.");
  }

  const updated = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM purchase_orders WHERE id = $1 FOR UPDATE`,
      [params.id]
    );
    if (rows.length === 0) return null;
    const prev = rows[0].status;

    // Reponer stock solo en la transición a 'recibido' (no si ya estaba recibido).
    if (status === "recibido" && prev !== "recibido") {
      const { rows: its } = await client.query<{ product_id: string | null; qty: number }>(
        `SELECT product_id, qty FROM purchase_order_items WHERE purchase_id = $1`,
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

    const { rows: upd } = await client.query(
      `UPDATE purchase_orders
          SET status = $2::purchase_status,
              received_at = CASE WHEN $2 = 'recibido' THEN now() ELSE received_at END
        WHERE id = $1
        RETURNING id, code, supplier, status, received_at AS "receivedAt"`,
      [params.id, status]
    );
    return upd[0];
  });

  return updated ? ok(updated) : notFound("Pedido no encontrado");
});
