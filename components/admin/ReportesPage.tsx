"use client";

import { useEffect, useState } from "react";
import { DollarSign, ReceiptText, TrendingUp, AlertTriangle } from "lucide-react";
import { IconTile } from "./kit";
import { bs2 } from "@/lib/products";
import { useBusiness } from "@/context/StoreProvider";
import { apiReports, type Reports } from "@/lib/reportsClient";

const MS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-07" → "jul" */
function mesCorto(ym: string): string {
  const m = Number(ym.split("-")[1]);
  return MS[m - 1] ?? ym;
}

/**
 * Reportes — resumen REAL del POS (ventas facturadas), servido por /api/reports.
 * Sin datos de ejemplo: si no hay ventas, se ven ceros y estados "sin datos".
 */
export function ReportesPage() {
  const { colors } = useBusiness();
  const [rep, setRep] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiReports();
        if (alive) setRep(r);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const monthly = rep?.porMes ?? [];
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.total));
  const topProducts = rep?.topProductos ?? [];
  const maxProd = Math.max(1, topProducts[0]?.revenue ?? 1);
  const metodos = rep?.porMetodo ?? [];
  const maxMetodo = Math.max(1, metodos[0]?.total ?? 1);

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <h1 className="text-[27px] font-extrabold leading-none tracking-[-0.4px] text-ink">
        Reportes
      </h1>
      <p className="mt-1 text-[13px] text-ink2">Ventas facturadas, ganancia y productos más vendidos</p>

      {error && (
        <div className="mt-5 rounded-[14px] border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
          No se pudieron cargar los reportes. Verificá la conexión e intentá de nuevo.
        </div>
      )}

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<DollarSign size={28} />} label="Ventas acumuladas" value={loading ? "—" : bs2(rep?.totalVentas ?? 0)} />
        <Kpi icon={<ReceiptText size={28} />} label="N° de ventas" value={loading ? "—" : `${rep?.numVentas ?? 0}`} />
        <Kpi icon={<TrendingUp size={28} />} label="Ganancia" value={loading ? "—" : bs2(rep?.ganancia ?? 0)} />
        <Kpi icon={<AlertTriangle size={28} />} label="Stock bajo" value={loading ? "—" : `${rep?.stockBajo ?? 0}`} />
      </div>

      {/* Ventas por mes (datos reales) */}
      <div className="mt-4 rounded-[18px] border border-line bg-surface p-5 shadow-soft">
        <h3 className="text-[15px] font-semibold text-ink">Ventas por mes</h3>
        {monthly.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink2">{loading ? "Cargando…" : "Sin ventas registradas todavía."}</p>
        ) : (
          <div className="mt-6 flex h-[200px] items-end gap-3">
            {monthly.map((m, i) => {
              const last = i === monthly.length - 1;
              return (
                <div key={m.mes} className="flex flex-1 flex-col items-center justify-end">
                  <span className="text-[10.5px] font-semibold text-ink2">{bs2(m.total)}</span>
                  {/* Ancho tope: con un solo mes cargado, una barra al 100% del
                      panel se lee como un bloque de color, no como un gráfico. */}
                  <div
                    className="mt-1.5 w-full max-w-[92px] rounded-t-lg"
                    style={{
                      height: `${Math.max(4, (m.total / maxMonthly) * 140)}px`,
                      background: last
                        ? `linear-gradient(180deg,${colors.accent},${colors.accentDeep})`
                        : `linear-gradient(180deg,${colors.accent}55,${colors.accent}99)`,
                    }}
                  />
                  <span className={`mt-2 text-[11.5px] ${last ? "font-bold text-ink" : "font-medium text-ink2"}`}>{mesCorto(m.mes)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankCard
          title="Productos más vendidos"
          rows={topProducts.map((p) => ({ name: p.name, label: bs2(p.revenue), sub: `${p.qty} u`, pct: p.revenue / maxProd }))}
          empty={loading ? "Cargando…" : "Sin ventas aún."}
        />
        <RankCard
          title="Ventas por método de pago"
          rows={metodos.map((m) => ({ name: m.metodo, label: bs2(m.total), sub: `${m.n} ventas`, pct: m.total / maxMetodo }))}
          empty={loading ? "Cargando…" : "Sin ventas aún."}
        />
      </div>

      {/* Resumen financiero */}
      <div className="mt-4 rounded-[18px] border border-line bg-surface p-5 shadow-soft">
        <h3 className="text-[15px] font-semibold text-ink">Resumen financiero</h3>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 lg:grid-cols-3">
          <Fin label="Ticket promedio" value={bs2(rep?.ticketPromedio ?? 0)} />
          <Fin label="Costo de lo vendido" value={bs2(rep?.costoVendido ?? 0)} />
          <Fin label="Ganancia neta" value={bs2(rep?.ganancia ?? 0)} strong />
        </div>
      </div>
    </div>
  );
}

/**
 * Tarjeta de dato de Reportes.
 *
 * Todos los íconos van en el amarillo de easy pay y sin sombra propia: antes
 * cada tarjeta tenía su color (azul, verde, rojo) y el ícono flotaba como una
 * pastilla pegada encima. Ahora el ícono es parte de la tarjeta, y las cuatro
 * se leen como una sola familia — la misma de Resumen e Inventario.
 */
function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { colors } = useBusiness();
  return (
    <div
      className="flex items-center gap-4 rounded-[18px] border border-line bg-surface p-5 shadow-card"
      style={{ borderTopColor: colors.accent }}
    >
      <IconTile icon={icon} tone={colors.accentDeep} size={62} />
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold text-ink2">{label}</span>
        <span className="mt-1 block truncate text-[24px] font-extrabold leading-none text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}

function Fin({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[12px] text-ink2">{label}</p>
      <p className={`mt-0.5 ${strong ? "text-[17px] font-bold text-success" : "text-[15px] font-semibold text-ink"}`}>{value}</p>
    </div>
  );
}

function RankCard({ title, rows, empty }: { title: string; rows: { name: string; label: string; sub?: string; pct: number }[]; empty: string }) {
  const { colors } = useBusiness();
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.length === 0 ? (
          <p className="text-[13px] text-ink2">{empty}</p>
        ) : (
          rows.map((r) => (
            <div key={r.name}>
              <div className="flex items-center justify-between">
                <span className="truncate text-[13px] font-medium text-ink">{r.name}</span>
                <span className="text-[13px] font-bold text-ink">{r.label}{r.sub ? <span className="ml-1.5 text-[11px] font-medium text-ink2">· {r.sub}</span> : null}</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, r.pct * 100)}%`, background: `linear-gradient(90deg,${colors.accent},${colors.accentDeep})` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
