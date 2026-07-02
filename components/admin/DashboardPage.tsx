"use client";

import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ReceiptText,
  ShoppingBag,
  Coins,
} from "lucide-react";
import { orderSubtotal, orderTotal, type Order } from "@/lib/adminData";
import { bs2 } from "@/lib/products";
import { useOrders } from "@/context/StoreProvider";

/**
 * Ratio de costo de mercadería estimado sobre el subtotal de productos.
 * Mientras la contabilidad real vive en la BD (Bilbo), estimamos el gasto
 * como: costo de mercadería (subtotal * COST_RATIO) + costo de entrega.
 * Reemplazar por el gasto real cuando la BD lo provea.
 */
const COST_RATIO = 0.55;

type Period = "ayer" | "hoy" | "semana" | "mes";

const PERIODS: { key: Period; label: string }[] = [
  { key: "ayer", label: "Ayer" },
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
];

const MS_DAY = 86_400_000;

/** Inicio de un día (00:00) para una fecha dada. */
function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

interface Range {
  start: number; // inclusivo
  end: number; // exclusivo
  days: number; // cantidad de días que abarca (para los buckets del gráfico)
}

/** Rango del período seleccionado, terminando al final del día de hoy. */
function periodRange(period: Period): Range {
  const today = dayStart(new Date()).getTime();
  const days = period === "hoy" || period === "ayer" ? 1 : period === "semana" ? 7 : 30;
  const end = period === "ayer" ? today : today + MS_DAY;
  return { start: end - days * MS_DAY, end, days };
}

/** Rango inmediatamente anterior, del mismo tamaño (para comparar). */
function previousRange(r: Range): Range {
  const span = r.days * MS_DAY;
  return { start: r.start - span, end: r.start, days: r.days };
}

const inRange = (r: Range) => (d: Date) => d.getTime() >= r.start && d.getTime() < r.end;

const gasto = (o: Order) => orderSubtotal(o) * COST_RATIO + o.deliveryCost;

interface Stats {
  ventas: number;
  gastos: number;
  ganancia: number;
  pedidos: number;
  ticket: number;
  margen: number;
}

function computeStats(orders: Order[], r: Range): Stats {
  const match = inRange(r);
  const valid = orders.filter((o) => o.status !== "cancelado" && match(o.createdAt));
  const ventas = valid.reduce((s, o) => s + orderTotal(o), 0);
  const gastos = valid.reduce((s, o) => s + gasto(o), 0);
  const ganancia = ventas - gastos;
  const pedidos = valid.length;
  return {
    ventas,
    gastos,
    ganancia,
    pedidos,
    ticket: pedidos ? ventas / pedidos : 0,
    margen: ventas ? (ganancia / ventas) * 100 : 0,
  };
}

/** Variación porcentual respecto al valor anterior (null si no hay base). */
function delta(current: number, prev: number): number | null {
  if (prev === 0) return current === 0 ? 0 : null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

/** Ventas agrupadas por día dentro del rango (para el mini-gráfico). */
function dailySales(orders: Order[], r: Range): { label: string; value: number }[] {
  const buckets: number[] = new Array(r.days).fill(0);
  for (const o of orders) {
    if (o.status === "cancelado") continue;
    const t = o.createdAt.getTime();
    if (t < r.start || t >= r.end) continue;
    const idx = Math.floor((t - r.start) / MS_DAY);
    if (idx >= 0 && idx < r.days) buckets[idx] += orderTotal(o);
  }
  return buckets.map((value, i) => {
    const d = new Date(r.start + i * MS_DAY);
    return { label: `${d.getDate()}`, value };
  });
}

export function DashboardPage() {
  const { orders } = useOrders();
  const [period, setPeriod] = useState<Period>("hoy");

  const { stats, prev, chart } = useMemo(() => {
    const range = periodRange(period);
    return {
      stats: computeStats(orders, range),
      prev: computeStats(orders, previousRange(range)),
      chart: dailySales(orders, range),
    };
  }, [orders, period]);

  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();
  const prevLabel =
    period === "hoy" ? "ayer" : period === "ayer" ? "antier" : `${periodLabel} anterior`;

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold text-ink">Inicio</h1>
          <p className="mt-1 text-[13px] text-ink2">
            Resumen de ventas, gastos y ganancia del negocio
          </p>
        </div>

        {/* Filtro de período */}
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1 shadow-soft">
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-pink text-white shadow-sm"
                    : "text-ink2 hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tarjetas principales: Ventas, Gastos, Ganancia */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <BigCard
          icon={<TrendingUp size={26} />}
          label="Ventas"
          value={bs2(stats.ventas)}
          hint={`Ingresos de ${periodLabel}`}
          color="#E8366B"
          delta={delta(stats.ventas, prev.ventas)}
          prevLabel={prevLabel}
        />
        <BigCard
          icon={<TrendingDown size={26} />}
          label="Gastos"
          value={bs2(stats.gastos)}
          hint="Mercadería y entregas"
          color="#F76F9C"
          delta={delta(stats.gastos, prev.gastos)}
          prevLabel={prevLabel}
          invert
        />
        <BigCard
          icon={<Wallet size={26} />}
          label="Ganancia"
          value={bs2(stats.ganancia)}
          hint={`Margen ${stats.margen.toFixed(0)}%`}
          color="#2EA66B"
          delta={delta(stats.ganancia, prev.ganancia)}
          prevLabel={prevLabel}
        />
      </div>

      {/* Mini-gráfico de ventas por día */}
      {chart.length > 1 && (
        <div className="mt-4 rounded-[20px] border border-line bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-ink">Ventas por día</h3>
            <span className="text-[12px] text-faint">Últimos {chart.length} días</span>
          </div>
          <SalesBars data={chart} />
        </div>
      )}

      {/* Tarjetas secundarias */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <SmallCard
          icon={<ShoppingBag size={20} />}
          label="Pedidos"
          value={`${stats.pedidos}`}
          color="#3B6FD4"
        />
        <SmallCard
          icon={<ReceiptText size={20} />}
          label="Ticket promedio"
          value={bs2(stats.ticket)}
          color="#8B5CF6"
        />
        <SmallCard
          icon={<Coins size={20} />}
          label="Margen"
          value={`${stats.margen.toFixed(0)}%`}
          color="#E8A33D"
        />
      </div>

      <p className="mt-5 text-[11.5px] text-faint">
        Los gastos son una estimación (costo de mercadería {Math.round(COST_RATIO * 100)}% + entregas).
        Se ajustarán con los datos reales de la base de datos.
      </p>
    </div>
  );
}

function BigCard({
  icon,
  label,
  value,
  hint,
  color,
  delta,
  prevLabel,
  invert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  color: string;
  delta: number | null;
  prevLabel: string;
  /** true para métricas donde subir es negativo (ej. gastos). */
  invert?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-line bg-surface p-6 shadow-soft">
      <div className="flex items-start justify-between">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-white"
          style={{
            background: `linear-gradient(140deg, ${color}, ${color}cc)`,
            boxShadow: `0 12px 24px ${color}44`,
          }}
        >
          {icon}
        </span>
        <DeltaBadge delta={delta} invert={invert} title={`vs ${prevLabel}`} />
      </div>
      <p className="mt-5 text-[32px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-2.5 text-[14px] font-semibold text-ink2">{label}</p>
      <p className="mt-0.5 text-[12px] text-faint">{hint}</p>
    </div>
  );
}

function DeltaBadge({
  delta,
  invert,
  title,
}: {
  delta: number | null;
  invert: boolean;
  title: string;
}) {
  if (delta === null) return null;
  const flat = Math.abs(delta) < 0.5;
  const positive = delta > 0;
  // "Bueno" = sube y no está invertido, o baja y está invertido.
  const good = flat ? null : positive !== invert;
  const tone =
    good === null
      ? { bg: "#6B72801a", fg: "#6B7280" }
      : good
      ? { bg: "#2EA66B1a", fg: "#1F9257" }
      : { bg: "#E8366B1a", fg: "#D81B60" };
  const arrow = flat ? "→" : positive ? "↑" : "↓";
  return (
    <span
      title={title}
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span>{arrow}</span>
      <span>{Math.abs(delta).toFixed(0)}%</span>
    </span>
  );
}

function SalesBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="mt-5 flex h-[150px] items-end gap-1.5">
      {data.map((d, i) => {
        const has = d.value > 0;
        return (
          <div
            key={i}
            className="group flex flex-1 flex-col items-center justify-end"
            title={`Día ${d.label}: ${bs2(d.value)}`}
          >
            <div
              className="w-full rounded-t-md transition-colors"
              style={{
                height: `${has ? Math.max(6, (d.value / max) * 118) : 3}px`,
                background: has
                  ? "linear-gradient(180deg,#F76F9C,#E8366B)"
                  : "#EBE3E7",
              }}
            />
            {data.length <= 14 && (
              <span className="mt-1.5 text-[10px] font-medium text-faint">{d.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SmallCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-[16px] border border-line bg-surface p-4 shadow-soft">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
        style={{
          background: `linear-gradient(140deg, ${color}, ${color}cc)`,
          boxShadow: `0 8px 16px ${color}33`,
        }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[22px] font-bold leading-none text-ink">{value}</p>
        <p className="mt-1.5 text-[12.5px] text-ink2">{label}</p>
      </div>
    </div>
  );
}
