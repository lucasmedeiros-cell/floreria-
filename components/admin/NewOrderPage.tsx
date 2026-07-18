"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Check,
  MapPin,
  Plus,
  PlusCircle,
  Save,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  Client,
  Order,
  OrderItem,
  OrderStatus,
  fmtDateTime,
  itemDiscountValue,
  itemGross,
  itemTotal,
  kCouriers,
  kPayMethods,
  kPriorities,
  statusColor,
  statusLabel,
} from "@/lib/adminData";
import { bs2 } from "@/lib/products";
import { useAuth, useBusiness, useOrders, useProducts, useToast } from "@/context/StoreProvider";
import { useClients } from "@/lib/clientsClient";
import { openWhatsappRaw } from "@/lib/whatsapp";
import { OutlineButton, PrimaryButton } from "@/components/ui";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

interface Item extends OrderItem {
  _id: number;
}
let seq = 0;

export function NewOrderPage({ onDone }: { onDone: () => void }) {
  const orders = useOrders();
  const { colors, modules } = useBusiness();
  // Un negocio que no reparte (repuestos, ferretería…) no debería tener que
  // contestar quién entrega ni cuánto cuesta el envío.
  const reparte = modules.entregas;
  const { clients } = useClients();
  const auth = useAuth();
  const { showToast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [location, setLocation] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime] = useState("15:00");
  const [priority, setPriority] = useState("Media");
  const [courier, setCourier] = useState("Sin asignar");

  const [items, setItems] = useState<Item[]>([]);
  const [payMethod, setPayMethod] = useState("Efectivo");
  const [receipt, setReceipt] = useState(true);
  const [deliveryCost, setDeliveryCost] = useState("20");
  const [deliveryObs, setDeliveryObs] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [sheet, setSheet] = useState(false);

  const delCost = reparte ? parseFloat(deliveryCost.replace(",", ".")) || 0 : 0;
  const subtotal = items.reduce((s, i) => s + itemGross(i), 0);
  const discount = items.reduce((s, i) => s + itemDiscountValue(i), 0);
  const total = subtotal - discount + delCost;

  const fillFrom = (c: Client | null) => {
    setClient(c);
    setName(c?.name ?? "");
    setPhone(c?.phone ?? "");
    setAddress(c?.address ?? "");
    setReference(c?.reference ?? "");
    setLocation(c?.location ?? "");
    setClientNotes(c?.notes ?? "");
  };

  const newClient = () => fillFrom(null);

  const addItem = (it: OrderItem) =>
    setItems((xs) => [...xs, { ...it, _id: seq++ }]);
  const removeItem = (id: number) =>
    setItems((xs) => xs.filter((x) => x._id !== id));
  const patchItem = (id: number, patch: Partial<OrderItem>) =>
    setItems((xs) => xs.map((x) => (x._id === id ? { ...x, ...patch } : x)));

  const openMap = () => {
    const loc = location.trim();
    if (!loc) return showToast("Ingresa una ubicación primero");
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`,
      "_blank"
    );
  };
  const whatsapp = () => {
    const p = phone.replace(/\D/g, "");
    if (!p) return showToast("Ingresa un teléfono primero");
    openWhatsappRaw(`591${p}`);
  };

  const save = (status: OrderStatus) => {
    if (name.trim() === "") return showToast("Ingresa el nombre del cliente");
    if (items.length === 0) return showToast("Agrega al menos un producto");
    const [y, m, d] = date.split("-").map(Number);
    const o: Order = {
      code: orders.nextCode(),
      clientName: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      reference: reference.trim(),
      location: location.trim(),
      clientNotes: clientNotes.trim(),
      deliveryDate: new Date(y, m - 1, d),
      deliveryTime: time.trim(),
      priority,
      courier,
      status,
      items: items.map(({ _id, ...rest }) => rest),
      payMethod,
      needsReceipt: receipt,
      deliveryCost: delCost,
      deliveryObs: deliveryObs.trim(),
      orderNotes: orderNotes.trim(),
      createdBy: auth.name,
      createdAt: new Date(),
    };
    orders.add(o);
    showToast(
      status === "borrador" ? "Borrador guardado" : `Pedido ${o.code} creado`
    );
    onDone();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-b border-line bg-bg px-6 pb-4 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <span className="eyebrow text-[10.5px] font-semibold text-ink">
              Pedidos › Nuevo Pedido
            </span>
            <h1 className="mt-1 text-[28px] font-semibold text-ink">
              Nuevo Pedido
            </h1>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <OutlineButton label="Cancelar" onClick={onDone} />
            <OutlineButton
              label="Guardar borrador"
              icon={<Save size={18} />}
              color="#14110F"
              onClick={() => save("borrador")}
            />
            <PrimaryButton
              label="Crear Pedido"
              icon={<Check size={18} />}
              onClick={() => save("programado")}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-10 pt-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
          {/* Columna izquierda */}
          <div className="flex flex-col gap-5">
            {/* Cliente */}
            <Card title="Datos del cliente">
              <div>
                <Label>Cliente</Label>
                <div className="flex gap-2">
                  <select
                    value={client ? client.name : ""}
                    onChange={(e) =>
                      fillFrom(clients.find((c) => c.name === e.target.value) ?? null)
                    }
                    className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none focus:border-pink"
                  >
                    <option value="">Buscar / seleccionar cliente…</option>
                    {clients.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={newClient}
                    title="Nuevo cliente"
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink text-onAccent"
                  >
                    <UserPlus size={20} />
                  </button>
                </div>
              </div>
              <TwoCol>
                <Field label="Nombre" value={name} onChange={setName} placeholder="Nombre completo" />
                <Field
                  label="Teléfono"
                  value={phone}
                  onChange={setPhone}
                  placeholder="777 123 456"
                  suffix={
                    <button onClick={whatsapp} className="text-[#1FAE54]">
                      <WhatsAppIcon size={18} />
                    </button>
                  }
                />
              </TwoCol>
              <Field label="Dirección" value={address} onChange={setAddress} placeholder="Calle, número, zona" />
              <Field label="Referencia" value={reference} onChange={setReference} placeholder="Punto de referencia" />
              <TwoCol>
                <Field label="Ubicación (lat, lng)" value={location} onChange={setLocation} placeholder="-17.7833, -63.1821" />
                <div>
                  <Label>Mapa</Label>
                  <OutlineButton label="Ver en mapa" icon={<MapPin size={18} />} color="#14110F" full onClick={openMap} />
                </div>
              </TwoCol>
              <Field label="Notas del cliente" value={clientNotes} onChange={setClientNotes} placeholder="Preferencias, horarios, etc." />
              {client && <History c={client} showToast={showToast} />}
            </Card>

            {/* Items */}
            <Card title="Detalle del pedido">
              {items.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <PlusCircle size={30} className="text-faint" />
                  <p className="mt-2 text-[13px] text-ink2">
                    Aún no agregaste productos
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {items.map((it) => (
                    <ItemRow
                      key={it._id}
                      it={it}
                      onRemove={() => removeItem(it._id)}
                      onPatch={(p) => patchItem(it._id, p)}
                    />
                  ))}
                </div>
              )}
              <div className="mt-1.5">
                <OutlineButton
                  label="Agregar producto / servicio"
                  icon={<Plus size={18} />}
                  color="#14110F"
                  onClick={() => setSheet(true)}
                />
              </div>
              <Totals subtotal={subtotal} discount={discount} delCost={delCost} total={total} />
            </Card>

            {/* Observaciones */}
            <Card title="Observaciones del pedido">
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={3}
                placeholder="Ej. Llamar antes de entregar. Dejar con la portera si no hay nadie."
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none focus:border-pink"
              />
            </Card>
          </div>

          {/* Columna derecha */}
          <div className="flex flex-col gap-5">
            <Card title={reparte ? "Agenda de entrega" : "Fecha del pedido"}>
              <TwoCol>
                <div>
                  <Label>Fecha de entrega</Label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none focus:border-pink"
                  />
                </div>
                <div>
                  <Label>Hora de entrega</Label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none focus:border-pink"
                  />
                </div>
              </TwoCol>
              <div>
                <Label>Prioridad</Label>
                <Select value={priority} options={kPriorities} onChange={setPriority} />
              </div>
              {reparte && (
                <>
                  <div>
                    <Label>Responsable / Repartidor</Label>
                    <Select value={courier} options={kCouriers} onChange={setCourier} />
                  </div>
                  <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-[#3B6FD4]/[0.08] p-3">
                    <Check size={17} className="mt-0.5 text-[#3B6FD4]" />
                    <span className="text-[11.5px] text-ink2">
                      La entrega se agenda y el cliente recibirá una confirmación por
                      WhatsApp.
                    </span>
                  </div>
                </>
              )}
            </Card>

            <Card title={reparte ? "Detalles de entrega y pago" : "Pago"}>
              <div>
                <Label>Método de pago</Label>
                <Select value={payMethod} options={kPayMethods} onChange={setPayMethod} />
              </div>
              <TwoCol>
                <div>
                  <Label>¿Requiere comprobante?</Label>
                  <Select
                    value={receipt ? "Sí" : "No"}
                    options={["Sí", "No"]}
                    onChange={(v) => setReceipt(v === "Sí")}
                  />
                </div>
                {reparte && (
                  <Field
                    label="Costo de entrega (Bs)"
                    value={deliveryCost}
                    onChange={setDeliveryCost}
                  />
                )}
              </TwoCol>
              {reparte && (
                <Field
                  label="Observaciones de entrega"
                  value={deliveryObs}
                  onChange={setDeliveryObs}
                  placeholder="Ej. Tocar timbre y esperar confirmación."
                />
              )}
            </Card>

            <Card title="Resumen">
              <SumRow k="Estado del pedido" chip={<StatusChip s="programado" />} />
              <SumRow k="Creado por" v={auth.name} />
              <SumRow k="Fecha de creación" v={fmtDateTime(new Date())} />
            </Card>
          </div>
        </div>
      </div>

      {sheet && (
        <AddSheet
          onClose={() => setSheet(false)}
          onAdd={(it) => {
            addItem(it);
            setSheet(false);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ---------- Subcomponentes ----------
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h2 className="mb-4 text-[19px] font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12.5px] font-medium text-ink2">
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-3 focus-within:border-pink">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
        />
        {suffix}
      </div>
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none focus:border-pink"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
  );
}

function StatusChip({ s }: { s: OrderStatus }) {
  const color = statusColor(s);
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11.5px] font-bold"
      style={{ background: `${color}1F`, color }}
    >
      {statusLabel(s)}
    </span>
  );
}

function SumRow({
  k,
  v,
  chip,
}: {
  k: string;
  v?: string;
  chip?: React.ReactNode;
}) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-[12.5px] text-ink2">{k}</span>
      {chip ?? <span className="text-[12.5px] font-semibold text-ink">{v}</span>}
    </div>
  );
}

function History({
  c,
  showToast,
}: {
  c: Client;
  showToast: (m: string) => void;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-surface2 p-3.5">
      <p className="text-[13px] font-bold text-ink">Historial del cliente</p>
      <div className="mt-3 flex">
        <HStat k="Pedidos" v={`${c.ordersCount}`} />
        <HStat k="Último" v={c.lastOrder} />
        <HStat k="Gastado" v={bs2(c.totalSpent)} />
      </div>
      <button
        onClick={() => showToast("Historial completo — próximamente")}
        className="mt-2.5 text-[12.5px] font-semibold text-ink"
      >
        Ver historial completo →
      </button>
    </div>
  );
}

function HStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex-1">
      <p className="truncate text-[13.5px] font-bold text-ink">{v}</p>
      <p className="text-[10.5px] text-faint">{k}</p>
    </div>
  );
}

function ItemRow({
  it,
  onRemove,
  onPatch,
}: {
  it: Item;
  onRemove: () => void;
  onPatch: (p: Partial<OrderItem>) => void;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-surface2 p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px]">
          {it.image ? (
            <Image src={it.image} alt={it.name} fill sizes="48px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-pink/10 text-ink">
              🌿
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-ink">{it.name}</p>
          {it.detail && <p className="truncate text-[11.5px] text-faint">{it.detail}</p>}
        </div>
        <button onClick={onRemove} className="text-[#C0334E]">
          <Trash2 size={19} />
        </button>
      </div>
      <div className="mt-2.5 flex items-end gap-2.5">
        <MiniStepper
          qty={it.qty}
          onMinus={() => onPatch({ qty: Math.max(1, it.qty - 1) })}
          onPlus={() => onPatch({ qty: Math.min(999, it.qty + 1) })}
        />
        <NumField
          label="P. unit."
          value={it.unitPrice}
          onChange={(v) => onPatch({ unitPrice: v })}
        />
        <div className="w-[84px]">
          <NumField
            label="Desc. %"
            value={it.discountPct}
            onChange={(v) => onPatch({ discountPct: Math.min(100, Math.max(0, v)) })}
          />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-faint">Total</span>
          <span className="text-[13px] font-bold text-ink">{bs2(itemTotal(it))}</span>
        </div>
      </div>
    </div>
  );
}

function MiniStepper({
  qty,
  onMinus,
  onPlus,
}: {
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center rounded-[10px] border border-line bg-surface">
      <button onClick={onMinus} className="h-[34px] w-[30px] text-ink2">
        −
      </button>
      <span className="w-6 text-center text-[13px] font-semibold text-ink">{qty}</span>
      <button onClick={onPlus} className="h-[34px] w-[30px] text-ink2">
        +
      </button>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex-1">
      <span className="text-[10px] text-faint">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value.replace(",", ".")) || 0)}
        inputMode="decimal"
        className="mt-0.5 h-[38px] w-full rounded-[10px] border border-line bg-surface px-2.5 text-[13px] font-semibold text-ink outline-none focus:border-pink"
      />
    </div>
  );
}

function Totals({
  subtotal,
  discount,
  delCost,
  total,
}: {
  subtotal: number;
  discount: number;
  delCost: number;
  total: number;
}) {
  const Row = ({ k, v, big }: { k: string; v: string; big?: boolean }) => (
    <div className="flex items-center py-1">
      <span
        className={`flex-1 ${big ? "text-[14px] font-semibold text-ink" : "text-[12.5px] text-ink2"}`}
      >
        {k}
      </span>
      <span
        className={
          big
            ? "text-[22px] font-bold text-ink"
            : "text-[13px] font-semibold text-ink"
        }
      >
        {v}
      </span>
    </div>
  );
  return (
    <div className="mt-4 rounded-[14px] bg-surface2 p-4">
      <Row k="Subtotal" v={bs2(subtotal)} />
      <Row k="Descuento" v={`- ${bs2(discount)}`} />
      <Row k="Costo de entrega" v={bs2(delCost)} />
      <div className="my-1.5 h-px bg-line" />
      <Row k="Total" v={bs2(total)} big />
    </div>
  );
}

function AddSheet({
  onClose,
  onAdd,
  showToast,
}: {
  onClose: () => void;
  onAdd: (it: OrderItem) => void;
  showToast: (m: string) => void;
}) {
  const productsApi = useProducts();
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [price, setPrice] = useState("");

  // Sugerencias en vivo por SKU / código / nombre / palabras clave.
  const results = productsApi.search(query).slice(0, 12);

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-t-[24px] bg-bg p-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h3 className="text-[20px] font-semibold text-ink">
          Buscar en el catálogo
        </h3>

        <div className="mt-3 flex h-[46px] items-center gap-2.5 rounded-xl border border-line bg-surface px-4 focus-within:border-pink">
          <Search size={19} className="text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SKU, código, nombre o palabra clave…"
            className="flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-faint">
              <X size={17} />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {results.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] text-ink2">
              No hay productos que coincidan con “{query}”.
            </p>
          ) : (
            results.map((p) => (
              <div
                key={p.id}
                className="flex items-center rounded-xl border border-line bg-surface"
              >
                <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-l-xl bg-surface2">
                  {p.image ? (
                    <Image src={p.image} alt={p.name} fill sizes="52px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink">
                      🌿
                    </div>
                  )}
                </div>
                <div className="ml-3 min-w-0 flex-1 py-1.5">
                  <p className="truncate text-[13px] font-semibold text-ink">{p.name}</p>
                  <p className="text-[11px] text-faint">
                    {p.id} · {p.category} · Stock {p.stock ?? 0}
                  </p>
                  <p className="text-[12px] text-ink2">{bs2(p.price)}</p>
                </div>
                <button
                  onClick={() =>
                    onAdd({
                      name: p.name,
                      detail: p.category,
                      qty: 1,
                      unitPrice: p.price,
                      discountPct: 0,
                      image: p.image,
                    })
                  }
                  className="p-3 text-ink"
                >
                  <PlusCircle size={24} />
                </button>
              </div>
            ))
          )}
        </div>

        <h3 className="mt-5 text-[18px] font-semibold text-ink">
          O crea un producto / servicio
        </h3>
        <div className="mt-3 flex flex-col gap-2.5">
          <SheetInput value={name} onChange={setName} placeholder="Nombre (ej. Tarjeta personalizada)" />
          <SheetInput value={detail} onChange={setDetail} placeholder="Detalle (opcional)" />
          <SheetInput value={price} onChange={setPrice} placeholder="Precio (Bs)" />
          <PrimaryButton
            label="Agregar al pedido"
            icon={<Plus size={18} />}
            expand
            onClick={() => {
              const n = name.trim();
              const pr = parseFloat(price.replace(",", ".")) || 0;
              if (!n || pr <= 0) return showToast("Completa nombre y precio");
              onAdd({
                name: n,
                detail: detail.trim(),
                qty: 1,
                unitPrice: pr,
                discountPct: 0,
              });
            }}
          />
        </div>
        <button onClick={onClose} className="mt-3 flex w-full justify-center py-2 text-ink2">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

function SheetInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-pink"
    />
  );
}
