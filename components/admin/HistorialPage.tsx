"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, FileText, Receipt, X } from "lucide-react";
import { bs2 } from "@/lib/products";
import { useBusiness, useToast } from "@/context/StoreProvider";
import { exportComprobante } from "@/lib/comprobante";
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

  const abrir = async (id: string) => {
    try {
      setVer(await apiGetSale(id));
    } catch {
      showToast("No se pudo abrir la venta.");
    }
  };

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-[30px] font-semibold text-ink">Historial</h1>
          <p className="mt-1 text-[13px] text-ink2">
            Ventas y proformas. Anular una factura devuelve el stock.
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
            Facturado
          </span>
          <p className="font-serif text-[26px] font-bold leading-none text-ink">{bs2(total)}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
              filtro === f.id
                ? "bg-pink text-onAccent"
                : "border border-line bg-surface text-ink2 hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="mt-5 rounded-[14px] border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
          {err}
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-[18px] border border-line bg-surface shadow-soft">
        {loading ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink2">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Receipt size={34} className="mx-auto text-faint" />
            <p className="mt-3 text-[14px] font-medium text-ink">Todavía no hay ventas.</p>
            <p className="mt-1 text-[12.5px] text-ink2">
              Lo que cobres en Venta aparece acá al instante.
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
