// ============================================================
//  Configuración del delivery de la florería.
//  Ubicación fija de la tienda + tarifario por zonas concéntricas
//  (anillos de Santa Cruz de la Sierra). Todo editable acá.
// ============================================================

export const FLORERIA = {
  nombre: "Flores Online",
  direccion: "Av. La Salle",
  lat: -17.753392,
  lng: -63.191447,
};

/**
 * Centro de la ciudad (Plaza 24 de Septiembre) — referencia para estimar en
 * qué ANILLO cae un punto. Confirmar si es la referencia correcta.
 */
export const CENTRO = { lat: -17.7833, lng: -63.1821 };

// ============================================================
//  TARIFARIO REAL — courier "Radio Móvil Corea 2025"
//  Origen: Flores Online (Av. La Salle). Matriz Destino × Anillo (2A..9A).
//  ⚠️ TRANSCRITO DE FOTO — PENDIENTE VERIFICAR precios (sobre todo las
//     celdas con nota y los rangos "25-30"/"30-35").
//    - precio  : tarifa plana en Bs (no depende del anillo).
//    - anillos : precio por anillo (2..9). Anillo ausente = no indicado.
//    - rango   : celda con rango sin resolver (elegir regla: menor/mayor/fijo).
// ============================================================
export type Anillo = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface TarifaDestino {
  destino: string;
  precio?: number;
  anillos?: Partial<Record<Anillo, number>>;
  rango?: [number, number];
  nota?: string;
}

export const TARIFARIO_COREA: TarifaDestino[] = [
  { destino: "Zona Central (dentro del 1er anillo)", precio: 25 },
  { destino: "Equipetrol", anillos: { 2: 20, 3: 20, 4: 20 } },
  { destino: "Colinas del Urubo 1 y 2", rango: [25, 30] },
  { destino: "Santa Cruz de la Colina (zona Urubo)", precio: 35 },
  { destino: "La Hacienda del Urubo", precio: 30 },
  { destino: "Palacio de Justicia (planta baja)", precio: 25 },
  { destino: "Av. Banzer", anillos: { 2: 20, 3: 20, 4: 20, 5: 25, 6: 30, 7: 30, 8: 35, 9: 35 } },
  { destino: "Av. Banzer — El Remanso 1, 2 y 3", precio: 30, anillos: { 2: 35, 3: 35 }, nota: "verificar" },
  { destino: "Av. Banzer — Condominios Sevillas", precio: 40 },
  { destino: "Av. Banzer — Sevilla El Bosque", precio: 45 },
  { destino: "Av. Beni", anillos: { 2: 25, 3: 25, 4: 25, 5: 25, 6: 30, 7: 30, 8: 35 } },
  { destino: "Av. Alemana", anillos: { 2: 25, 3: 25, 4: 25, 5: 30, 6: 30, 7: 35, 8: 35 } },
  { destino: "Av. Mutualista", anillos: { 2: 25, 3: 25, 4: 30, 5: 30, 6: 30, 7: 35, 8: 35 } },
  { destino: "Av. Paragua", anillos: { 2: 30, 3: 30, 4: 30 } },
  { destino: "Zona Parque Industrial", rango: [30, 35] },
  { destino: "Zona Av. Virgen de Luján", anillos: { 6: 30, 7: 35, 8: 35 } },
  { destino: "Av. Canal Cotoca", anillos: { 2: 30, 3: 30, 4: 30 } },
  { destino: "Av. Virgen de Cotoca", anillos: { 2: 30, 3: 30, 4: 35, 5: 35, 6: 40, 7: 45, 8: 45 } },
  { destino: "Av. Brasil", anillos: { 2: 30, 3: 30, 4: 35 } },
  { destino: "Av. 3 Pasos al Frente", anillos: { 2: 35, 3: 35, 4: 35, 5: 40, 6: 40, 7: 45, 8: 50 } },
  { destino: "Zona Av. Cumaví", anillos: { 4: 35, 5: 40, 6: 40, 7: 45, 8: 50 } },
  { destino: "Zona Plan 3000", precio: 50 },
  { destino: "Av. San Aurelio", anillos: { 2: 30, 3: 35, 4: 40, 5: 40, 6: 45 } },
  { destino: "Villa Primero de Mayo", precio: 40 },
  { destino: "Av. Santos Dumont", anillos: { 2: 30, 3: 35, 4: 40, 5: 45, 6: 50, 7: 55, 8: 55 } },
  { destino: "Refinería Palmasola", precio: 60 },
  { destino: "Av. Doble Vía a La Guardia", anillos: { 2: 30, 3: 35, 4: 35, 5: 40, 6: 40, 7: 45, 8: 50 } },
  { destino: "Barrio Las Palmas", precio: 35 },
  { destino: "Radial 17½", anillos: { 4: 30, 5: 35, 6: 40, 7: 45, 8: 45 } },
  { destino: "Av. Piraí", anillos: { 2: 30, 3: 30, 4: 30, 5: 35, 6: 40, 7: 45 } },
  { destino: "Av. Roca y Coronado", anillos: { 2: 25, 3: 25, 4: 30, 5: 35 } },
  { destino: "Av. Centenario", precio: 25, anillos: { 2: 25, 3: 25, 4: 25 }, nota: "verificar" },
  { destino: "Av. Busch", precio: 25, anillos: { 2: 20, 3: 25, 4: 25 }, nota: "verificar" },
  { destino: "Av. La Salle", anillos: { 2: 20, 3: 20, 4: 20, 5: 20 } },
  { destino: "Radial 26", anillos: { 2: 20, 3: 20, 4: 20, 5: 20, 6: 25, 7: 30, 8: 35 } },
];

export interface Zona {
  nombre: string;
  minKm: number; // inclusivo
  maxKm: number; // exclusivo
  /** Precio del delivery en Bs. null = requiere cotización manual. */
  precio: number | null;
}

// PROVISIONAL — estimación por anillos concéntricos (solo para el método C /
// aproximación por distancia). El tarifario real es TARIFARIO_COREA (abajo).
export const ZONAS: Zona[] = [
  { nombre: "1A (Centro)", minKm: 0, maxKm: 1.5, precio: 25 },
  { nombre: "2A", minKm: 1.5, maxKm: 3, precio: 20 },
  { nombre: "3A (Interno)", minKm: 3, maxKm: 4.5, precio: 20 },
  { nombre: "3A (Externo)", minKm: 4.5, maxKm: 6, precio: 25 },
  { nombre: "4A-5A", minKm: 6, maxKm: 8, precio: 30 },
  { nombre: "6A-7A", minKm: 8, maxKm: 10, precio: 35 },
  { nombre: "8A-9A", minKm: 10, maxKm: 15, precio: 40 },
  // Fuera de radio: cotización manual (no se genera QR).
  { nombre: "Fuera de radio", minKm: 15, maxKm: 999, precio: null },
];

// Rango geográfico plausible para Bolivia (validación de coordenadas).
export const BOLIVIA_BOUNDS = {
  latMin: -23,
  latMax: -9,
  lngMin: -70,
  lngMax: -57,
};
