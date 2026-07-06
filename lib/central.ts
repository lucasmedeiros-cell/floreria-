// ============================================================
//  Integración con COMANDER (dashboard central de PetroBox).
//  Expone agregados de ventas, gastos, ganancias y ranking de
//  ramos para que COMANDER los consuma vía su API pública.
//
//  Autenticación: token compartido (CENTRAL_API_TOKEN). El cliente
//  lo envía por ?token=, cabecera X-API-Key, o Authorization: Bearer.
//  Sigue el mismo contrato que la integración "Te lo Presto".
// ============================================================
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { queryOne, query } from "./db";

export const CENTRAL_BUSINESS_ID = "floreria";
export const CENTRAL_CURRENCY = "BOB";

/** Estados de pedido que NO cuentan como venta (coincide con el dashboard). */
const EXCLUDED_STATUS = "'cancelado'";

/** Lee el token de la petición: ?token=, X-API-Key, o Bearer. */
export function readCentralToken(req: NextRequest): string | null {
  const q = req.nextUrl.searchParams.get("token");
  if (q) return q.trim();
  const h = headers();
  const apiKey = h.get("x-api-key");
  if (apiKey) return apiKey.trim();
  const auth = h.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

/** true si el token es válido. */
export function centralTokenOk(token: string | null): boolean {
  const expected = process.env.CENTRAL_API_TOKEN;
  if (!expected) return false; // sin token configurado, se deniega
  return !!token && token === expected;
}

export function centralConfigured(): boolean {
  return !!process.env.CENTRAL_API_TOKEN;
}

// ---- Ventanas de tiempo (calendario, zona del servidor) ----
// hoy ⊆ semana ⊆ mes ⊆ año. Basadas en created_at del pedido / spent_at del gasto.
const PERIODS = {
  hoy: "date_trunc('day', now())",
  semana: "date_trunc('week', now())",
  mes: "date_trunc('month', now())",
  anio: "date_trunc('year', now())",
} as const;
export type Periodo = keyof typeof PERIODS;

/**
 * Resumen de KPIs: ingresos, gastos y ganancia por hoy/semana/mes/año,
 * más conteo de pedidos y ticket promedio del mes.
 */
export async function getResumen() {
  // Ingresos y conteo de pedidos por ventana (excluye cancelados).
  const ventas = await queryOne<Record<string, string>>(`
    SELECT
      ${Object.entries(PERIODS)
        .map(
          ([k, w]) => `
        COALESCE(SUM(t.total) FILTER (WHERE o.created_at >= ${w}), 0) AS ingresos_${k},
        COUNT(o.id)          FILTER (WHERE o.created_at >= ${w})       AS pedidos_${k}`
        )
        .join(",")}
    FROM orders o
    JOIN order_totals t ON t.id = o.id
    WHERE o.status <> ${EXCLUDED_STATUS}
  `);

  // Gastos por ventana.
  const gastos = await queryOne<Record<string, string>>(`
    SELECT
      ${Object.entries(PERIODS)
        .map(
          ([k, w]) => `COALESCE(SUM(amount) FILTER (WHERE spent_at >= (${w})::date), 0) AS gastos_${k}`
        )
        .join(",")}
    FROM expenses
  `);

  const n = (v: string | undefined) => Math.round((Number(v) || 0) * 100) / 100;
  const i = (v: string | undefined) => Number(v) || 0;

  const out: Record<string, number | string> = {
    business: CENTRAL_BUSINESS_ID,
    currency: CENTRAL_CURRENCY,
    generatedAt: new Date().toISOString(),
  };
  for (const k of Object.keys(PERIODS) as Periodo[]) {
    const ingresos = n(ventas?.[`ingresos_${k}`]);
    const gasto = n(gastos?.[`gastos_${k}`]);
    out[`ingresos_${k}`] = ingresos;
    out[`gastos_${k}`] = gasto;
    out[`ganancia_${k}`] = n(String(ingresos - gasto));
    out[`pedidos_${k}`] = i(ventas?.[`pedidos_${k}`]);
  }
  const pedMes = i(ventas?.["pedidos_mes"]);
  out["ticket_promedio_mes"] = pedMes ? n(String(n(ventas?.["ingresos_mes"]) / pedMes)) : 0;
  return out;
}

/**
 * Ranking del período (por defecto el mes): ramos más vendidos y
 * desgloses por categoría, canal y método de pago.
 */
export async function getRanking(periodo: Periodo = "mes") {
  const win = PERIODS[periodo] ?? PERIODS.mes;

  const itemRevenue = "i.qty * i.unit_price * (1 - i.discount_pct / 100)";
  // FROM/JOIN/WHERE comunes. La tabla products se une por LEFT JOIN aquí
  // (antes del WHERE) para poder agrupar por categoría.
  const source = `
    FROM order_items i
    JOIN orders o     ON o.id = i.order_id
    LEFT JOIN products p ON p.id = i.product_id
    WHERE o.status <> ${EXCLUDED_STATUS} AND o.created_at >= ${win}`;

  const topRamos = await query(`
    SELECT COALESCE(i.product_id, i.name)  AS "productId",
           i.name,
           COALESCE(p.category, 'Otros')   AS category,
           SUM(i.qty)::int                 AS cantidad,
           ROUND(SUM(${itemRevenue}), 2)::float AS ingresos
    ${source}
    GROUP BY COALESCE(i.product_id, i.name), i.name, COALESCE(p.category, 'Otros')
    ORDER BY cantidad DESC, ingresos DESC
    LIMIT 10
  `);

  const porCategoria = await query(`
    SELECT COALESCE(p.category, 'Otros')      AS categoria,
           SUM(i.qty)::int                    AS cantidad,
           ROUND(SUM(${itemRevenue}), 2)::float AS ingresos
    ${source}
    GROUP BY COALESCE(p.category, 'Otros')
    ORDER BY ingresos DESC
  `);

  const porCanal = await query(`
    SELECT o.channel                          AS canal,
           COUNT(DISTINCT o.id)::int          AS pedidos,
           ROUND(SUM(${itemRevenue}), 2)::float AS ingresos
    ${source}
    GROUP BY o.channel
    ORDER BY ingresos DESC
  `);

  const porMetodo = await query(`
    SELECT o.pay_method                       AS metodo,
           COUNT(DISTINCT o.id)::int          AS pedidos,
           ROUND(SUM(${itemRevenue}), 2)::float AS ingresos
    ${source}
    GROUP BY o.pay_method
    ORDER BY ingresos DESC
  `);

  return {
    business: CENTRAL_BUSINESS_ID,
    currency: CENTRAL_CURRENCY,
    periodo,
    generatedAt: new Date().toISOString(),
    top_ramos: topRamos,
    por_categoria: porCategoria,
    por_canal: porCanal,
    por_metodo_pago: porMetodo,
  };
}
