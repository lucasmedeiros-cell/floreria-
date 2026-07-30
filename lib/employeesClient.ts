// Cliente HTTP del equipo del negocio (sección Usuarios del CRM).
// El backend vive en app/api/employees y solo deja escribir al Administrador:
// acá se ocultan los botones, pero quien manda es el servidor.

import { apiUrl } from "./apiBase";

export interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  /** Banderas extra. Hoy solo `products` (puede registrar/editar catálogo). */
  perms: { products?: boolean };
}

export interface EmployeeInput {
  name: string;
  email: string;
  phone: string;
  pass: string;
  role: string;
}

/** Roles que se pueden asignar desde el CRM (los mismos que valida la API). */
export const ROLES = ["Administrador", "Vendedora", "Repartidor"];

async function parse(r: Response) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error ?? "No se pudo completar la operación");
  return data;
}

export async function apiListEmployees(): Promise<Employee[]> {
  const r = await fetch(apiUrl("/api/employees"), { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudo cargar el equipo");
  return r.json();
}

export async function apiCreateEmployee(input: EmployeeInput): Promise<Employee> {
  return parse(
    await fetch(apiUrl("/api/employees"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

/**
 * Guardado parcial: se manda solo lo que cambia (activar/desactivar o el
 * permiso de catálogo). Mandar ambos a la vez también funciona.
 */
export async function apiUpdateEmployee(
  id: string,
  patch: { active?: boolean; perms?: { products: boolean } }
): Promise<Employee> {
  return parse(
    await fetch(apiUrl(`/api/employees/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}
