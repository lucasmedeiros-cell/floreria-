import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/ledger?desde=YYYY-MM-DD&hasta=YYYY-MM-DD — libro de caja.
 *
 * Las ventas facturadas del período, cronológicas. El saldo acumulado lo arma
 * el cliente al pintar (así el mismo dato sirve ordenado asc o desc). Rango en
 * hora de Bolivia; sin fechas: todo.
 *
 * Sigue devolviendo `egresos` (siempre 0) y `neto` para no romper a los
 * clientes ya instalados que leen esos campos.
 */
export const GET = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const desde = re.test(sp.get("desde") ?? "") ? sp.get("desde")! : "2000-01-01";
  const hasta = re.test(sp.get("hasta") ?? "") ? sp.get("hasta")! : "2999-12-31";

  const movs = await query<{
    fecha: string;
    tipo: string;
    ref: string;
    concepto: string;
    metodo: string;
    monto: string;
  }>(
    `SELECT (s.created_at AT TIME ZONE 'America/La_Paz')::date::text AS fecha,
            'ingreso' AS tipo, s.code AS ref,
            COALESCE(NULLIF(s.client_name,''),'Venta') AS concepto,
            COALESCE(NULLIF(s.pay_method,''),'—') AS metodo,
            s.total::numeric AS monto
       FROM sales s
      WHERE s.kind = 'factura' AND NOT s.voided
        AND (s.created_at AT TIME ZONE 'America/La_Paz')::date BETWEEN $1::date AND $2::date
     ORDER BY fecha ASC`,
    [desde, hasta]
  );

  let ingresos = 0;
  let egresos = 0;
  const movimientos = movs.map((m) => {
    const monto = Number(m.monto);
    if (monto >= 0) ingresos += monto;
    else egresos += -monto;
    return {
      fecha: m.fecha,
      tipo: m.tipo,
      ref: m.ref,
      concepto: m.concepto,
      metodo: m.metodo,
      monto,
    };
  });

  return ok({
    desde,
    hasta,
    ingresos,
    egresos,
    neto: ingresos - egresos,
    movimientos,
  });
});
