import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports?desde=YYYY-MM-DD&hasta=YYYY-MM-DD — resumen de ventas.
 *
 * Todo se agrega en la base (una tanda de consultas simples), así la app recibe
 * ya masticado y no tiene que traer y recorrer miles de filas. Se cuenta solo
 * `factura` (venta real); las proformas son cotizaciones y no cuentan.
 *
 * El rango se aplica en HORA DE BOLIVIA (America/La_Paz) para que "hoy" sea el
 * día del negocio y no el de UTC. Sin fechas: desde el año 2000 hasta hoy (todo).
 */
function rango(req: NextRequest): { desde: string; hasta: string } {
  const sp = req.nextUrl.searchParams;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const d = sp.get("desde") ?? "";
  const h = sp.get("hasta") ?? "";
  return {
    desde: re.test(d) ? d : "2000-01-01",
    hasta: re.test(h) ? h : "2999-12-31",
  };
}

export const GET = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const { desde, hasta } = rango(req);

  // Filtro de fecha reutilizable (hora de Bolivia).
  const fVenta = `(s.created_at AT TIME ZONE 'America/La_Paz')::date BETWEEN $1::date AND $2::date`;
  const fVentaSolo = `(created_at AT TIME ZONE 'America/La_Paz')::date BETWEEN $1::date AND $2::date`;
  const p = [desde, hasta];

  const [resumen, porMetodo, topProductos, porMes, stock, costo] =
    await Promise.all([
      query<{ total: string; n: string }>(
        `SELECT COALESCE(SUM(total),0)::numeric AS total, COUNT(*)::int AS n
           FROM sales s WHERE kind = 'factura' AND NOT voided AND ${fVenta}`,
        p
      ),
      query<{ metodo: string; n: string; total: string }>(
        `SELECT COALESCE(NULLIF(pay_method,''),'Sin especificar') AS metodo,
                COUNT(*)::int AS n, COALESCE(SUM(total),0)::numeric AS total
           FROM sales s WHERE kind = 'factura' AND NOT voided AND ${fVenta}
          GROUP BY 1 ORDER BY total DESC`,
        p
      ),
      query<{ name: string; qty: string; revenue: string }>(
        `SELECT i.name, SUM(i.qty)::int AS qty,
                SUM(i.qty * i.unit_price)::numeric AS revenue
           FROM sale_items i JOIN sales s ON s.id = i.sale_id
          WHERE s.kind = 'factura' AND NOT s.voided AND ${fVenta}
          GROUP BY i.name ORDER BY revenue DESC LIMIT 8`,
        p
      ),
      // Serie por día si el rango es corto (≤ 62 días); por mes si es largo.
      query<{ periodo: string; total: string }>(
        `SELECT to_char(date_trunc(
                  CASE WHEN $2::date - $1::date <= 62 THEN 'day' ELSE 'month' END,
                  s.created_at AT TIME ZONE 'America/La_Paz'),
                  CASE WHEN $2::date - $1::date <= 62 THEN 'YYYY-MM-DD' ELSE 'YYYY-MM' END) AS periodo,
                COALESCE(SUM(total),0)::numeric AS total
           FROM sales s
          WHERE kind = 'factura' AND NOT voided AND ${fVenta}
          GROUP BY 1 ORDER BY 1`,
        p
      ),
      query<{ bajo: string; total: string }>(
        `SELECT COUNT(*) FILTER (WHERE stock <= 5)::int AS bajo,
                COUNT(*)::int AS total
           FROM products`
      ),
      // Costo de lo vendido (para la ganancia): cantidad × costo del producto.
      query<{ costo: string }>(
        `SELECT COALESCE(SUM(i.qty * p.cost),0)::numeric AS costo
           FROM sale_items i
           JOIN sales s ON s.id = i.sale_id
           JOIN products p ON p.id = i.product_id
          WHERE s.kind = 'factura' AND NOT s.voided AND ${fVenta}`,
        p
      ),
    ]);

  const total = Number(resumen[0]?.total ?? 0);
  const n = Number(resumen[0]?.n ?? 0);
  const costoVendido = Number(costo[0]?.costo ?? 0);

  return ok({
    desde,
    hasta,
    totalVentas: total,
    numVentas: n,
    ticketPromedio: n > 0 ? total / n : 0,
    costoVendido,
    // Ganancia = lo vendido menos lo que costó esa mercadería. El negocio no
    // carga sus egresos en el sistema, así que no hay nada más que restar.
    ganancia: total - costoVendido,
    stockBajo: Number(stock[0]?.bajo ?? 0),
    totalProductos: Number(stock[0]?.total ?? 0),
    porMetodo: porMetodo.map((r) => ({
      metodo: r.metodo,
      n: Number(r.n),
      total: Number(r.total),
    })),
    topProductos: topProductos.map((r) => ({
      name: r.name,
      qty: Number(r.qty),
      revenue: Number(r.revenue),
    })),
    // Se mantiene `porMes` por compatibilidad; ahora es "por período" (día o mes).
    porMes: porMes.map((r) => ({ mes: r.periodo, total: Number(r.total) })),
  });
});
