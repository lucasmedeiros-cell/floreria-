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
