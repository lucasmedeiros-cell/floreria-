"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Inbox,
  LineChart,
  Receipt,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { bs2 } from "@/lib/products";
import { useBusiness, useToast } from "@/context/StoreProvider";
import { exportComprobante } from "@/lib/comprobante";
import { IconTile } from "./kit";
import {
  apiGetSale,
  apiListSales,
  apiVoidSale,
  type SaleDetail,
  type SaleKind,
  type SaleRow,
} from "@/lib/salesClient";

/** Filtros de la parte de arriba (los mismos que ofrece la API). */
const FILTROS: { id: "todo" | SaleKind; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "factura", label: "Facturas" },
  { id: "proforma", label: "Proformas" },
];

function fmt(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

/**
 * Historial de ventas — todo lo que se cobró y se cotizó, lo más reciente
 * arriba. Es la contraparte de Venta: acá se busca un comprobante viejo, se
 * vuelve a imprimir y, si hubo un error, se ANULA.
 *
 * Anular una factura devuelve el stock al inventario (lo hace el backend en una
 * transacción). La venta no se borra: queda tachada, para que el historial
 * siga contando lo que de verdad pasó.
 */
export function HistorialPage() {
  const { showToast } = useToast();
  const [filtro, setFiltro] = useState<"todo" | SaleKind>("todo");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ver, setVer] = useState<SaleDetail | null>(null);
  const [anular, setAnular] = useState<SaleRow | null>(null);

  const load = async (kind: "todo" | SaleKind) => {
    setLoading(true);
    try {
      setRows(await apiListSales(kind === "todo" ? undefined : kind));
      setErr(null);
    } catch {
      setErr("No se pudo cargar el historial de ventas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filtro);
  }, [filtro]);

  // Total del listado, sin contar las anuladas (que ya no son plata).
  const total = useMemo(
    () => rows.filter((r) => !r.voided && r.kind === "factura").reduce((a, r) => a + r.total, 0),
    [rows]
  );

  /** Últimos comprobantes registrados y últimos cobros, para los dos paneles. */
  const recientes = useMemo(() => rows.slice(0, 3), [rows]);
  const movimientos = useMemo(
    () => rows.filter((r) => !r.voided && r.kind === "factura").slice(0, 3),
    [rows]
  );

  const abrir = async (id: string) => {
    try {
      setVer(await apiGetSale(id));
    } catch {
      showToast("No se pudo abrir la venta.");
    }
  };

  const nFacturas = rows.filter((r) => r.kind === "factura" && !r.voided).length;
  const nProformas = rows.filter((r) => r.kind === "proforma" && !r.voided).length;
  const nAnuladas = rows.filter((r) => r.voided).length;

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-10 pt-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[27px] font-extrabold leading-none tracking-[-0.4px] text-ink">
              Historial
            </h1>
            <p className="mt-1.5 text-[13px] text-ink2">
              Ventas y proformas. Anular una factura devuelve el stock.
            </p>
          </div>
          {/* Lo facturado del listado: es el número que se viene a mirar. */}
          <div
            className="relative flex items-center gap-4 overflow-hidden rounded-[18px] border-2 bg-surface px-5 py-3.5 shadow-card"
            style={{ borderColor: "#FEBB0355" }}
          >
            <Sparkles size={15} className="absolute right-3 top-2.5 text-pink" />
            <IconTile icon={<Receipt size={26} />} tone="#C88600" size={54} />
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-[2px] text-ink2">
                Facturado
              </span>
              <span className="mt-1 block text-[25px] font-extrabold leading-none text-ink">
                {bs2(total)}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded-full px-5 py-2.5 text-[13px] font-bold transition-colors ${
                filtro === f.id
                  ? "bg-pink text-onAccent"
                  : "border border-line bg-surface text-ink2 hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cuántos comprobantes hay de cada tipo. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ConteoCard icon={<FileText size={24} />} tone="#F5A800" label="Facturas" n={nFacturas} />
          <ConteoCard icon={<FileText size={24} />} tone="#3B6FD4" label="Proformas" n={nProformas} />
          <ConteoCard icon={<XCircle size={24} />} tone="#E0324E" label="Anuladas" n={nAnuladas} />
        </div>

      {err && (
        <div className="mt-5 rounded-[14px] border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
          {err}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-[18px] border border-line bg-surface shadow-card">
        {loading ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink2">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="relative overflow-hidden px-5 py-16 text-center">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(rgb(var(--c-faint)) 1.2px, transparent 1.2px)",
                backgroundSize: "10px 10px",
                opacity: 0.13,
              }}
            />
            <span className="relative mx-auto grid h-[110px] w-[110px] place-items-center rounded-full bg-pinkSoft text-ink2">
              <Receipt size={46} />
            </span>
            <p className="relative mt-5 text-[19px] font-extrabold text-ink">
              Todavía no hay ventas.
            </p>
            <p className="relative mt-1.5 text-[13px] text-ink2">
              Lo que cobres en Ventas aparece acá al instante.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-3 text-left font-semibold">Código</th>
                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                <th className="px-4 py-3 text-center font-semibold">Ítems</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-left font-semibold">Método</th>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-line last:border-0 ${s.voided ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3 text-[13px] font-semibold text-ink">{s.code}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        s.kind === "factura"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {s.kind === "factura" ? "Factura" : "Proforma"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink">
                    {s.clientName || "Consumidor final"}
                  </td>
                  <td className="px-4 py-3 text-center text-[13px] text-ink2">{s.itemCount}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold text-ink">
                    {bs2(s.total)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink2">{s.payMethod || "—"}</td>
                  <td className="px-4 py-3 text-[12.5px] text-ink2">{fmt(s.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {s.voided ? (
                      <span className="inline-block rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                        Anulada
                      </span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => abrir(s.id)}
                          className="flex items-center gap-1 rounded-[9px] border border-line px-3 py-1.5 text-[12px] font-semibold text-ink2 hover:text-ink"
                        >
                          <Eye size={14} /> Ver
                        </button>
                        {s.kind === "factura" && (
                          <button
                            onClick={() => setAnular(s)}
                            className="flex items-center gap-1 rounded-[9px] border border-error/50 px-3 py-1.5 text-[12px] font-semibold text-error"
                          >
                            <X size={14} /> Anular
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

        {/* Lo último que pasó, en dos lecturas: qué se registró y qué plata
            entró. Con el historial vacío, cada panel lo dice con todas las
            letras en vez de mostrar una lista en blanco. */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MiniPanel
            icon={<Clock size={18} />}
            tone="#F5A800"
            title="Actividad reciente"
            onVerTodo={() => setFiltro("todo")}
          >
            {recientes.length === 0 ? (
              <PanelVacio
                icon={<Inbox size={22} />}
                title="Sin actividad todavía."
                text="Cuando registres ventas o proformas, las verás aquí."
              />
            ) : (
              recientes.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pinkSoft text-ink">
                    <Receipt size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {s.voided
                        ? "Venta anulada"
                        : s.kind === "factura"
                          ? "Venta registrada"
                          : "Proforma generada"}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink2">#{s.code}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] text-faint">{fmt(s.createdAt)}</span>
                </div>
              ))
            )}
          </MiniPanel>

          <MiniPanel
            icon={<LineChart size={18} />}
            tone="#3B6FD4"
            title="Últimos movimientos"
            onVerTodo={() => setFiltro("factura")}
          >
            {movimientos.length === 0 ? (
              <PanelVacio
                icon={<FileText size={22} />}
                title="Sin movimientos."
                text="Tus movimientos recientes aparecerán en esta sección."
              />
            ) : (
              movimientos.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#3B6FD4]/10 text-[#3B6FD4]">
                    <LineChart size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {s.payMethod || "Sin método"}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink2">
                      {s.clientName || "Consumidor final"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-ink">{bs2(s.total)}</span>
                </div>
              ))
            )}
          </MiniPanel>
        </div>
      </div>

      {ver && <VentaModal sale={ver} onClose={() => setVer(null)} />}
      {anular && (
        <AnularModal
          sale={anular}
          onClose={() => setAnular(null)}
          onDone={() => {
            setAnular(null);
            load(filtro);
          }}
        />
      )}
    </div>
  );
}

/** Tarjeta de conteo (Facturas / Proformas / Anuladas). */
function ConteoCard({
  icon,
  tone,
  label,
  n,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  n: number;
}) {
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-[18px] border border-line bg-surface p-5 shadow-card">
      <span
        aria-hidden
        className="pointer-events-none absolute right-4 top-5 h-[42px] w-[72px]"
        style={{
          backgroundImage: "radial-gradient(rgb(var(--c-faint)) 1.3px, transparent 1.3px)",
          backgroundSize: "9px 9px",
          opacity: 0.28,
        }}
      />
      <span className="relative block">
        <IconTile icon={icon} tone={tone} size={54} />
      </span>
      <span className="relative">
        <span className="block text-[12.5px] text-ink2">{label}</span>
        <span className="mt-1 block text-[24px] font-extrabold leading-none text-ink">{n}</span>
      </span>
    </div>
  );
}

/** Panel chico del pie del Historial, con su "Ver todo". */
function MiniPanel({
  icon,
  tone,
  title,
  onVerTodo,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  onVerTodo: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
          style={{ background: `${tone}24`, color: tone }}
        >
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{title}</h2>
        <button
          onClick={onVerTodo}
          className="inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-line px-3.5 py-2 text-[12px] font-semibold text-ink2 hover:text-ink"
        >
          Ver todo <ChevronRight size={14} />
        </button>
      </div>
      <div className="mt-2 divide-y divide-line">{children}</div>
    </div>
  );
}

function PanelVacio({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface2 text-faint">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-ink2">{text}</span>
      </span>
    </div>
  );
}

/** Detalle de una venta: sus ítems, el total y el botón para reimprimir. */
function VentaModal({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const business = useBusiness();

  const imprimir = () =>
    exportComprobante({
      code: sale.code,
      kind: sale.kind,
      date: new Date(sale.createdAt),
      business: { name: business.name, address: business.address, phone: business.phone },
      client: { name: sale.clientName || "Consumidor final", phone: sale.clientPhone },
      items: sale.items.map((it) => ({
        productId: null,
        sku: "",
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        discountPct: it.discountPct,
      })),
      payMethod: sale.payMethod,
      seller: "",
    });

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-[460px] overflow-y-auto rounded-[20px] bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="font-serif text-[22px] font-semibold text-ink">{business.name}</p>
          <p className="mt-0.5 text-[12px] text-ink2">
            {sale.kind === "factura" ? "FACTURA" : "PROFORMA"} · {sale.code}
          </p>
          <p className="text-[11px] text-faint">{fmt(sale.createdAt)}</p>
        </div>

        <div className="my-3 border-y border-dashed border-line py-2.5">
          {sale.items.map((it, i) => (
            <div key={i} className="flex justify-between py-0.5 text-[12.5px] text-ink">
              <span>
                {it.qty}× {it.name}
              </span>
              <span>{bs2(it.qty * it.unitPrice)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between text-[16px] font-bold text-ink">
          <span>TOTAL</span>
          <span>{bs2(sale.total)}</span>
        </div>
        <p className="mt-1.5 text-[11.5px] text-ink2">
          Cliente: {sale.clientName || "Consumidor final"} · Pago: {sale.payMethod || "—"}
        </p>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-[11px] border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink2"
          >
            Cerrar
          </button>
          <button
            onClick={imprimir}
            className="flex flex-1 items-center justify-center gap-2 rounded-[11px] bg-pink px-4 py-2.5 text-[13.5px] font-bold text-onAccent"
          >
            <FileText size={16} /> Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/** Confirmación de anulación: se avisa que vuelve el stock antes de tocar nada. */
function AnularModal({
  sale,
  onClose,
  onDone,
}: {
  sale: SaleRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const confirmar = async () => {
    setBusy(true);
    try {
      await apiVoidSale(sale.id);
      showToast(`${sale.code} anulada · stock devuelto`);
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo anular la venta.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-[20px] bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-error/10 text-error">
          <AlertTriangle size={22} />
        </span>
        <h2 className="mt-3 font-serif text-[22px] font-semibold text-ink">
          Anular {sale.code}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">
          La venta se marca como anulada y se devuelve al inventario el stock de cada producto.
          Queda registrada en el historial: no se borra.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-[11px] border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink2 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={busy}
            className="flex-1 rounded-[11px] bg-error px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Anulando…" : "Anular y devolver stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
