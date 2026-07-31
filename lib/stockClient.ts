import { apiUrl } from "./apiBase";

/**
 * Movimientos de stock a mano: recibir mercadería (delta positivo) y devolver
 * mercadería (delta negativo). Los pedidos a proveedor tienen su propio camino
 * (`purchaseClient`); esto es para lo que entra o sale sin pedido de por medio.
 *
 * El backend deja el movimiento registrado con su motivo en `stock_moves`, así
 * que el ajuste queda auditado y no es un cambio de número a ciegas.
 */
export async function apiAdjustStock(
  productId: string,
  delta: number,
  reason: string
): Promise<{ stock: number }> {
  const r = await fetch(apiUrl(`/api/products/${encodeURIComponent(productId)}/adjust`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta, reason }),
  });
  if (!r.ok) {
    const e = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? "No se pudo ajustar el stock");
  }
  return r.json();
}
