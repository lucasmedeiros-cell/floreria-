// Cliente HTTP del módulo de Ventas (POS). El backend vive en app/api/sales.
//   · kind 'factura'  → venta real: descuenta stock del inventario.
//   · kind 'proforma' → cotización: no toca el stock.

import { apiUrl } from "./apiBase";

export type SaleKind = "factura" | "proforma";

/** Un ítem del comprobante (lo que arma el POS antes de cobrar). */
export interface SaleLine {
  productId: string | null;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
}

/** Datos que se mandan al registrar la venta. */
export interface SaleInput {
  kind: SaleKind;
  clientName?: string;
  clientPhone?: string;
  clientNit?: string;
  payMethod?: string;
  notes?: string;
  items: SaleLine[];
  /**
   * Id único de ESTE cobro. El backend lo usa para idempotencia: si un reintento
   * (red, doble envío) manda el mismo `clientRef`, NO se duplica la venta ni se
   * descuenta stock dos veces.
   */
  clientRef?: string;
}

/** Venta ya registrada (lo que devuelve el backend). */
export interface Sale {
  id: string;
  code: string;
  kind: SaleKind;
  total: number;
  createdAt: string;
}

/** Fila del listado de ventas/proformas. */
export interface SaleRow {
  id: string;
  code: string;
  kind: SaleKind;
  clientName: string;
  total: number;
  payMethod: string;
  createdAt: string;
  itemCount: number;
  /** Anulada: sigue en el historial (queda el rastro) pero ya no cuenta. */
  voided: boolean;
}

/** Un ítem tal como quedó guardado en la venta. */
export interface SaleItem {
  name: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
}

/** Venta con sus ítems — lo que hace falta para reimprimir el comprobante. */
export interface SaleDetail extends SaleRow {
  clientPhone: string;
  subtotal: number;
  discount: number;
  items: SaleItem[];
}

export async function apiCreateSale(input: SaleInput): Promise<Sale> {
  const r = await fetch(apiUrl("/api/sales"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo registrar la venta");
  }
  return r.json();
}

export async function apiListSales(kind?: SaleKind): Promise<SaleRow[]> {
  const qs = kind ? `?kind=${kind}` : "";
  const r = await fetch(apiUrl(`/api/sales${qs}`), { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudieron cargar las ventas");
  return r.json();
}

/** Una venta con sus ítems (para verla o reimprimir el comprobante). */
export async function apiGetSale(id: string): Promise<SaleDetail> {
  const r = await fetch(apiUrl(`/api/sales/${id}`), { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudo cargar la venta");
  return r.json();
}

/**
 * Anula una venta. Si era una factura, el backend DEVUELVE el stock de cada
 * ítem al inventario; la proforma nunca lo tocó, así que solo se marca.
 */
export async function apiVoidSale(id: string): Promise<void> {
  const r = await fetch(apiUrl(`/api/sales/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ void: true }),
  });
  if (!r.ok) {
    throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo anular la venta");
  }
}
