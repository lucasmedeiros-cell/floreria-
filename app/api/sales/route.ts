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
  unitPrice?: number;
  discountPct?: number;
}

// GET /api/sales?kind=&q= — lista de ventas (facturas/proformas) recientes.
export const GET = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const { searchParams } = new URL(req.url);
  // Validado acá: un valor fuera del enum haría reventar el cast `::sale_kind`.
  const kindParam = searchParams.get("kind");
  const kind = kindParam && ["factura", "proforma"].includes(kindParam) ? kindParam : null;
  const rows = await query(
    `SELECT s.id, s.code, s.kind, s.client_name AS "clientName", s.total::float AS total,
            s.pay_method AS "payMethod", s.created_at AS "createdAt", s.voided,
            COALESCE(count(i.id), 0)::int AS "itemCount"
       FROM sales s
       LEFT JOIN sale_items i ON i.sale_id = s.id
      ${kind ? "WHERE s.kind = $1::sale_kind" : ""}
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 100`,
    kind ? [kind] : []
  );
  return ok(rows);
});

/**
 * POST /api/sales — registra una VENTA.
 *   · kind 'factura'  → venta real: descuenta el stock del inventario.
 *   · kind 'proforma' → cotización: NO toca el stock.
 * Todo en una transacción: o se guarda la venta Y baja el stock, o nada.
 */
export const POST = handler(async (req: NextRequest) => {
  const s = getSession("employee");
  if (!s) return unauthorized();

  const b = await req.json();
  const kind = b.kind === "proforma" ? "proforma" : "factura";
  const items: ItemIn[] = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return bad("Agregá al menos un producto.");

  const clean = items.map((it) => ({
    productId: (it.productId ?? "").toString().trim() || null,
    sku: (it.sku ?? "").toString().trim(),
    name: (it.name ?? "").toString().trim(),
    qty: Math.max(1, Math.round(Number(it.qty) || 1)),
    unitPrice: Math.max(0, Number(it.unitPrice) || 0),
    discountPct: Math.min(100, Math.max(0, Number(it.discountPct) || 0)),
  }));
  if (clean.some((it) => it.name === "")) return bad("Un ítem no tiene nombre.");

  const subtotal = clean.reduce((a, it) => a + it.qty * it.unitPrice, 0);
  const totalItems = clean.reduce(
    (a, it) => a + it.qty * it.unitPrice * (1 - it.discountPct / 100),
    0
  );
  // Descuento a nivel venta (lo que aplica el cajero en el cobro), sobre el
  // total ya con descuentos por ítem si los hubiera.
  const saleDiscountPct = Math.min(100, Math.max(0, Number(b.discountPct) || 0));
  const total = totalItems * (1 - saleDiscountPct / 100);
  const discount = subtotal - total;

  // Clave de idempotencia de la app: si la venta ya entró (p. ej. el POST
  // original hizo timeout pero el servidor la procesó, y la cola offline la
  // reintenta), se devuelve la existente en vez de duplicarla.
  const clientRef = (b.clientRef ?? "").toString().trim() || null;

  const crear = () => withTransaction(async (client) => {
    if (clientRef) {
      const { rows: prev } = await client.query(
        `SELECT id, code, kind, total::float AS total, created_at AS "createdAt"
           FROM sales WHERE client_ref = $1`,
        [clientRef]
      );
      if (prev[0]) return prev[0];
    }
    // Numeración serializada por tipo: sin el lock, dos ventas simultáneas
    // podrían tomar el mismo número.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sale_' || $1))", [kind]);
    const { rows: cnt } = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sales WHERE kind = $1::sale_kind`,
      [kind]
    );
    const num = (Number(cnt[0].n) + 1).toString().padStart(6, "0");
    const code = `${kind === "factura" ? "FAC" : "PRO"}-${num}`;

    const { rows: saleRows } = await client.query(
      `INSERT INTO sales (code, kind, client_name, client_phone, client_nit,
                          subtotal, discount, total, pay_method, notes, created_by, client_ref)
       VALUES ($1,$2::sale_kind,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, code, kind, total::float AS total, created_at AS "createdAt"`,
      [
        code,
        kind,
        (b.clientName ?? "").toString().trim() || "Consumidor final",
        (b.clientPhone ?? "").toString().trim(),
        (b.clientNit ?? "").toString().trim(),
        subtotal.toFixed(2),
        discount.toFixed(2),
        total.toFixed(2),
        (b.payMethod ?? "Efectivo").toString().trim() || "Efectivo",
        (b.notes ?? "").toString().trim(),
        s.name ?? "",
        clientRef,
      ]
    );
    const sale = saleRows[0];

    for (const it of clean) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, sku, name, qty, unit_price, discount_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [sale.id, it.productId, it.sku, it.name, it.qty, it.unitPrice, it.discountPct]
      );
      // Solo la FACTURA (venta real) descuenta stock; la proforma no.
      // Se resta SIN clampear a 0: si el conteo estaba mal, el stock queda en
      // negativo (señal visible de descuadre) y la anulación —que suma la
      // cantidad completa— deja el inventario exactamente como estaba. Con el
      // clamp viejo, anular una venta clampada "inventaba" unidades.
      if (kind === "factura" && it.productId) {
        await client.query(
          `UPDATE products SET stock = stock - $2, updated_at = now()
            WHERE id = $1`,
          [it.productId, it.qty]
        );
      }
    }
    return sale;
  });

  let result;
  try {
    result = await crear();
  } catch (err) {
    // Carrera de idempotencia: dos reintentos con el mismo clientRef pasaron el
    // SELECT a la vez; el segundo choca con el índice único → devolver la que ganó.
    if (clientRef && (err as { code?: string } | null)?.code === "23505") {
      const { 0: prev } = await query(
        `SELECT id, code, kind, total::float AS total, created_at AS "createdAt"
           FROM sales WHERE client_ref = $1`,
        [clientRef]
      );
      if (prev) return ok(prev, { status: 201 });
    }
    throw err;
  }

  return ok(result, { status: 201 });
});
