"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Package,
  PackageX,
  Plus,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserRoundPlus,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/context/StoreProvider";
import { apiReports, type ReportTop } from "@/lib/reportsClient";
import { apiListPurchaseOrders, type PurchaseOrder } from "@/lib/purchaseClient";
import { apiListSales, type SaleRow } from "@/lib/salesClient";
import { bs2 } from "@/lib/products";
import { IconTile } from "./kit";

/**
 * Secciones a las que el Resumen puede mandar. Es un subconjunto del `Section`
 * de AdminShell: acá no se llega ni a Configuración ni a Usuarios.
 */
export type InicioSection =
  | "venta"
  | "clientes"
  | "catalogo"
  | "proveedor"
  | "historial"
  | "reportes";

/** Períodos del panel. El rango siempre termina en la fecha elegida. */
type Periodo = "hoy" | "semana" | "mes" | "anio";

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "anio", label: "Año" },
];

/** Cómo se nombra el período en el título de una tarjeta ("Ventas hoy"). */
const SUFIJO: Record<Periodo, string> = {
  hoy: "hoy",
  semana: "de la semana",
  mes: "del mes",
  anio: "del año",
};

/** Contra qué se compara ("0% vs ayer"). */
const CONTRA: Record<Periodo, string> = {
  hoy: "vs ayer",
  semana: "vs semana anterior",
  mes: "vs mes anterior",
  anio: "vs año anterior",
};

/** Colores de las cuatro tarjetas de arriba. */
const TONO = {
  ventas: "#F5A800",
  utilidad: "#2EA66B",
  unidades: "#3E7BFA",
  stock: "#E0324E",
} as const;

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
  };
}

/**
 * Variación porcentual contra el período anterior. `null` cuando antes no hubo
 * nada con qué comparar: ahí el alta es "nuevo", no un 100% inventado.
 */
function variacion(actual: number, previo: number): number | null {
  if (previo === 0) return actual === 0 ? 0 : null;
  return Math.round(((actual - previo) / previo) * 100);
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

/** "01 Agosto 2026" — la fecha del panel, escrita como en el diseño. */
function fechaLarga(s: string): string {
  const d = fromIso(s);
  const mes = d.toLocaleDateString("es-BO", { month: "long" });
  return `${String(d.getDate()).padStart(2, "0")} ${mes[0].toUpperCase()}${mes.slice(1)} ${d.getFullYear()}`;
}

/** Cada cuánto se vuelven a pedir los datos (el panel dice "En vivo"). */
const REFRESCO_MS = 60_000;

/**
 * Resumen general — el panel comercial con el que arranca el CRM: lo vendido y
 * lo ganado en el período elegido, las unidades que salieron, el stock que hay
 * que atender, los accesos del día y qué se movió último.
 *
 * Todo sale de la base del negocio y se refresca solo cada minuto; nada de esto
 * son números de ejemplo.
 */
export function InicioScreen({
  onGo,
}: {
  onGo: (s: InicioSection, intent?: "nuevo") => void;
}) {
  const auth = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [fecha, setFecha] = useState(() => iso(new Date()));
  const [loading, setLoading] = useState(true);

  const [stockBajo, setStockBajo] = useState(0);
  const [sinStock, setSinStock] = useState(0);
  const [ventas, setVentas] = useState(0);
  const [utilidad, setUtilidad] = useState(0);
  const [unidades, setUnidades] = useState(0);
  const [ventasPrev, setVentasPrev] = useState(0);
  const [utilidadPrev, setUtilidadPrev] = useState(0);
  const [unidadesPrev, setUnidadesPrev] = useState(0);
  const [serie, setSerie] = useState<{ total: number; utilidad: number }[]>([]);
  const [top, setTop] = useState<ReportTop[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [pedidos, setPedidos] = useState<PurchaseOrder[]>([]);

  const r = useMemo(() => rango(periodo, fecha), [periodo, fecha]);

  const cargar = useCallback(
    async (alive: () => boolean) => {
      try {
        const [actual, previo] = await Promise.all([
          apiReports({ desde: r.desde, hasta: r.hasta }),
          apiReports({ desde: r.previo.desde, hasta: r.previo.hasta }),
        ]);
        if (alive()) {
          // El conteo de stock no depende del rango: viene igual en los dos.
          setStockBajo(actual.stockBajo);
          setSinStock(actual.sinStock);
          setVentas(actual.totalVentas);
          setUtilidad(actual.ganancia);
          setUnidades(actual.unidadesVendidas);
          setVentasPrev(previo.totalVentas);
          setUtilidadPrev(previo.ganancia);
          setUnidadesPrev(previo.unidadesVendidas);
          setTop(actual.topProductos);
          setSerie(
            actual.porMes.map((m) => ({ total: m.total, utilidad: m.total - m.costo }))
          );
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

  /** Saludo por hora del día, con el nombre de pila de quien está adentro. */
  const saludo = useMemo(() => {
    const h = new Date().getHours();
    const hora = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
    const pila = auth.name.trim().split(" ").filter(Boolean)[0];
    return pila ? `${hora}, ${pila}.` : `${hora}.`;
  }, [auth.name]);

  /** Actividad reciente: ventas y pedidos mezclados, lo último primero. */
  const actividad = useMemo(() => {
    const deVentas = sales.slice(0, 8).map((s) => ({
      t: new Date(s.createdAt).getTime(),
      icon: <ShoppingCart size={17} />,
      tono: s.voided ? TONO.stock : TONO.ventas,
      titulo: s.voided ? "Venta anulada" : "Venta realizada",
      valor: bs2(s.total),
      cuando: cuando(s.createdAt),
    }));
    const dePedidos = pedidos.slice(0, 8).map((p) => ({
      t: new Date(p.receivedAt ?? p.createdAt).getTime(),
      icon: <Truck size={17} />,
      tono: p.status === "cancelado" ? TONO.stock : TONO.utilidad,
      titulo:
        p.status === "recibido"
          ? "Compra ingresada"
          : p.status === "cancelado"
            ? "Compra cancelada"
            : "Compra solicitada",
      valor: `#${p.code}`,
      cuando: cuando(p.receivedAt ?? p.createdAt),
    }));
    return [...deVentas, ...dePedidos].sort((a, b) => b.t - a.t).slice(0, 4);
  }, [sales, pedidos]);

  /** Top productos del período, con su peso dentro de esa lista. */
  const ranking = useMemo(() => {
    const lista = top.slice(0, 4);
    const suma = lista.reduce((s, t) => s + t.revenue, 0);
    if (suma <= 0) return [];
    const conPct = lista.map((t) => ({ ...t, pct: Math.round((t.revenue / suma) * 100) }));
    const mayor = Math.max(...conPct.map((t) => t.pct), 1);
    return conPct.map((t) => ({ ...t, barra: Math.round((t.pct / mayor) * 100) }));
  }, [top]);

  const avisos = (stockBajo > 0 ? 1 : 0) + (pendientes > 0 ? 1 : 0);

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-10 pt-6 sm:px-8">
        {/* ---------- Saludo y controles del período ---------- */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.6px] text-ink">
              {saludo}
            </h1>
            <p className="mt-2 text-[13px] text-ink2">
              {fechaLarga(fecha)}
              <span className="px-2 text-faint">•</span>
              <span className="font-semibold text-success">
                <span className="pulse-soft">●</span> En vivo
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onGo("venta")}
              className="flex h-[46px] items-center gap-2 rounded-[14px] border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-pink"
            >
              <Plus size={18} className="text-pink" /> Nueva venta
            </button>

            <div className="flex h-[46px] items-center gap-1 rounded-[14px] border border-line bg-surface p-1">
              {PERIODOS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={`rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
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
              className="h-[46px] rounded-[14px] border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink outline-none focus:border-pink"
            />

            <button
              onClick={() => onGo("catalogo")}
              aria-label="Alertas"
              className="relative grid h-[46px] w-[46px] place-items-center rounded-[14px] border border-line bg-surface text-ink2 transition-colors hover:text-ink"
            >
              <Bell size={19} />
              {avisos > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-[20px] min-w-[20px] place-items-center rounded-full bg-pink px-1 text-[10.5px] font-bold text-onAccent">
                  {avisos}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ---------- Vistazo ---------- */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<TrendingUp size={26} />}
            tone={TONO.ventas}
            label={`Ventas ${SUFIJO[periodo]}`}
            value={dato(bs2(ventas))}
            nota={<Comparacion tone={TONO.ventas} v={variacion(ventas, ventasPrev)} periodo={periodo} />}
            extra={<Sparkline data={serie.map((s) => s.total)} tone={TONO.ventas} />}
            onClick={() => onGo("historial")}
          />
          <KpiCard
            icon={<Wallet size={26} />}
            tone={TONO.utilidad}
            label={`Utilidad ${SUFIJO[periodo]}`}
            value={dato(bs2(utilidad))}
            nota={
              <Comparacion tone={TONO.utilidad} v={variacion(utilidad, utilidadPrev)} periodo={periodo} />
            }
            extra={<Sparkline data={serie.map((s) => s.utilidad)} tone={TONO.utilidad} />}
            onClick={() => onGo("reportes")}
          />
          <KpiCard
            icon={<ShoppingBag size={26} />}
            tone={TONO.unidades}
            label="Productos vendidos"
            value={dato(`${unidades}`)}
            nota={
              <Comparacion tone={TONO.unidades} v={variacion(unidades, unidadesPrev)} periodo={periodo} />
            }
            onClick={() => onGo("reportes")}
          />
          <KpiCard
            icon={<AlertTriangle size={26} />}
            tone={TONO.stock}
            label="Stock crítico"
            value={dato(`${stockBajo}`)}
            nota={<span className="text-[12.5px] text-ink2">productos</span>}
            extra={
              sinStock > 0 ? (
                <span
                  title={`${sinStock} ${sinStock === 1 ? "producto ya está" : "productos ya están"} en cero`}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-error/[0.12] px-2.5 py-1 text-[11.5px] font-bold text-error"
                >
                  <PackageX size={13} /> {sinStock}
                </span>
              ) : null
            }
            onClick={() => onGo("catalogo")}
          />
        </div>

        {/* ---------- Accesos del día ---------- */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Acceso
            icon={<ShoppingBag size={24} />}
            tone={TONO.ventas}
            title="Registrar compra"
            subtitle="Ingresar mercadería de un proveedor"
            onClick={() => onGo("proveedor", "nuevo")}
          />
          <Acceso
            icon={<UserRoundPlus size={24} />}
            tone={TONO.ventas}
            title="Nuevo cliente"
            subtitle="Agregar un cliente a la libreta"
            onClick={() => onGo("clientes", "nuevo")}
          />
        </div>

        {/* ---------- Actividad y ranking ---------- */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel
            title="Actividad reciente"
            action={{ label: "Ver todo", onClick: () => onGo("historial") }}
          >
            {actividad.length === 0 ? (
              <Vacio texto={loading ? "Cargando…" : "Todavía no hay movimientos."} />
            ) : (
              actividad.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                    style={{ background: `${a.tono}1F`, color: a.tono }}
                  >
                    {a.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                    {a.titulo}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-ink2">{a.valor}</span>
                  <span className="w-[86px] shrink-0 text-right text-[12.5px] text-faint">
                    {a.cuando}
                  </span>
                </div>
              ))
            )}
          </Panel>

          <Panel
            title="Top productos"
            action={{ label: "Ver todo", onClick: () => onGo("reportes") }}
          >
            {ranking.length === 0 ? (
              <Vacio
                texto={loading ? "Cargando…" : "Sin ventas en el período: no hay ranking."}
              />
            ) : (
              ranking.map((t, i) => (
                <div key={t.name} className="flex items-start gap-3 py-2.5">
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold ${
                      i === 0 ? "bg-pinkSoft text-ink" : "bg-surface2 text-ink2"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                        {t.name}
                      </span>
                      <span className="shrink-0 text-[13px] font-bold text-ink">{t.pct}%</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink2">
                      {t.qty} {t.qty === 1 ? "unidad" : "unidades"}
                    </span>
                    <span className="mt-2 block h-[5px] w-full overflow-hidden rounded-full bg-surface2">
                      <span
                        className="block h-full rounded-full bg-pink"
                        style={{ width: `${t.barra}%` }}
                      />
                    </span>
                  </span>
                </div>
              ))
            )}
          </Panel>
        </div>
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
  nota,
  extra,
  onClick,
}: {
  icon: ReactNode;
  /** Color del ícono y del acento de la tarjeta. */
  tone: string;
  label: string;
  value: string;
  /** Renglón de abajo a la izquierda (la comparación o la unidad). */
  nota: ReactNode;
  /** Lo que va abajo a la derecha (la curvita o una chip). */
  extra?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-[20px] border border-line bg-surface p-5 text-left shadow-card transition-transform hover:-translate-y-0.5"
    >
      <span className="flex items-start gap-3.5">
        <IconTile icon={icon} tone={tone} size={56} />
        <span className="min-w-0 flex-1 pt-1">
          <span className="block truncate text-[14px] font-semibold text-ink2">{label}</span>
          <span className="mt-2 block truncate text-[27px] font-extrabold leading-none text-ink">
            {value}
          </span>
        </span>
      </span>
      <span className="mt-4 flex min-h-[26px] items-center gap-2">
        {nota}
        <span className="flex-1" />
        {extra}
      </span>
    </button>
  );
}

/** "0% vs ayer" — cuánto se movió el dato contra el período anterior. */
function Comparacion({
  tone,
  v,
  periodo,
}: {
  tone: string;
  v: number | null;
  periodo: Periodo;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink2">
      <span
        className="h-[9px] w-[9px] shrink-0 rounded-full"
        style={{ background: tone }}
        aria-hidden
      />
      <span className="truncate">
        {v === null ? "sin período previo" : `${v > 0 ? "+" : ""}${v}% ${CONTRA[periodo]}`}
      </span>
    </span>
  );
}

/** Curvita del período. Sin movimiento no dibuja nada (no una línea plana falsa). */
function Sparkline({ data, tone }: { data: number[]; tone: string }) {
  if (data.length < 2 || data.every((v) => v === 0)) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const alto = max - min || 1;
  const puntos = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${26 - ((v - min) / alto) * 24}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="h-[26px] w-[74px] shrink-0"
      aria-hidden
    >
      <polyline
        points={puntos}
        fill="none"
        stroke={tone}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Tarjeta ancha de acceso directo (registrar compra, nuevo cliente). */
function Acceso({
  icon,
  tone,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 rounded-[20px] border border-line bg-surface p-5 text-left shadow-card transition-transform hover:-translate-y-0.5"
    >
      <span
        className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full"
        style={{ background: `${tone}1F`, color: tone }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-ink2">{subtitle}</span>
      </span>
      <ChevronRight size={22} className="shrink-0 text-faint" />
    </button>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-bold text-ink">{title}</h2>
        {action && (
          <button
            onClick={action.onClick}
            className="shrink-0 rounded-[10px] border border-line px-3 py-1.5 text-[12px] font-semibold text-ink2 transition-colors hover:text-ink"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Package size={26} className="text-faint" />
      <p className="text-[12.5px] text-ink2">{texto}</p>
    </div>
  );
}
