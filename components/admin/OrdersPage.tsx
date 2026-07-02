"use client";

import { useState } from "react";
import {
  Bike,
  Calendar,
  CalendarDays,
  FileDown,
  FileSpreadsheet,
  Flag,
  MapPin,
  Package,
  Phone,
  Pin,
  Plus,
  ReceiptText,
  Search,
  StickyNote,
  User,
  Wallet,
  X,
} from "lucide-react";
import {
  Order,
  OrderStatus,
  fmtDate,
  orderItemCount,
  orderStatuses,
  orderTotal,
  itemTotal,
  statusColor,
  statusLabel,
} from "@/lib/adminData";
import { bs2 } from "@/lib/products";
import { useOrders, useToast } from "@/context/StoreProvider";
import { openWhatsapp } from "@/lib/whatsapp";
import { exportNotaPDF, exportOrdersExcel, exportOrdersPDF } from "@/lib/exports";
import { OutlineButton, PrimaryButton } from "@/components/ui";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export function OrdersPage({ onNew }: { onNew: () => void }) {
  const model = useOrders();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<OrderStatus | null>(null);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const all = model.orders;
  const items = all.filter((o) => {
    const okF = filter === null || o.status === filter;
    const okQ =
      q === "" ||
      o.clientName.toLowerCase().includes(q.toLowerCase()) ||
      o.code.toLowerCase().includes(q.toLowerCase());
    return okF && okQ;
  });

  const toggle = (code: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });

  // Exporta la selección; si no hay nada seleccionado, el listado filtrado.
  const toExport = () =>
    selected.size > 0 ? items.filter((o) => selected.has(o.code)) : items;

  const doExport = (kind: "pdf" | "excel") => {
    const list = toExport();
    if (list.length === 0) return showToast("No hay notas para exportar");
    if (kind === "pdf") exportOrdersPDF(list);
    else exportOrdersExcel(list);
    showToast(
      `Exportando ${list.length} nota(s) a ${kind === "pdf" ? "PDF" : "Excel"}`
    );
  };

  return (
    <div className="h-full overflow-y-auto px-6 pb-10 pt-6">
      <div className="flex items-start">
        <div className="flex-1">
          <h1 className="font-serif text-[30px] font-semibold text-ink">
            Notas de venta
          </h1>
          <p className="mt-1 text-[13px] text-ink2">{all.length} notas en total</p>
        </div>
        <PrimaryButton label="Nueva Nota" icon={<Plus size={18} />} onClick={onNew} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-[46px] min-w-[240px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-4">
          <Search size={19} className="text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente o N° de nota…"
            className="flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
          />
        </div>
        <OutlineButton
          label="Exportar PDF"
          icon={<FileDown size={18} />}
          color="#B11E4B"
          onClick={() => doExport("pdf")}
        />
        <OutlineButton
          label="Exportar Excel"
          icon={<FileSpreadsheet size={18} />}
          color="#2F6B4F"
          onClick={() => doExport("excel")}
        />
      </div>

      <p className="mt-2 text-[12px] text-ink2">
        {selected.size > 0
          ? `${selected.size} nota(s) seleccionada(s) para exportar`
          : "Sin selección: se exportará el listado filtrado actual"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <FilterChip
          label="Todos"
          sel={filter === null}
          count={all.length}
          onClick={() => setFilter(null)}
        />
        {orderStatuses.map((s) => (
          <FilterChip
            key={s}
            label={statusLabel(s)}
            sel={filter === s}
            count={model.countByStatus(s)}
            color={statusColor(s)}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ReceiptText size={40} className="text-faint" />
          <h3 className="mt-3 font-serif text-[22px] font-semibold text-ink">
            No hay pedidos aquí
          </h3>
          <p className="mt-1.5 text-[13px] text-ink2">
            Crea uno nuevo o cambia el filtro.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((o) => (
            <OrderCard
              key={o.code}
              o={o}
              checked={selected.has(o.code)}
              onToggle={() => toggle(o.code)}
              onClick={() => setDetail(o)}
            />
          ))}
        </div>
      )}

      {detail && <DetailDialog o={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function FilterChip({
  label,
  sel,
  count,
  color = "#241A1E",
  onClick,
}: {
  label: string;
  sel: boolean;
  count: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 transition-all duration-200 ${
        sel ? "border-ink bg-ink" : "border-line bg-transparent"
      }`}
    >
      {!sel && (
        <span
          className="h-[7px] w-[7px] rounded-full"
          style={{ background: color }}
        />
      )}
      <span
        className={`text-[12.5px] font-semibold ${sel ? "text-white" : "text-ink2"}`}
      >
        {label}
      </span>
      <span
        className={`text-[11.5px] font-bold ${sel ? "text-white/70" : "text-faint"}`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusChip({ s, small = false }: { s: OrderStatus; small?: boolean }) {
  const color = statusColor(s);
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-bold ${small ? "text-[11px]" : "text-[11.5px]"}`}
      style={{ background: `${color}1F`, color }}
    >
      {statusLabel(s)}
    </span>
  );
}

function OrderCard({
  o,
  checked,
  onToggle,
  onClick,
}: {
  o: Order;
  checked: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={`rounded-[18px] border bg-surface p-[18px] text-left shadow-card ${
        checked ? "border-rose" : "border-line"
      }`}
    >
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          title="Seleccionar para exportar"
          className="mr-2 h-4 w-4 shrink-0 accent-rose"
        />
        <button onClick={onClick} className="flex flex-1 items-center text-left">
          <span className="eyebrow text-[10.5px] font-semibold text-gold">{o.code}</span>
          <span className="ml-auto">
            <StatusChip s={o.status} />
          </span>
        </button>
      </div>
      <button onClick={onClick} className="w-full text-left">
      <h3 className="mt-2.5 truncate font-serif text-[20px] font-semibold text-ink">
        {o.clientName}
      </h3>
      <div className="mt-1 flex items-center gap-1.5">
        <Calendar size={14} className="text-faint" />
        <span className="text-[12px] text-ink2">
          {fmtDate(o.deliveryDate)} · {o.deliveryTime}
        </span>
      </div>
      <div className="my-3 h-px bg-line" />
      <div className="flex items-center">
        <Package size={15} className="text-faint" />
        <span className="ml-1.5 text-[12.5px] text-ink2">
          {orderItemCount(o)} ítems
        </span>
        <span className="ml-auto font-serif text-[19px] font-bold text-rose">
          {bs2(orderTotal(o))}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Bike size={15} className="text-faint" />
        <span className="truncate text-[12px] text-faint">{o.courier}</span>
      </div>
      </button>
    </div>
  );
}

function DetailDialog({ o, onClose }: { o: Order; onClose: () => void }) {
  const model = useOrders();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-5">
      <div className="flex max-h-[720px] w-full max-w-[520px] flex-col rounded-[22px] bg-surface">
        <div className="flex items-start px-6 pb-2 pt-5">
          <div>
            <span className="eyebrow text-[10.5px] font-semibold text-gold">
              {o.code}
            </span>
            <h2 className="mt-1 font-serif text-[24px] font-semibold text-ink">
              {o.clientName}
            </h2>
          </div>
          <button onClick={onClose} className="ml-auto text-ink2">
            <X size={22} />
          </button>
        </div>
        <div className="h-px bg-line" />
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Row icon={<Calendar size={16} />} k="Entrega" v={`${fmtDate(o.deliveryDate)} · ${o.deliveryTime}`} />
          <Row icon={<MapPin size={16} />} k="Dirección" v={o.address || "—"} />
          {o.reference && <Row icon={<Pin size={16} />} k="Referencia" v={o.reference} />}
          <Row icon={<Phone size={16} />} k="Teléfono" v={o.phone || "—"} />
          <Row icon={<Bike size={16} />} k="Repartidor" v={o.courier} />
          <Row icon={<Flag size={16} />} k="Prioridad" v={o.priority} />
          <Row
            icon={<Wallet size={16} />}
            k="Pago"
            v={`${o.payMethod}${o.needsReceipt ? " · con comprobante" : ""}`}
          />
          <Row icon={<User size={16} />} k="Vendedor" v={o.createdBy} />
          {o.orderNotes && <Row icon={<StickyNote size={16} />} k="Notas" v={o.orderNotes} />}

          <p className="mt-3.5 text-[13px] font-bold text-ink">Detalle</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {o.items.map((it, i) => (
              <div key={i} className="flex items-center">
                <span className="flex-1 text-[12.5px] text-ink2">
                  {it.qty} × {it.name}
                </span>
                <span className="text-[12.5px] font-semibold text-ink">
                  {bs2(itemTotal(it))}
                </span>
              </div>
            ))}
          </div>
          <div className="my-2 h-px bg-line" />
          <div className="flex items-center">
            <span className="flex-1 text-[14px] font-semibold text-ink">Total</span>
            <span className="font-serif text-[22px] font-bold text-rose">
              {bs2(orderTotal(o))}
            </span>
          </div>

          <p className="mt-4 text-[13px] font-bold text-ink">Cambiar estado</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {orderStatuses.map((s) => {
              const sel = o.status === s;
              const color = statusColor(s);
              return (
                <button
                  key={s}
                  onClick={() => model.setStatus(o, s)}
                  className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
                  style={{
                    background: sel ? color : `${color}1A`,
                    borderColor: sel ? color : "transparent",
                    color: sel ? "#fff" : color,
                  }}
                >
                  {statusLabel(s)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="h-px bg-line" />
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <OutlineButton
            label="Descargar nota PDF"
            icon={<FileDown size={18} />}
            color="#B11E4B"
            onClick={() => exportNotaPDF(o)}
          />
          <div className="min-w-[160px] flex-1">
            <OutlineButton
              label="WhatsApp al cliente"
              icon={<WhatsAppIcon size={18} />}
              color="#1FAE54"
              full
              onClick={() => {
                const p = o.phone.replace(/\D/g, "");
                if (!p) return;
                const msg = `Hola ${o.clientName} 🌷, tu pedido ${o.code} está *${statusLabel(
                  o.status
                )}*. Entrega: ${fmtDate(o.deliveryDate)} ${o.deliveryTime}.`;
                openWhatsapp(msg, `591${p}`);
              }}
            />
          </div>
          <PrimaryButton label="Listo" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  k,
  v,
}: {
  icon: React.ReactNode;
  k: string;
  v: string;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="mt-0.5 text-faint">{icon}</span>
      <span className="w-[88px] shrink-0 text-[12.5px] text-faint">{k}</span>
      <span className="flex-1 text-[12.5px] font-medium text-ink">{v}</span>
    </div>
  );
}

export { StatusChip };
