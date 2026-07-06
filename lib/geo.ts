// ============================================================
//  Geolocalización del delivery: distancia (Haversine) y zonificación.
// ============================================================

import {
  BOLIVIA_BOUNDS,
  FLORERIA,
  ZONAS,
  type Zona,
} from "./deliveryConfig";

/** Distancia en kilómetros entre dos puntos (fórmula de Haversine). */
export function calcularDistancia(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // radio terrestre en km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** true si las coordenadas son números válidos dentro de Bolivia. */
export function coordenadasValidas(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= BOLIVIA_BOUNDS.latMin &&
    lat <= BOLIVIA_BOUNDS.latMax &&
    lng >= BOLIVIA_BOUNDS.lngMin &&
    lng <= BOLIVIA_BOUNDS.lngMax
  );
}

/** Devuelve la zona cuyo rango [minKm, maxKm) contiene la distancia. */
export function obtenerZona(distanciaKm: number): Zona | null {
  return (
    ZONAS.find((z) => distanciaKm >= z.minKm && distanciaKm < z.maxKm) ?? null
  );
}

export interface Cotizacion {
  ok: boolean;
  distanciaKm: number;
  zona: Zona | null;
  /** Precio del delivery en Bs (null si es fuera de radio). */
  precioDelivery: number | null;
  /** Motivo cuando ok=false (coords inválidas / fuera de radio). */
  motivo?: string;
}

/**
 * Cotiza el delivery desde la florería hasta las coordenadas del cliente.
 * ok=false si las coordenadas son inválidas o la zona requiere cotización manual.
 */
export function cotizarDelivery(lat: number, lng: number): Cotizacion {
  if (!coordenadasValidas(lat, lng)) {
    return {
      ok: false,
      distanciaKm: 0,
      zona: null,
      precioDelivery: null,
      motivo: "Coordenadas inválidas o fuera de Bolivia.",
    };
  }
  const distanciaKm = calcularDistancia(FLORERIA.lat, FLORERIA.lng, lat, lng);
  const zona = obtenerZona(distanciaKm);
  if (!zona || zona.precio === null) {
    return {
      ok: false,
      distanciaKm,
      zona,
      precioDelivery: null,
      motivo: "Fuera del radio de reparto: requiere cotización manual.",
    };
  }
  return { ok: true, distanciaKm, zona, precioDelivery: zona.precio };
}
