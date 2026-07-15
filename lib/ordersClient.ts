"use client";

// ============================================================
//  Cliente HTTP del navegador para pedidos y sesión de empleado.
//  Conecta el panel/CRM y la tienda web con la base de datos real
//  a través de los endpoints /api/*.
// ============================================================

import { apiUrl } from "./apiBase";
import type { Order, OrderItem, OrderStatus } from "./adminData";

// ---- Forma cruda que devuelve /api/orders ----
interface ApiOrderItem {
  name: string;
  detail?: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  image?: string | null;
  productId?: string | null;
}

interface ApiOrder {
  code: string;
  clientName: string;
  phone: string;
  address: string;
  reference: string;
  location: string;
  clientNotes: string;
  deliveryDate: string; // "YYYY-MM-DD"
  deliveryTime: string;
  priority: string;
  courier: string;
  status: OrderStatus;
  payMethod: string;
  needsReceipt: boolean;
  deliveryCost: number;
  deliveryObs: string;
  orderNotes: string;
  channel: string;
  createdBy: string;
  createdAt: string; // ISO
  items: ApiOrderItem[];
}

/** "YYYY-MM-DD" → Date local (sin desfase de zona horaria). */
function parseDateOnly(s: string): Date {
  const [y, m, d] = (s ?? "").split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

/** Convierte la fila de la API al modelo `Order` que consume el CRM. */
export function mapApiToOrder(a: ApiOrder): Order {
  return {
    code: a.code,
    clientName: a.clientName ?? "",
    phone: a.phone ?? "",
    address: a.address ?? "",
    reference: a.reference ?? "",
    location: a.location ?? "",
    clientNotes: a.clientNotes ?? "",
    deliveryDate: parseDateOnly(a.deliveryDate),
    deliveryTime: a.deliveryTime ?? "15:00",
    priority: a.priority ?? "Media",
    courier: a.courier ?? "Sin asignar",
    status: a.status,
    payMethod: a.payMethod ?? "Efectivo",
    needsReceipt: !!a.needsReceipt,
    deliveryCost: Number(a.deliveryCost) || 0,
    deliveryObs: a.deliveryObs ?? "",
    orderNotes: a.orderNotes ?? "",
    createdBy: a.createdBy ?? "",
    createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
    items: (a.items ?? []).map(
      (i): OrderItem => ({
        name: i.name,
        detail: i.detail ?? "",
        qty: i.qty,
        unitPrice: Number(i.unitPrice) || 0,
        discountPct: Number(i.discountPct) || 0,
        image: i.image ?? undefined,
      })
    ),
  };
}

/** Serializa un `Order` del CRM al cuerpo que espera POST /api/orders. */
export function orderToPayload(o: Order) {
  const d = o.deliveryDate;
  const deliveryDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    clientName: o.clientName,
    phone: o.phone,
    address: o.address,
    reference: o.reference,
    location: o.location,
    clientNotes: o.clientNotes,
    deliveryDate,
    deliveryTime: o.deliveryTime,
    priority: o.priority,
    courier: o.courier,
    status: o.status,
    payMethod: o.payMethod,
    needsReceipt: o.needsReceipt,
    deliveryCost: o.deliveryCost,
    deliveryObs: o.deliveryObs,
    orderNotes: o.orderNotes,
    items: o.items.map((i) => ({
      name: i.name,
      detail: i.detail,
      qty: i.qty,
      unitPrice: i.unitPrice,
      discountPct: i.discountPct,
      image: i.image ?? null,
    })),
  };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Lista todos los pedidos (requiere sesión de empleado). */
export async function apiListOrders(): Promise<Order[]> {
  const res = await fetch(apiUrl("/api/orders"), { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudieron cargar los pedidos");
  const rows = (await res.json()) as ApiOrder[];
  return Array.isArray(rows) ? rows.map(mapApiToOrder) : [];
}

/** Crea un pedido. Devuelve el código asignado por la base de datos. */
export async function apiCreateOrder(
  payload: ReturnType<typeof orderToPayload>
): Promise<{ code: string }> {
  const res = await fetch(apiUrl("/api/orders"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No se pudo crear el pedido");
  return data;
}

/** Cambia el estado de un pedido. */
export async function apiPatchStatus(
  code: string,
  status: OrderStatus
): Promise<void> {
  const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(code)}`), {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("No se pudo actualizar el estado");
}

/** Elimina un pedido. */
export async function apiDeleteOrder(code: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(code)}`), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("No se pudo eliminar el pedido");
}

// ---- Sesión de empleado ----
export interface EmployeeUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Inicia sesión de empleado (fija la cookie de sesión). */
export async function apiEmployeeLogin(
  email: string,
  pass: string
): Promise<EmployeeUser> {
  const res = await fetch(apiUrl("/api/auth/employee/login"), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, pass }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Correo o contraseña incorrectos.");
  return data as EmployeeUser;
}

/** Devuelve el empleado autenticado por la cookie, o null. */
export async function apiEmployeeMe(): Promise<EmployeeUser | null> {
  try {
    const res = await fetch(apiUrl("/api/auth/employee/me"), { cache: "no-store" });
    if (!res.ok) return null;
    const { user } = await res.json();
    return user ?? null;
  } catch {
    return null;
  }
}

/** Cierra la sesión de empleado. */
export async function apiEmployeeLogout(): Promise<void> {
  await fetch(apiUrl("/api/auth/employee/logout"), { method: "POST" }).catch(() => {});
}
