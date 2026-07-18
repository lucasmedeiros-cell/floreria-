import { query } from "@/lib/db";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports — resumen de ventas para la sección Reportes.
 *
 * Todo se agrega en la base (una tanda de consultas simples), así la app recibe
 * ya masticado y no tiene que traer y recorrer miles de filas. Se cuenta solo
 * `factura` (venta real); las proformas son cotizaciones y no cuentan.
 */
export const GET = handler(async () => {
  if (!getSession("employee")) return unauthorized();

  const [resumen, porMetodo, topProductos, porMes, stock, costo, gastosRows] =
    await Promise.all([
    query<{ total: string; n: string }>(
      `SELECT COALESCE(SUM(total),0)::numeric AS total, COUNT(*)::int AS n
         FROM sales WHERE kind = 'factura' AND NOT voided`
    ),
    query<{ metodo: string; n: string; total: string }>(
      `SELECT COALESCE(NULLIF(pay_method,''),'Sin especificar') AS metodo,
              COUNT(*)::int AS n, COALESCE(SUM(total),0)::numeric AS total
         FROM sales WHERE kind = 'factura' AND NOT voided
        GROUP BY 1 ORDER BY total DESC`
    ),
    query<{ name: string; qty: string; revenue: string }>(
      `SELECT i.name, SUM(i.qty)::int AS qty,
              SUM(i.qty * i.unit_price)::numeric AS revenue
         FROM sale_items i JOIN sales s ON s.id = i.sale_id
        WHERE s.kind = 'factura' AND NOT s.voided
        GROUP BY i.name ORDER BY revenue DESC LIMIT 8`
    ),
    query<{ mes: string; total: string }>(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes,
              COALESCE(SUM(total),0)::numeric AS total
         FROM sales
        WHERE kind = 'factura' AND NOT voided AND created_at >= (now() - interval '6 months')
        GROUP BY 1 ORDER BY 1`
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
        WHERE s.kind = 'factura' AND NOT s.voided`
    ),
    // Gastos registrados.
    query<{ gastos: string }>(
      `SELECT COALESCE(SUM(amount),0)::numeric AS gastos FROM expenses`
    ),
  ]);

  const total = Number(resumen[0]?.total ?? 0);
  const n = Number(resumen[0]?.n ?? 0);
  const costoVendido = Number(costo[0]?.costo ?? 0);
  const gastos = Number(gastosRows[0]?.gastos ?? 0);

  return ok({
    totalVentas: total,
    numVentas: n,
    ticketPromedio: n > 0 ? total / n : 0,
    costoVendido,
    gastos,
    ganancia: total - costoVendido - gastos,
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
    porMes: porMes.map((r) => ({ mes: r.mes, total: Number(r.total) })),
  });
});
