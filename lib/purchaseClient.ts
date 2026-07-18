import { apiUrl } from "./apiBase";

export type POStatus = "solicitado" | "recibido" | "cancelado";

export interface POItem {
  productId: string | null;
  sku: string;
  name: string;
  qty: number;
  unitCost?: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplier: string;
  status: POStatus;
  createdAt: string;
  receivedAt: string | null;
  itemCount: number;
  items: POItem[];
}

export interface POInput {
  supplier: string;
  notes?: string;
  items: POItem[];
}

export async function apiListPurchaseOrders(): Promise<PurchaseOrder[]> {
  const r = await fetch(apiUrl("/api/purchase-orders"), { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudieron cargar los pedidos a proveedor");
  return r.json();
}

export async function apiCreatePurchaseOrder(input: POInput): Promise<PurchaseOrder> {
  const r = await fetch(apiUrl("/api/purchase-orders"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo crear el pedido");
  return r.json();
}

/** Cambia el estado. `recibido` sube el stock de los ítems en el backend. */
export async function apiSetPurchaseStatus(id: string, status: POStatus): Promise<PurchaseOrder> {
  const r = await fetch(apiUrl(`/api/purchase-orders/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error("No se pudo actualizar el pedido");
  return r.json();
}
