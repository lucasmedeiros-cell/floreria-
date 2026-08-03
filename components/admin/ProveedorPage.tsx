"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Truck, Check, X, Search } from "lucide-react";
import { bs2 } from "@/lib/products";
import type { Product } from "@/lib/products";
import { apiListProducts } from "@/lib/productsClient";
import {
  apiListPurchaseOrders,
  apiCreatePurchaseOrder,
  apiSetPurchaseStatus,
  type PurchaseOrder,
  type POItem,
  type POStatus,
} from "@/lib/purchaseClient";

const STATUS: Record<POStatus, { label: string; cls: string }> = {
  solicitado: { label: "Solicitado", cls: "bg-amber-100 text-amber-700" },
  recibido: { label: "Recibido", cls: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", cls: "bg-rose-100 text-rose-700" },
};

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
}

/**
 * Compras — la reposición de inventario que se le pide al proveedor (distinta
 * de las ventas a cliente). Al marcar "Recibido", el backend sube el stock de
 * cada ítem.
 *
 * `nuevo` llega desde el acceso "Registrar compra" del Resumen: abre el
 * formulario apenas se entra, sin obligar a buscar el botón.
 */
export function ProveedorPage({ nuevo = false }: { nuevo?: boolean }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(nuevo);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setOrders(await apiListPurchaseOrders());
      setErr(null);
    } catch {
      setErr("No se pudieron cargar las compras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: POStatus) => {
    setBusy(id);
    try {
      await apiSetPurchaseStatus(id, status);
      await load();
    } catch {
      setErr("No se pudo actualizar la compra.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[30px] font-semibold text-ink">Compras</h1>
          <p className="mt-1 text-[13px] text-ink2">Reposición de inventario. Al recibir, sube el stock.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-[12px] bg-pink px-4 py-2.5 text-[13.5px] font-bold text-onAccent"
        >
          <Plus size={18} /> Registrar compra
        </button>
      </div>

      {err && <div className="mt-5 rounded-[14px] border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">{err}</div>}

      <div className="mt-5 overflow-hidden rounded-[18px] border border-line bg-surface shadow-soft">
        {loading ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink2">Cargando…</p>
        ) : orders.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Truck size={34} className="mx-auto text-faint" />
            <p className="mt-3 text-[14px] font-medium text-ink">Sin compras registradas todavía.</p>
            <p className="mt-1 text-[12.5px] text-ink2">Registrá una cuando pidas mercadería a tu distribuidora.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-3 text-left font-semibold">Código</th>
                <th className="px-4 py-3 text-left font-semibold">Proveedor</th>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-center font-semibold">Ítems</th>
                <th className="px-4 py-3 text-center font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-[13px] font-semibold text-ink">{o.code}</td>
                  <td className="px-4 py-3 text-[13px] text-ink">{o.supplier || "—"}</td>
                  <td className="px-4 py-3 text-[13px] text-ink2">{fmt(o.createdAt)}</td>
                  <td className="px-4 py-3 text-center text-[13px] text-ink2">{o.itemCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status === "solicitado" ? (
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={busy === o.id}
                          onClick={() => setStatus(o.id, "recibido")}
                          className="flex items-center gap-1 rounded-[9px] bg-emerald-600 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                        >
                          <Check size={14} /> Recibir
                        </button>
                        <button
                          disabled={busy === o.id}
                          onClick={() => setStatus(o.id, "cancelado")}
                          className="flex items-center gap-1 rounded-[9px] border border-line px-3 py-1.5 text-[12px] font-semibold text-ink2 disabled:opacity-50"
                        >
                          <X size={14} /> Cancelar
                        </button>
                      </div>
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NuevoPedidoModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NuevoPedidoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [supplier, setSupplier] = useState("");
  const [productos, setProductos] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<POItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiListProducts().then(setProductos).catch(() => setProductos([]));
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return productos
      .filter((p) => `${p.id} ${p.name} ${p.category ?? ""}`.toLowerCase().includes(t))
      .slice(0, 6);
  }, [q, productos]);

  const add = (p: Product) => {
    if (items.some((it) => it.productId === p.id)) return;
    setItems((xs) => [...xs, { productId: p.id, sku: p.id, name: p.name, qty: 1, unitCost: p.cost ?? 0 }]);
    setQ("");
  };
  const patch = (i: number, k: keyof POItem, v: number) => setItems((xs) => xs.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const remove = (i: number) => setItems((xs) => xs.filter((_, j) => j !== i));

  const total = items.reduce((s, it) => s + it.qty * (it.unitCost ?? 0), 0);

  const save = async () => {
    if (!supplier.trim()) return setError("Indicá el proveedor.");
    if (items.length === 0) return setError("Agregá al menos un producto.");
    setSaving(true);
    setError(null);
    try {
      await apiCreatePurchaseOrder({ supplier: supplier.trim(), items });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la compra.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-[20px] bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[22px] font-semibold text-ink">Registrar compra</h2>
          <button onClick={onClose} className="text-ink2 hover:text-ink"><X size={22} /></button>
        </div>

        <label className="mt-4 block text-[12px] font-semibold text-ink2">Proveedor</label>
        <input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Distribuidora / casa de repuestos"
          className="mt-1.5 w-full rounded-[11px] border border-line bg-white px-3 py-2.5 text-[14px] outline-none focus:border-pink"
        />

        <label className="mt-4 block text-[12px] font-semibold text-ink2">Agregar productos</label>
        <div className="relative mt-1.5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por SKU o nombre…"
            className="w-full rounded-[11px] border border-line bg-white py-2.5 pl-9 pr-3 text-[14px] outline-none focus:border-pink"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[12px] border border-line bg-white shadow-lg">
              {results.map((p) => (
                <button key={p.id} onClick={() => add(p)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface2">
                  <span className="text-[13px] text-ink"><b className="text-pinkDeep">{p.id}</b> · {p.name}</span>
                  <span className="text-[12px] text-ink2">stock {p.stock ?? 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="rounded-[11px] border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-ink2">Sin productos aún.</p>
          ) : (
            items.map((it, i) => (
              <div key={it.productId} className="flex items-center gap-2 rounded-[11px] border border-line bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{it.name}</p>
                  <p className="text-[11px] text-faint">{it.sku}</p>
                </div>
                <label className="text-[11px] text-ink2">Cant.
                  <input type="number" min={1} value={it.qty} onChange={(e) => patch(i, "qty", Math.max(1, Number(e.target.value) || 1))} className="ml-1 w-14 rounded-[8px] border border-line px-2 py-1 text-[13px]" />
                </label>
                <label className="text-[11px] text-ink2">Costo
                  <input type="number" min={0} value={it.unitCost} onChange={(e) => patch(i, "unitCost", Math.max(0, Number(e.target.value) || 0))} className="ml-1 w-20 rounded-[8px] border border-line px-2 py-1 text-[13px]" />
                </label>
                <button onClick={() => remove(i)} className="text-faint hover:text-error"><X size={16} /></button>
              </div>
            ))
          )}
        </div>

        {error && <p className="mt-3 text-[13px] text-error">{error}</p>}

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[14px] text-ink2">Total estimado: <b className="text-ink">{bs2(total)}</b></span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-[11px] border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink2">Cancelar</button>
            <button onClick={save} disabled={saving} className="rounded-[11px] bg-pink px-5 py-2.5 text-[13.5px] font-bold text-onAccent disabled:opacity-50">
              {saving ? "Guardando…" : "Registrar compra"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
