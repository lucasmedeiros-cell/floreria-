// Cliente HTTP de Gastos (egresos del negocio). El backend vive en
// app/api/expenses. Los gastos NO tocan el inventario: son plata que sale
// (alquiler, servicios, sueldos) y es lo que Reportes resta a las ventas para
// mostrar la ganancia real.

import { apiUrl } from "./apiBase";

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  /** Fecha del gasto en `YYYY-MM-DD` (la que puso quien lo cargó). */
  spentAt: string;
  createdBy: string;
  createdAt: string;
}

export interface ExpenseInput {
  category: string;
  description: string;
  amount: number;
  spentAt: string;
}

export async function apiListExpenses(): Promise<Expense[]> {
  const r = await fetch(apiUrl("/api/expenses"), { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudieron cargar los gastos");
  return r.json();
}

export async function apiCreateExpense(input: ExpenseInput): Promise<void> {
  const r = await fetch(apiUrl("/api/expenses"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo guardar el gasto");
  }
}
