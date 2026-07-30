// Cliente HTTP del Corte de caja. El backend vive en app/api/cash.
//
// El "turno" son las ventas hechas desde el último cierre (o desde que arrancó
// el día, si todavía no hubo ninguno). Cerrar la caja guarda la foto del turno
// junto con el efectivo que se contó a mano, y el siguiente turno arranca de
// cero.

import { apiUrl } from "./apiBase";

/** Resumen del turno abierto: lo que el sistema dice que debería haber. */
export interface CashShift {
  /** Desde cuándo cuenta este turno (null = desde el inicio del día). */
  fromAt: string | null;
  numVentas: number;
  totalVentas: number;
  totalEfectivo: number;
  /** QR y transferencia van al mismo cubo. */
  totalQr: number;
  totalOtros: number;
}

/** Lo que devuelve el cierre: sobre todo, la diferencia del arqueo. */
export interface CashClose {
  id: string;
  closedAt: string;
  totalVentas: number;
  totalEfectivo: number;
  countedCash: number;
  difference: number;
}

export async function apiCashShift(): Promise<CashShift> {
  const r = await fetch(apiUrl("/api/cash"), { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudo cargar el turno de caja");
  return r.json();
}

export async function apiCloseCash(countedCash: number, notes = ""): Promise<CashClose> {
  const r = await fetch(apiUrl("/api/cash"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countedCash, notes }),
  });
  if (!r.ok) {
    throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo cerrar la caja");
  }
  // El INSERT ... RETURNING devuelve los `numeric` de Postgres como texto; acá
  // se normalizan a número para que la pantalla no muestre "Bs NaN".
  const raw = await r.json();
  return {
    ...raw,
    totalVentas: Number(raw.totalVentas) || 0,
    totalEfectivo: Number(raw.totalEfectivo) || 0,
    countedCash: Number(raw.countedCash) || 0,
    difference: Number(raw.difference) || 0,
  };
}
