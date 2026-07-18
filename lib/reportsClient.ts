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
  gastos: number;
  ganancia: number;
  stockBajo: number;
  totalProductos: number;
  porMetodo: ReportMetodo[];
  topProductos: ReportTop[];
  porMes: ReportMes[];
}

export async function apiReports(): Promise<Reports> {
  const r = await fetch(apiUrl("/api/reports"), { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudieron cargar los reportes");
  return r.json();
}
