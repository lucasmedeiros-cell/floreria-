import { apiUrl } from "./apiBase";

export interface ReportMetodo {
  metodo: string;
  n: number;
  total: number;
}
export interface ReportTop {
  name: string;
  qty: number;
  revenue: number;
}
export interface ReportMes {
  mes: string;
  total: number;
}

export interface Reports {
  totalVentas: number;
  numVentas: number;
  ticketPromedio: number;
  costoVendido: number;
  ganancia: number;
  stockBajo: number;
  totalProductos: number;
  porMetodo: ReportMetodo[];
  topProductos: ReportTop[];
  porMes: ReportMes[];
}

/**
 * Resumen de ventas. Sin rango son TODAS; con `desde`/`hasta` (YYYY-MM-DD), las
 * de ese período — así Inicio puede pedir solo lo del día sin traerse el
 * histórico entero.
 */
export async function apiReports(rango?: {
  desde?: string;
  hasta?: string;
}): Promise<Reports> {
  const qs = new URLSearchParams();
  if (rango?.desde) qs.set("desde", rango.desde);
  if (rango?.hasta) qs.set("hasta", rango.hasta);
  const url = apiUrl("/api/reports") + (qs.size ? `?${qs}` : "");
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudieron cargar los reportes");
  return r.json();
}
