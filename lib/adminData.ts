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

export const kClients: Client[] = [
  {
    name: "María Fernández",
    phone: "777 123 456",
    address: "Av. Las Palmas #123, Zona Norte, Santa Cruz",
    reference: "Frente a la plaza principal",
    location: "-17.7833, -63.1821",
    notes: "Cliente prefiere entregas en la tarde.",
    ordersCount: 12,
    lastOrder: "15/05/2024",
    totalSpent: 4850,
  },
  {
    name: "Carlos Rojas",
    phone: "712 000 111",
    address: "Calle Beni #45, Equipetrol",
    reference: "Edificio azul, piso 3",
    location: "-17.7690, -63.1920",
    notes: "",
    ordersCount: 3,
    lastOrder: "02/06/2026",
    totalSpent: 1180,
  },
  {
    name: "Lucía Vargas",
    phone: "700 222 333",
    address: "Av. Alemana #900",
    reference: "Timbre no funciona, llamar al llegar",
    location: "-17.7745, -63.1780",
    notes: "Suele pedir para cumpleaños.",
    ordersCount: 7,
    lastOrder: "20/06/2026",
    totalSpent: 2640,
  },
];

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

export function seedOrders(): Order[] {
  return [
    {
      code: "PED-1043",
      clientName: "María Fernández",
      phone: "777 123 456",
      address: "Av. Las Palmas #123, Zona Norte",
      reference: "Frente a la plaza principal",
      location: "-17.7833, -63.1821",
      clientNotes: "",
      deliveryDate: new Date(2026, 6, 1),
      deliveryTime: "15:00",
      priority: "Media",
      courier: "Luis Rodríguez",
      status: "programado",
      payMethod: "Efectivo",
      needsReceipt: true,
      deliveryCost: 20,
      deliveryObs: "Tocar timbre y esperar confirmación.",
      orderNotes: "Llamar antes de entregar.",
      createdBy: "Ana Gómez",
      createdAt: new Date(2026, 5, 30, 10, 30),
      items: [
        { name: "Rosas Rojas Premium", detail: "Docena", qty: 1, unitPrice: 150, discountPct: 0, image: "/images/r206.jpg" },
        { name: "Tarjeta personalizada", detail: "Con dedicatoria", qty: 1, unitPrice: 15, discountPct: 0 },
      ],
    },
    {
      code: "PED-1042",
      clientName: "Lucía Vargas",
      phone: "700 222 333",
      address: "Av. Alemana #900",
      reference: "Timbre no funciona, llamar",
      location: "",
      clientNotes: "",
      deliveryDate: new Date(2026, 6, 2),
      deliveryTime: "11:30",
      priority: "Alta",
      courier: "Pedro Gutiérrez",
      status: "enCamino",
      payMethod: "QR / Transferencia",
      needsReceipt: false,
      deliveryCost: 25,
      deliveryObs: "",
      orderNotes: "",
      createdBy: "Ana Gómez",
      createdAt: new Date(2026, 5, 29, 9, 15),
      items: [
        { name: "Jardinera Premium", detail: "Peonías y rosas", qty: 1, unitPrice: 1850, discountPct: 0, image: "/images/r208.jpg" },
      ],
    },
    {
      code: "PED-1041",
      clientName: "Carlos Rojas",
      phone: "712 000 111",
      address: "Calle Beni #45, Equipetrol",
      reference: "",
      location: "",
      clientNotes: "",
      deliveryDate: new Date(2026, 5, 28),
      deliveryTime: "17:00",
      priority: "Baja",
      courier: "Carla Méndez",
      status: "entregado",
      payMethod: "Tarjeta",
      needsReceipt: false,
      deliveryCost: 20,
      deliveryObs: "",
      orderNotes: "",
      createdBy: "Ana Gómez",
      createdAt: new Date(2026, 5, 27, 16, 40),
      items: [
        { name: "Girasoles Radiantes", detail: "Brazada", qty: 2, unitPrice: 240, discountPct: 10, image: "/images/r212.jpg" },
      ],
    },
  ];
}
