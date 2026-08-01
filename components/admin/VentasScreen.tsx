"use client";

import { useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  Barcode,
  Check,
  FileText,
  Minus,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { bs } from "@/lib/products";
import { useAuth, useBusiness, useProducts, useToast } from "@/context/StoreProvider";
import { apiCreateSale, type SaleKind, type SaleLine } from "@/lib/salesClient";
import { exportComprobante } from "@/lib/comprobante";

/** Línea del carrito de venta (producto del inventario + cantidad + descuento). */
interface CartLine extends SaleLine {
  stock: number;
}

/**
 * Ventas (punto de venta). El cliente quiere un producto que HAY en el
 * inventario: se busca (búsqueda tipo Google, varias palabras), se agrega, se
 * cobra y baja el stock. También genera PROFORMAS (cotizaciones) que no tocan
 * el stock. Es la pantalla con la que arranca el CRM en rubros de mostrador.
 */
export function VentasScreen() {
  const { products, search, refresh } = useProducts();
  const business = useBusiness();
  const auth = useAuth();
  const { showToast } = useToast();

  const [q, setQ] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientNit, setClientNit] = useState("");
  const [payMethod, setPayMethod] = useState("Efectivo");
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // Id de idempotencia del cobro en curso: se genera una vez y se reusa si hay
  // que reintentar (así un doble envío no duplica la venta). Se limpia al éxito.
  const pendingRef = useRef<string>("");

  // Búsqueda tipo Google: varios términos (SKU, nombre, código de barras,
  // categoría, palabras clave). Solo cuando hay algo escrito, para no listar
  // todo el catálogo. Máx. 8 resultados para mantenerlo ágil.
  const resultados = useMemo(() => {
    if (q.trim() === "") return [];
    return search(q).slice(0, 8);
  }, [q, search]);

  const add = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        const next = [...ls];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [
        ...ls,
        {
          productId: p.id,
          sku: p.id,
          name: p.name,
          qty: 1,
          unitPrice: p.price,
          discountPct: 0,
          stock: p.stock ?? 0,
        },
      ];
    });
    setQ("");
    searchRef.current?.focus();
  };

  const setLine = (i: number, patch: Partial<CartLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));

  const subtotal = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const total = lines.reduce(
    (a, l) => a + l.qty * l.unitPrice * (1 - l.discountPct / 100),
    0
  );
  const descuento = subtotal - total;
  const items = lines.length;

  const cobrar = async (kind: SaleKind) => {
    if (lines.length === 0) {
      showToast("Agregá al menos un producto");
      return;
    }
    setBusy(true);
    try {
      const payload: SaleLine[] = lines.map((l) => ({
        productId: l.productId,
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
      }));
      if (!pendingRef.current) {
        pendingRef.current = `crm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }
      const sale = await apiCreateSale({
        kind,
        clientName,
        clientNit,
        payMethod,
        items: payload,
        clientRef: pendingRef.current,
      });
      // Venta confirmada: el próximo cobro usa un ref nuevo.
      pendingRef.current = "";

      // Comprobante PDF (proforma o factura). La fecha es la que REGISTRÓ el
      // servidor, no `new Date()`: con el reloj de la caja desajustado, el
      // ticket salía con una hora que no coincidía con el historial ni con el
      // corte de caja. Si la respuesta no la trae, se cae al reloj local.
      exportComprobante({
        code: sale.code,
        kind,
        date: sale.createdAt ? new Date(sale.createdAt) : new Date(),
        business: { name: business.name, address: business.address, phone: business.phone },
        client: { name: clientName || "Consumidor final", nit: clientNit },
        items: payload,
        payMethod,
        seller: auth.name,
      });

      showToast(
        kind === "factura"
          ? `Venta ${sale.code} registrada · stock actualizado`
          : `Proforma ${sale.code} generada`
      );

      // Limpia el POS y refresca el inventario (el stock bajó).
      setLines([]);
      setClientName("");
      setClientNit("");
      if (kind === "factura") await refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Los lectores de código de barras USB "escriben" el código y mandan Enter:
   * alcanza con dejar el cursor en el buscador para que la lectura entre sola.
   */
  const escanear = () => {
    searchRef.current?.focus();
    showToast("Escaneá el código con el lector: entra solo en el buscador.");
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-bg p-4 lg:flex-row lg:overflow-hidden lg:p-5">
      {/* ==================== Buscador + resultados ==================== */}
      <div className="flex min-h-0 flex-1 flex-col rounded-[18px] border border-line bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.5px] text-ink">
              Ventas
            </h1>
            <p className="mt-2 text-[13px] text-ink2">
              Busca el producto en el inventario, agrégalo y cobra. La venta descuenta el stock.
            </p>
          </div>
          <button
            onClick={escanear}
            className="inline-flex h-[46px] shrink-0 items-center gap-2.5 rounded-[12px] border border-line bg-surface px-4 text-[13px] font-semibold text-ink2 transition-colors hover:text-ink"
          >
            <Barcode size={18} className="text-pinkDeep" /> Código de barras
          </button>
        </div>

        {/* Buscador tipo Google */}
        <div className="relative mt-5">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="Buscar por código, nombre, código de barras, marca…"
            className="w-full rounded-[14px] border border-line bg-surface py-4 pl-12 pr-4 text-[14px] text-ink outline-none focus:border-pink"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Resultados */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {q.trim() === "" ? (
            <div
              className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-[16px] border border-line bg-surface2/40 py-16 text-center"
              style={{ borderTopColor: "#FEBB03" }}
            >
              <span className="relative grid h-[150px] w-[150px] place-items-center rounded-full bg-pinkSoft/60 text-ink">
                <Search size={62} strokeWidth={1.6} />
                <Sparkle className="absolute right-4 top-6" />
                <Sparkle className="absolute bottom-8 left-6" />
              </span>
              <p className="mt-5 text-[16px] font-extrabold text-ink">
                Escribe para buscar en el inventario.
              </p>
              <p className="mt-1.5 text-[13px] text-ink2">
                Podés poner varias referencias (ej. “freno delantero cerámico”).
              </p>
            </div>
          ) : resultados.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <p className="text-[14px] font-semibold text-ink">Sin resultados</p>
              <p className="mt-1 text-[12.5px] text-ink2">
                No hay ese producto en el inventario. Si no lo tenés en stock, se pide desde{" "}
                <b>Pedidos</b> (a proveedor).
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {resultados.map((p) => {
                const sinStock = (p.stock ?? 0) <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => add(p.id)}
                    className="flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:border-pink"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10.5px] font-semibold text-pink">{p.id}</span>
                        {p.category && (
                          <span className="text-[10.5px] text-faint">· {p.category}</span>
                        )}
                      </div>
                      <p className="truncate text-[14px] font-semibold text-ink">{p.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-bold text-ink">{bs(p.price)}</p>
                      <p
                        className={`text-[11px] font-semibold ${
                          sinStock ? "text-[#C0334E]" : "text-green"
                        }`}
                      >
                        {sinStock ? "Sin stock" : `Stock ${p.stock}`}
                      </p>
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-pink text-onAccent">
                      <Plus size={18} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ==================== Carrito / cobro ==================== */}
      <div className="flex w-full min-h-0 flex-col rounded-[18px] border border-line bg-surface shadow-card lg:w-[420px]">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <ShoppingCart size={20} className="text-pinkDeep" />
          <span className="text-[16px] font-extrabold text-ink">Comprobante</span>
          <span className="ml-auto text-[12.5px] text-ink2">
            {items} {items === 1 ? "ítem" : "ítems"}
          </span>
          {items > 0 && (
            <button
              onClick={() => setLines([])}
              className="text-faint transition-colors hover:text-[#C0334E]"
              title="Vaciar"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Líneas */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {lines.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center py-16 text-center">
              <span className="relative grid h-[110px] w-[110px] place-items-center rounded-full bg-pinkSoft/60 text-ink2">
                <Receipt size={44} strokeWidth={1.6} />
                <Sparkle className="absolute right-3 top-4" />
                <Sparkle className="absolute bottom-5 left-4" />
              </span>
              <p className="mt-4 text-[13.5px] text-ink2">Agrega productos desde la búsqueda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {lines.map((l, i) => (
                <div key={l.productId ?? i} className="rounded-[12px] border border-line bg-surface p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{l.name}</p>
                      <p className="text-[11px] text-faint">
                        {l.sku} · {bs(l.unitPrice)} c/u
                        {l.qty > l.stock && (
                          <span className="ml-1 text-[#C0334E]">· supera el stock ({l.stock})</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => removeLine(i)}
                      className="text-faint transition-colors hover:text-[#C0334E]"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    {/* Cantidad */}
                    <div className="flex items-center overflow-hidden rounded-[9px] border border-line">
                      <button
                        onClick={() => setLine(i, { qty: Math.max(1, l.qty - 1) })}
                        className="grid h-8 w-8 place-items-center bg-surface2 text-ink2"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        value={l.qty}
                        onChange={(e) =>
                          setLine(i, { qty: Math.max(1, parseInt(e.target.value) || 1) })
                        }
                        className="w-9 bg-transparent text-center text-[13px] font-medium text-ink outline-none"
                      />
                      <button
                        onClick={() => setLine(i, { qty: l.qty + 1 })}
                        className="grid h-8 w-8 place-items-center bg-surface2 text-ink2"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    {/* Descuento % */}
                    <label className="flex items-center gap-1 rounded-[9px] border border-line px-2">
                      <input
                        value={l.discountPct || ""}
                        onChange={(e) =>
                          setLine(i, {
                            discountPct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                          })
                        }
                        placeholder="0"
                        className="w-8 bg-transparent py-1.5 text-right text-[13px] text-ink outline-none"
                      />
                      <span className="text-[12px] text-faint">% desc.</span>
                    </label>
                    <span className="ml-auto text-[14px] font-bold text-ink">
                      {bs(Math.round(l.qty * l.unitPrice * (1 - l.discountPct / 100)))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Datos + totales + acciones */}
        <div className="border-t border-line px-5 py-4">
          <div className="grid grid-cols-2 gap-2.5">
            <CampoConIcono icon={<UserRound size={16} />}>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Cliente (opcional)"
                className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
              />
            </CampoConIcono>
            <CampoConIcono icon={<FileText size={16} />}>
              <input
                value={clientNit}
                onChange={(e) => setClientNit(e.target.value)}
                placeholder="NIT / CI (opcional)"
                className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
              />
            </CampoConIcono>
          </div>
          <CampoConIcono icon={<BadgeDollarSign size={16} />} className="mt-2.5">
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full bg-transparent text-[13px] text-ink outline-none"
            >
              <option>Efectivo</option>
              <option>QR / Transferencia</option>
              <option>Tarjeta</option>
            </select>
          </CampoConIcono>

          <div className="mt-4 space-y-1">
            {descuento > 0.005 && (
              <div className="flex justify-between text-[12.5px] text-ink2">
                <span>Descuento</span>
                <span>- {bs(Math.round(descuento))}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-ink">Total</span>
              <span className="text-[30px] font-extrabold leading-none text-ink">
                {bs(Math.round(total))}
              </span>
            </div>
          </div>

          <div className="mt-4 flex gap-2.5">
            <button
              onClick={() => cobrar("proforma")}
              disabled={busy || items === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-[12px] border border-line bg-surface py-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-pink disabled:opacity-50"
            >
              <FileText size={17} /> Proforma
            </button>
            <button
              onClick={() => cobrar("factura")}
              disabled={busy || items === 0}
              className="flex flex-[1.4] items-center justify-center gap-2 rounded-[12px] py-3.5 text-[14px] font-extrabold text-onAccent transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: "linear-gradient(100deg,#FFC93C,#FEBB03 55%,#F0A400)" }}
            >
              {busy ? "Procesando…" : <><Check size={18} /> Cobrar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Campo del comprobante: el ícono adentro de la caja, como en el diseño. */
function CampoConIcono({
  icon,
  className = "",
  children,
}: {
  icon: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[11px] border border-line bg-surface px-3 py-3 focus-within:border-pink ${className}`}
    >
      <span className="shrink-0 text-faint">{icon}</span>
      {children}
    </div>
  );
}

/** Destello de los estados vacíos. Decorativo. */
function Sparkle({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute text-pinkDeep ${className}`}
      style={{ fontSize: 13, lineHeight: 1 }}
    >
      ✦
    </span>
  );
}
