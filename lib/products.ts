// ===== Producto (neutro, sirve a cualquier rubro) =====
// El catálogo ya no vive acá: cada rubro trae el suyo (ver lib/rubros.ts) y el
// negocio carga los propios desde el CRM. Este archivo solo define el modelo y
// los helpers que comparten la tienda, el panel y el bot.

/**
 * Número de respaldo del negocio. La tienda usa el número al que está vinculado
 * el Vendedor 24/7 (Baileys, vía /api/whatsapp/number) o el de Configuración;
 * este valor solo entra cuando ninguno está disponible (p. ej. en Netlify, que
 * es serverless y no mantiene la conexión de Baileys).
 */
export const kWhatsapp = "59177648081";

export type ProductStatus = "activo" | "inactivo";

export const productStatusLabel = (s: ProductStatus): string =>
  s === "activo" ? "Activo" : "Inactivo";

export interface Product {
  id: string; // SKU / código interno del negocio (R208, FT101, AP204…)
  name: string;
  desc: string;
  price: number; // Bs (venta)
  /** Bs (costo). Lo que le cuesta al negocio; se carga al ingresar mercadería. */
  cost?: number;
  /**
   * Código de barras FÍSICO del producto (EAN-13, UPC-A, Code128…), el impreso
   * en el envase. No es el SKU: un repuesto trae su EAN de fábrica y el negocio
   * le pone además su propio SKU. Vacío = el producto no tiene código.
   */
  barcode?: string;
  /** Foto del producto. Vacío = se pinta el placeholder del rubro. */
  image: string;
  category: string;
  featured?: boolean;
  stock?: number;
  status?: ProductStatus;
}

/** Minúsculas y SIN acentos, para buscar como Google ("bujias" → "bujías"). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Búsqueda rápida por SKU/código (id), nombre, categoría, código de barras y
 * palabras clave (descripción). Ignora acentos y mayúsculas, y todos los
 * términos deben coincidir (AND) — se pueden poner varias referencias.
 */
export function searchProducts(list: Product[], q: string): Product[] {
  const t = normalize(q.trim());
  if (!t) return list;
  const terms = t.split(/\s+/);
  return list.filter((p) => {
    const hay = normalize(
      `${p.id} ${p.name} ${p.category} ${p.desc} ${p.barcode ?? ""}`
    );
    return terms.every((term) => hay.includes(term));
  });
}

/** Busca por código de barras exacto (lo que devuelve el escáner). */
export const findByBarcode = (list: Product[], code: string): Product | undefined => {
  const c = code.trim();
  return c ? list.find((p) => (p.barcode ?? "") === c) : undefined;
};

/** Busca un producto por SKU dentro de un catálogo. */
export const findProduct = (list: Product[], id: string): Product | undefined =>
  list.find((p) => p.id === id);

/** "1850" -> "1.850" (separador de miles es-BO). */
function group(n: number): string {
  const s = Math.abs(n).toString();
  let b = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) b += ".";
    b += s[i];
  }
  return (n < 0 ? "-" : "") + b;
}

export const bs = (n: number): string => `Bs ${group(n)}`;

/** 305.0 -> "Bs 305,00" */
export function bs2(v: number): string {
  const neg = v < 0;
  v = Math.abs(v);
  const intPart = Math.floor(v);
  const dec = Math.round((v - intPart) * 100);
  const decStr = dec.toString().padStart(2, "0");
  return `${neg ? "-" : ""}Bs ${group(intPart)},${decStr}`;
}

/**
 * Normaliza los atributos de rubro que manda el cliente a un objeto plano de
 * strings no vacías (marca, compatibilidad, etc.). Descarta valores que no sean
 * texto y recorta, para no guardar basura ni estructuras anidadas en el JSON.
 */
export function plainAttrs(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}
