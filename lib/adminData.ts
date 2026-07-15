// ===================== Formato de fecha =====================
export const fmtDate = (d: Date): string =>
  `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;

export const fmtDateTime = (d: Date): string =>
  `${fmtDate(d)} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

// ===================== Opciones =====================
export const kPriorities = ["Baja", "Media", "Alta"];
export const kCouriers = ["Sin asignar", "Luis Rodríguez", "Pedro Gutiérrez", "Carla Méndez"];
export const kPayMethods = ["Efectivo", "QR / Transferencia", "Tarjeta"];

export type OrderStatus =
  | "borrador"
  | "programado"
  | "enCamino"
  | "entregado"
  | "cancelado";

export const orderStatuses: OrderStatus[] = [
  "borrador",
  "programado",
  "enCamino",
  "entregado",
  "cancelado",
];

export const statusLabel = (s: OrderStatus): string =>
  ({
    borrador: "Borrador",
    programado: "Programado",
    enCamino: "En camino",
    entregado: "Entregado",
    cancelado: "Cancelado",
  }[s]);

export const statusColor = (s: OrderStatus): string =>
  ({
    borrador: "#9C9094",
    programado: "#3B6FD4",
    enCamino: "#B8924A",
    entregado: "#2EA66B",
    cancelado: "#C0334E",
  }[s]);

// ===================== Cliente =====================
export interface Client {
  name: string;
  phone: string;
  address: string;
  reference: string;
  location: string;
  notes: string;
  ordersCount: number;
  lastOrder: string;
  totalSpent: number;
}


// ===================== Ítem y Pedido =====================
export interface OrderItem {
  name: string;
  detail: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  image?: string;
}

export const itemGross = (i: OrderItem) => i.qty * i.unitPrice;
export const itemDiscountValue = (i: OrderItem) => itemGross(i) * (i.discountPct / 100);
export const itemTotal = (i: OrderItem) => itemGross(i) - itemDiscountValue(i);

export interface Order {
  code: string;
  clientName: string;
  phone: string;
  address: string;
  reference: string;
  location: string;
  clientNotes: string;
  deliveryDate: Date;
  deliveryTime: string;
  priority: string;
  courier: string;
  status: OrderStatus;
  items: OrderItem[];
  payMethod: string;
  needsReceipt: boolean;
  deliveryCost: number;
  deliveryObs: string;
  orderNotes: string;
  createdBy: string;
  createdAt: Date;
}

export const orderSubtotal = (o: Order) =>
  o.items.reduce((s, i) => s + itemGross(i), 0);
export const orderDiscount = (o: Order) =>
  o.items.reduce((s, i) => s + itemDiscountValue(i), 0);
export const orderTotal = (o: Order) =>
  orderSubtotal(o) - orderDiscount(o) + o.deliveryCost;
export const orderItemCount = (o: Order) =>
  o.items.reduce((s, i) => s + i.qty, 0);

