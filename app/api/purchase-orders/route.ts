import { NextRequest } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ItemIn {
  productId?: string | null;
  sku?: string;
  name?: string;
  qty?: number;
  unitCost?: number;
}

// GET /api/purchase-orders — pedidos a proveedor recientes.
export const GET = handler(async () => {
  if (!getSession("employee")) return unauthorized();
  const rows = await query(
    `SELECT p.id, p.code, p.supplier, p.status, p.created_at AS "createdAt",
            p.received_at AS "receivedAt",
            COALESCE(count(i.id), 0)::int AS "itemCount",
            COALESCE(json_agg(json_build_object(
              'productId', i.product_id, 'sku', i.sku, 'name', i.name,
              'qty', i.qty) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
       FROM purchase_orders p
       LEFT JOIN purchase_order_items i ON i.purchase_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 100`
  );
  return ok(rows);
});

/** POST /api/purchase-orders — registra un pedido a proveedor (estado inicial
 *  'solicitado'; el stock NO cambia hasta que se marque recibido). */
export const POST = handler(async (req: NextRequest) => {
  const s = getSession("employee");
  if (!s) return unauthorized();
  const b = await req.json();
  const items: ItemIn[] = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return bad("Agregá al menos un repuesto al pedido.");

  const clean = items.map((it) => ({
    productId: (it.productId ?? "").toString().trim() || null,
    sku: (it.sku ?? "").toString().trim(),
    name: (it.name ?? "").toString().trim(),
    qty: Math.max(1, Math.round(Number(it.qty) || 1)),
    unitCost: Math.max(0, Number(it.unitCost) || 0),
  }));
  if (clean.some((it) => it.name === "")) return bad("Un ítem no tiene nombre.");

  const po = await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('purchase'))");
    const { rows: cnt } = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM purchase_orders`
    );
    const code = `COM-${(Number(cnt[0].n) + 1).toString().padStart(6, "0")}`;
    const { rows } = await client.query(
      `INSERT INTO purchase_orders (code, supplier, notes, created_by)
       VALUES ($1,$2,$3,$4)
       RETURNING id, code, supplier, status, created_at AS "createdAt"`,
      [code, (b.supplier ?? "").toString().trim(), (b.notes ?? "").toString().trim(), s.name ?? ""]
    );
    const order = rows[0];
    for (const it of clean) {
      await client.query(
        `INSERT INTO purchase_order_items (purchase_id, product_id, sku, name, qty, unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, it.productId, it.sku, it.name, it.qty, it.unitCost]
      );
    }
    return order;
  });

  return ok(po, { status: 201 });
});
