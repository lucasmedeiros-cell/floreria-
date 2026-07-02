import { NextRequest } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { bad, handler, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const ORDER_SELECT = `
  SELECT o.id, o.code, o.client_id AS "clientId", o.client_name AS "clientName",
         o.phone, o.address, o.reference, o.location, o.client_notes AS "clientNotes",
         to_char(o.delivery_date, 'YYYY-MM-DD') AS "deliveryDate",
         o.delivery_time AS "deliveryTime", o.priority, o.courier, o.status,
         o.pay_method AS "payMethod", o.needs_receipt AS "needsReceipt",
         o.delivery_cost::float AS "deliveryCost", o.delivery_obs AS "deliveryObs",
         o.order_notes AS "orderNotes", o.channel, o.created_by AS "createdBy",
         o.created_at AS "createdAt",
         t.subtotal::float AS subtotal, t.discount::float AS discount,
         t.total::float AS total, t.item_count::int AS "itemCount",
         COALESCE(
           (SELECT json_agg(json_build_object(
              'name', i.name, 'detail', i.detail, 'qty', i.qty,
              'unitPrice', i.unit_price::float, 'discountPct', i.discount_pct::float,
              'image', i.image, 'productId', i.product_id) ORDER BY i.id)
            FROM order_items i WHERE i.order_id = o.id), '[]') AS items
    FROM orders o
    LEFT JOIN order_totals t ON t.id = o.id
`;

// GET /api/orders?status=&q=
export const GET = handler(async (req: NextRequest) => {
  if (!getSession("employee")) {
    // La tienda web puede consultar solo sus propios pedidos por sesión de cliente.
    const cust = getSession("customer");
    if (!cust) return ok([]);
    const rows = await query(
      `${ORDER_SELECT} WHERE o.customer_id = $1 ORDER BY o.created_at DESC`,
      [cust.sub]
    );
    return ok(rows);
  }
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim();
  const where: string[] = [];
  const params: unknown[] = [];
  if (status) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(o.client_name ILIKE $${params.length} OR o.code ILIKE $${params.length})`);
  }
  const rows = await query(
    `${ORDER_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY o.created_at DESC`,
    params
  );
  return ok(rows);
});

// POST /api/orders  — crea un pedido (CRM o checkout web)
export const POST = handler(async (req: NextRequest) => {
  const emp = getSession("employee");
  const cust = getSession("customer");
  const b = await req.json();

  if (!b.clientName?.trim() && !cust) return bad("Falta el nombre del cliente.");
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return bad("Agrega al menos un producto.");

  const channel = emp ? "crm" : "web";
  const createdBy = emp?.name ?? cust?.name ?? "Tienda web";

  const order = await withTransaction(async (c) => {
    const code = `PED-${(await c.query(`SELECT nextval('order_code_seq') AS n`)).rows[0].n}`;
    const o = (
      await c.query(
        `INSERT INTO orders (code, client_id, customer_id, client_name, phone, address,
            reference, location, client_notes, delivery_date, delivery_time, priority,
            courier, status, pay_method, needs_receipt, delivery_cost, delivery_obs,
            order_notes, channel, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id, code`,
        [
          code,
          b.clientId ?? null,
          cust?.sub ?? null,
          (b.clientName ?? cust?.name ?? "").trim(),
          b.phone ?? "",
          b.address ?? "",
          b.reference ?? "",
          b.location ?? "",
          b.clientNotes ?? "",
          b.deliveryDate ?? new Date().toISOString().slice(0, 10),
          b.deliveryTime ?? "15:00",
          b.priority ?? "Media",
          b.courier ?? "Sin asignar",
          b.status ?? (channel === "web" ? "programado" : "programado"),
          b.payMethod ?? "Efectivo",
          !!b.needsReceipt,
          Number(b.deliveryCost) || 0,
          b.deliveryObs ?? "",
          b.orderNotes ?? "",
          channel,
          createdBy,
        ]
      )
    ).rows[0];

    for (const it of items) {
      await c.query(
        `INSERT INTO order_items (order_id, product_id, name, detail, qty, unit_price, discount_pct, image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          o.id,
          it.productId ?? it.id ?? null,
          (it.name ?? "").trim(),
          it.detail ?? "",
          Math.max(1, Number(it.qty) || 1),
          Number(it.unitPrice ?? it.price) || 0,
          Number(it.discountPct) || 0,
          it.image ?? null,
        ]
      );
    }
    return o;
  });

  return ok({ code: order.code }, { status: 201 });
});
