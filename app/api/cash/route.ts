import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Resumen del turno actual: ventas desde el último corte (o inicio del día). */
async function resumenTurno() {
  const rows = await query<{
    from_at: string;
    n: string;
    total: string;
    efectivo: string;
    qr: string;
    otros: string;
  }>(
    `WITH periodo AS (
       SELECT COALESCE((SELECT max(closed_at) FROM cash_closes), date_trunc('day', now())) AS from_at
     )
     SELECT p.from_at,
            count(s.id)::int AS n,
            COALESCE(SUM(s.total),0)::numeric AS total,
            COALESCE(SUM(s.total) FILTER (WHERE s.pay_method = 'Efectivo'),0)::numeric AS efectivo,
            COALESCE(SUM(s.total) FILTER (WHERE s.pay_method = 'QR'),0)::numeric AS qr,
            COALESCE(SUM(s.total) FILTER (WHERE s.pay_method NOT IN ('Efectivo','QR')),0)::numeric AS otros
       FROM periodo p
       LEFT JOIN sales s
         ON s.kind = 'factura' AND NOT s.voided AND s.created_at > p.from_at
      GROUP BY p.from_at`
  );
  const r = rows[0];
  return {
    fromAt: r?.from_at ?? null,
    numVentas: Number(r?.n ?? 0),
    totalVentas: Number(r?.total ?? 0),
    totalEfectivo: Number(r?.efectivo ?? 0),
    totalQr: Number(r?.qr ?? 0),
    totalOtros: Number(r?.otros ?? 0),
  };
}

// GET /api/cash — resumen del turno actual (para el arqueo).
export const GET = handler(async () => {
  if (!getSession("employee")) return unauthorized();
  return ok(await resumenTurno());
});

/**
 * POST /api/cash  { countedCash, notes } — cierra la caja: guarda la foto del
 * turno (ventas por método) + el efectivo contado y la diferencia. A partir de
 * acá, el próximo turno arranca de cero.
 */
export const POST = handler(async (req: NextRequest) => {
  const s = getSession("employee");
  if (!s) return unauthorized();
  const b = await req.json();
  const counted = Math.max(0, Number(b.countedCash) || 0);

  const r = await resumenTurno();
  const difference = counted - r.totalEfectivo;

  const close = await queryOne(
    `INSERT INTO cash_closes (from_at, num_ventas, total_ventas, total_efectivo,
                              total_qr, total_otros, counted_cash, difference, created_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, closed_at AS "closedAt", total_ventas AS "totalVentas",
               total_efectivo AS "totalEfectivo", counted_cash AS "countedCash",
               difference`,
    [
      r.fromAt,
      r.numVentas,
      r.totalVentas.toFixed(2),
      r.totalEfectivo.toFixed(2),
      r.totalQr.toFixed(2),
      r.totalOtros.toFixed(2),
      counted.toFixed(2),
      difference.toFixed(2),
      s.name ?? "",
      (b.notes ?? "").toString().trim(),
    ]
  );
  return ok(close, { status: 201 });
});
