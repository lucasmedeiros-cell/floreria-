"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Boxes,
  ChevronRight,
  Info,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  TrendingUp,
} from "lucide-react";
import { useBusiness } from "@/context/StoreProvider";
import { apiReports } from "@/lib/reportsClient";
import { apiListPurchaseOrders, type PurchaseOrder } from "@/lib/purchaseClient";
import { apiListSales, type SaleRow } from "@/lib/salesClient";
import { bs2 } from "@/lib/products";

/**
 * Secciones a las que el Resumen puede mandar. Es un subconjunto del `Section`
 * de AdminShell: acá no se llega ni a Configuración ni a Usuarios.
 */
export type InicioSection =
  | "venta"
  | "catalogo"
  | "historial"
  | "proveedor"
  | "gastos"
  | "caja"
  | "reportes";

/** Períodos del panel. El rango siempre termina en la fecha elegida. */
type Periodo = "hoy" | "semana" | "mes" | "anio";

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "anio", label: "Año" },
];

/** `Date` → `YYYY-MM-DD` en hora local (no UTC: `toISOString` corre el día). */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` → `Date` local (parsear la cadena a secas la lee como UTC). */
function fromIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Rango del período que termina en `hasta`, y el rango INMEDIATAMENTE anterior
 * del mismo largo — que es contra el que se compara para decir si se vendió más
 * o menos que antes.
 */
function rango(periodo: Periodo, hasta: string): {
  desde: string;
  hasta: string;
  previo: { desde: string; hasta: string };
  etiqueta: string;
} {
  const fin = fromIso(hasta);
  const dias = periodo === "hoy" ? 1 : periodo === "semana" ? 7 : periodo === "mes" ? 30 : 365;
  const ini = new Date(fin);
  ini.setDate(fin.getDate() - (dias - 1));
  const prevFin = new Date(ini);
  prevFin.setDate(ini.getDate() - 1);
  const prevIni = new Date(prevFin);
  prevIni.setDate(prevFin.getDate() - (dias - 1));
  return {
    desde: iso(ini),
    hasta: iso(fin),
    previo: { desde: iso(prevIni), hasta: iso(prevFin) },
    etiqueta:
      periodo === "hoy"
        ? "Ventas hoy"
        : periodo === "semana"
          ? "Ventas de la semana"
          : periodo === "mes"
            ? "Ventas del mes"
            : "Ventas del año",
  };
}

/** Fecha de una venta o pedido en corto: "Hoy, 10:23", "Ayer, 16:40", "12/07". */
function cuando(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (iso(d) === iso(hoy)) return `Hoy, ${hora}`;
  if (iso(d) === iso(ayer)) return `Ayer, ${hora}`;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}, ${hora}`;
}

/** Cada cuánto se vuelven a pedir los datos (el panel dice "En vivo"). */
const REFRESCO_MS = 60_000;

/**
 * Resumen general — el panel comercial con el que arranca el CRM: lo vendido en
 * el período elegido, el estado del inventario, el acceso a la venta nueva, la
 * actividad reciente y las alertas que hay que atender.
 *
 * Todo sale de la base del negocio y se refresca solo cada minuto; nada de esto
 * son números de ejemplo.
 */
export function InicioScreen({ onGo }: { onGo: (s: InicioSection) => void }) {
  const business = useBusiness();

  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [fecha, setFecha] = useState(() => iso(new Date()));
  const [loading, setLoading] = useState(true);

  const [productos, setProductos] = useState(0);
  const [stockBajo, setStockBajo] = useState(0);
  const [ventas, setVentas] = useState(0);
  const [numVentas, setNumVentas] = useState(0);
  const [ventasPrevias, setVentasPrevias] = useState(0);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [pedidos, setPedidos] = useState<PurchaseOrder[]>([]);

  const r = useMemo(() => rango(periodo, fecha), [periodo, fecha]);

  const cargar = useCallback(
    async (alive: () => boolean) => {
      try {
        const [todo, actual, previo] = await Promise.all([
          apiReports(),
          apiReports({ desde: r.desde, hasta: r.hasta }),
          apiReports({ desde: r.previo.desde, hasta: r.previo.hasta }),
        ]);
        if (alive()) {
          setProductos(todo.totalProductos);
          setStockBajo(todo.stockBajo);
          setVentas(actual.totalVentas);
          setNumVentas(actual.numVentas);
          setVentasPrevias(previo.totalVentas);
        }
      } catch {
        /* sin datos */
      }
      try {
        const list = await apiListSales();
        if (alive()) setSales(list);
      } catch {
        /* sin datos */
      }
      try {
        const pos = await apiListPurchaseOrders();
        if (alive()) setPedidos(pos);
      } catch {
        /* sin datos */
      }
      if (alive()) setLoading(false);
    },
    [r.desde, r.hasta, r.previo.desde, r.previo.hasta]
  );

  useEffect(() => {
    let vivo = true;
    const alive = () => vivo;
    cargar(alive);
    const t = setInterval(() => cargar(alive), REFRESCO_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [cargar]);

  const pendientes = pedidos.filter((p) => p.status === "solicitado").length;
  const dato = (v: string) => (loading ? "—" : v);

  // Variación de ventas contra el período anterior. Sin ventas antes no hay
  // porcentaje que calcular: se muestra el alta como "nuevo", no un 100% falso.
  const variacion =
    ventasPrevias > 0 ? Math.round(((ventas - ventasPrevias) / ventasPrevias) * 100) : null;

  /** Ventas del rango, para la curvita de la tarjeta. */
  const serie = useMemo(() => {
    const desde = fromIso(r.desde).getTime();
    const hasta = fromIso(r.hasta).getTime() + 86_400_000;
    const dentro = sales
      .filter((s) => !s.voided && s.kind === "factura")
      .map((s) => ({ t: new Date(s.createdAt).getTime(), total: s.total }))
      .filter((s) => s.t >= desde && s.t < hasta)
      .sort((a, b) => a.t - b.t);
    if (dentro.length === 0) return [];
    const N = 12;
    const paso = (hasta - desde) / N;
    const buckets = Array.from({ length: N }, () => 0);
    for (const s of dentro) {
      const i = Math.min(N - 1, Math.floor((s.t - desde) / paso));
      buckets[i] += s.total;
    }
    return buckets;
  }, [sales, r.desde, r.hasta]);

  /** Actividad reciente: ventas y pedidos mezclados, lo último primero. */
  const actividad = useMemo(() => {
    const deVentas = sales.slice(0, 8).map((s) => ({
      t: new Date(s.createdAt).getTime(),
      icon: <ShoppingCart size={17} />,
      titulo: s.voided ? "Venta anulada" : "Venta registrada",
      detalle: `${s.kind === "proforma" ? "Proforma" : "Venta"} #${s.code}`,
      valor: bs2(s.total),
      cuando: cuando(s.createdAt),
    }));
    const dePedidos = pedidos.slice(0, 8).map((p) => ({
      t: new Date(p.receivedAt ?? p.createdAt).getTime(),
      icon: <Truck size={17} />,
      titulo:
        p.status === "recibido"
          ? "Pedido recibido"
          : p.status === "cancelado"
            ? "Pedido cancelado"
            : "Pedido solicitado",
      detalle: `Proveedor: ${p.supplier}`,
      valor: `#${p.code}`,
      cuando: cuando(p.receivedAt ?? p.createdAt),
    }));
    return [...deVentas, ...dePedidos].sort((a, b) => b.t - a.t).slice(0, 3);
  }, [sales, pedidos]);

  const alertas = stockBajo > 0 ? 1 : 0;
  const avisos = alertas + (pendientes > 0 ? 1 : 0);

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-10 pt-6 sm:px-8">
        {/* ---------- Título y controles del período ---------- */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[27px] font-extrabold leading-none tracking-[-0.4px] text-ink">
              Resumen general
            </h1>
            <p className="mt-1.5 text-[13px] text-ink2">
              Panel comercial · {fromIso(fecha).toLocaleDateString("es-BO")} ·{" "}
              <span className="font-semibold text-success">
                <span className="pulse-soft">●</span> En vivo
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 rounded-[12px] border border-line bg-surface p-1">
              {PERIODOS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={`rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                    periodo === p.id ? "bg-pink text-onAccent" : "text-ink2 hover:text-ink"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value || iso(new Date()))}
              className="h-[42px] rounded-[12px] border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink outline-none focus:border-pink"
            />
            <button
              onClick={() => onGo("catalogo")}
              aria-label="Alertas"
              className="relative grid h-[42px] w-[42px] place-items-center rounded-[12px] border border-line bg-surface text-ink2 hover:text-ink"
            >
              <Bell size={19} />
              {avisos > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-pink px-1 text-[10px] font-bold text-onAccent">
                  {avisos}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ---------- Vistazo ---------- */}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <KpiCard
            icon={<TrendingUp size={24} />}
            tone="#F5A800"
            label={r.etiqueta}
            value={dato(bs2(ventas))}
            onClick={() => onGo("historial")}
            extra={<Sparkline data={serie} />}
            chip={
              variacion === null
                ? { text: numVentas === 1 ? "1 venta" : `${numVentas} ventas`, tone: "neutral" }
                : {
                    text: `${variacion >= 0 ? "↑" : "↓"} ${Math.abs(variacion)}%`,
                    tone: variacion >= 0 ? "up" : "down",
                  }
            }
          />
          <KpiCard
            icon={<Boxes size={24} />}
            tone="#2EA66B"
            label="Productos"
            value={dato(`${productos}`)}
            onClick={() => onGo("catalogo")}
            chip={{ text: "En el catálogo", tone: "up" }}
          />
          <KpiCard
            icon={<AlertTriangle size={24} />}
            tone="#E0324E"
            label="Stock bajo"
            value={dato(`${stockBajo}`)}
            onClick={() => onGo("catalogo")}
            chip={{
              text: stockBajo > 0 ? "Hay que reponer" : "Todo en orden",
              tone: stockBajo > 0 ? "down" : "up",
            }}
          />
        </div>

        {/* ---------- Acción principal ---------- */}
        <button
          onClick={() => onGo("venta")}
          className="mt-4 flex w-full items-center gap-5 overflow-hidden rounded-[18px] px-6 py-5 text-left text-onAccent transition-transform hover:-translate-y-0.5"
          style={{ background: "linear-gradient(100deg,#FFC93C 0%,#FEBB03 45%,#F0A400 100%)" }}
        >
          <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full bg-onAccent/10">
            <ShoppingCart size={28} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[20px] font-extrabold leading-tight">Nueva venta</span>
            <span className="mt-0.5 block text-[13px] font-medium opacity-75">
              Crear y procesar una venta rápidamente
            </span>
          </span>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-onAccent/10">
            <ChevronRight size={24} />
          </span>
        </button>

        {/* ---------- Actividad y alertas ---------- */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel
            icon={<Receipt size={18} />}
            title="Actividad reciente"
            action={{ label: "Ver todo", onClick: () => onGo("historial") }}
          >
            {actividad.length === 0 ? (
              <Vacio texto={loading ? "Cargando…" : "Todavía no hay movimientos."} />
            ) : (
              actividad.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pinkSoft text-ink">
                    {a.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">
                      {a.titulo}
                    </span>
                    <span className="block truncate text-[12px] text-ink2">{a.detalle}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-bold text-ink">{a.valor}</span>
                    <span className="block text-[11.5px] text-faint">{a.cuando}</span>
                  </span>
                </div>
              ))
            )}
          </Panel>

          <Panel
            icon={<AlertTriangle size={18} />}
            title="Alertas y notificaciones"
            action={{ label: "Ver todas", onClick: () => onGo("catalogo") }}
          >
            <Alerta
              n={stockBajo}
              tone={stockBajo > 0 ? "#E0324E" : "#2EA66B"}
              title="Productos con stock crítico"
              text={
                stockBajo > 0
                  ? "Revisa y repón inventario para evitar quiebres."
                  : "No hay productos por reponer."
              }
              onClick={() => onGo("catalogo")}
            />
            <Alerta
              n={pendientes}
              tone={pendientes > 0 ? "#F5A800" : "#2EA66B"}
              title="Pedidos pendientes"
              text={
                pendientes > 0
                  ? "Tienes mercadería pedida por recibir."
                  : "No hay pedidos pendientes por recibir."
              }
              onClick={() => onGo("proveedor")}
            />
          </Panel>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-[12.5px] text-faint">
          <Info size={15} /> Los datos de {business.name} se actualizan solos cada minuto.
        </p>
      </div>
    </div>
  );
}

/* ============================ Piezas ============================ */

function KpiCard({
  icon,
  tone,
  label,
  value,
  chip,
  extra,
  onClick,
}: {
  icon: React.ReactNode;
  /** Color del ícono y del acento de la tarjeta. */
  tone: string;
  label: string;
  value: string;
  chip?: { text: string; tone: "up" | "down" | "neutral" };
  extra?: React.ReactNode;
  onClick?: () => void;
}) {
  const chipCls =
    chip?.tone === "up"
      ? "bg-success/10 text-success"
      : chip?.tone === "down"
        ? "bg-error/10 text-error"
        : "bg-ink/[0.06] text-ink2";
  return (
    <button
      onClick={onClick}
      className="rounded-[18px] border border-line bg-surface p-5 text-left shadow-card transition-transform hover:-translate-y-0.5"
      style={{ borderTopColor: tone }}
    >
      <div className="flex items-center gap-4">
        <span
          className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full"
          style={{ background: `${tone}1F`, color: tone }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold text-ink2">{label}</p>
          <p className="mt-1 truncate text-[27px] font-extrabold leading-none text-ink">{value}</p>
        </div>
        {extra}
      </div>
      {chip && (
        <span
          className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold ${chipCls}`}
        >
          {chip.text}
        </span>
      )}
    </button>
  );
}

/** Curvita de ventas del período. Sin ventas no dibuja nada (no una línea plana falsa). */
function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const puntos = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${28 - (v / max) * 26}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="hidden h-[34px] w-[92px] shrink-0 sm:block"
      aria-hidden
    >
      <polyline
        points={puntos}
        fill="none"
        stroke="#F5A800"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Panel({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pinkSoft text-ink">
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{title}</h2>
        {action && (
          <button
            onClick={action.onClick}
            className="shrink-0 rounded-[10px] border border-line px-3.5 py-2 text-[12px] font-semibold text-ink2 hover:text-ink"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="mt-2 divide-y divide-line">{children}</div>
    </div>
  );
}

function Alerta({
  n,
  tone,
  title,
  text,
  onClick,
}: {
  n: number;
  tone: string;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[16px] font-extrabold"
        style={{ background: `${tone}1F`, color: tone }}
      >
        {n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="block truncate text-[12px] text-ink2">{text}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-faint" />
    </button>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Package size={26} className="text-faint" />
      <p className="text-[12.5px] text-ink2">{texto}</p>
    </div>
  );
}
