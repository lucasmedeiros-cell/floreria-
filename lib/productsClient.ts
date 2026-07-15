// Cliente HTTP del catálogo. El CRM y la tienda leen y escriben los MISMOS
// productos (tabla `products`), así que lo que se carga en el panel aparece en
// la web y viceversa — nada de catálogos en código.

import { apiUrl } from "./apiBase";
import type { Product } from "./products";

const json = { "Content-Type": "application/json" };

/** Catálogo real de la base de datos (público). */
export async function apiListProducts(): Promise<Product[]> {
  const r = await fetch(apiUrl("/api/products"), { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudo cargar el catálogo");
  return r.json();
}

export async function apiCreateProduct(p: Product): Promise<Product> {
  const r = await fetch(apiUrl("/api/products"), {
    method: "POST",
    headers: json,
    body: JSON.stringify(p),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo crear");
  return r.json();
}

export async function apiUpdateProduct(
  id: string,
  patch: Partial<Product>
): Promise<Product> {
  const r = await fetch(apiUrl(`/api/products/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: json,
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo guardar");
  return r.json();
}

export async function apiDeleteProduct(id: string): Promise<void> {
  const r = await fetch(apiUrl(`/api/products/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });
  if (!r.ok) throw new Error("No se pudo eliminar");
}
