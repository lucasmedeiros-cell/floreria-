// ===== Landing promocional (oferta destacada) =====
// La landing /promo se configura desde el panel (Configuración → Landing).
// Sus valores por defecto salen del RUBRO activo (lib/rubros.ts): al cambiar de
// rubro, la promo se regenera con el producto estrella de ese rubro.

import { DEFAULT_RUBRO_ID, getRubro, type RubroId } from "./rubros";

export interface PromoStat {
  value: string;
  label: string;
}

export interface PromoHighlight {
  /** Nombre de un icono (ver components/Icon.tsx). */
  icon: string;
  title: string;
  text?: string;
}

/**
 * Cómo se maqueta la landing.
 *
 *  - `ficha`   — la de siempre: galería, datos y tarjeta de compra en claro.
 *  - `vitrina` — una sola pantalla de escaparate: fondo propio, producto grande
 *                y dos botones. Pensada para campañas de un solo producto.
 */
export type PromoLayout = "ficha" | "vitrina";

/**
 * Aspecto de la landing `vitrina`. Todo lo que se ve en pantalla sale de acá,
 * así que un negocio puede armar la suya sin tocar código.
 */
export interface PromoTheme {
  /** Imagen de fondo a pantalla completa. Vacío = solo `backgroundColor`. */
  background: string;
  /** Color debajo de la imagen (y de fondo si no hay imagen). */
  backgroundColor: string;
  /** Oscurecido sobre la imagen, 0–100. Sin esto el texto no se lee. */
  overlay: number;
  /** Color principal: títulos, botones, bordes y adornos. */
  accent: string;
  /** Segundo color del degradado del dorado. */
  accentDeep: string;
  /** Color del texto sobre el fondo. */
  text: string;
  /** Color del texto secundario. */
  textSoft: string;
  /** Marco ornamental en las cuatro esquinas. */
  frame: boolean;
}

export const defaultPromoTheme: PromoTheme = {
  background: "",
  backgroundColor: "#0B0705",
  overlay: 45,
  accent: "#F5C445",
  accentDeep: "#9A6B12",
  text: "#FFFFFF",
  textSoft: "#C9BCA4",
  frame: true,
};

export interface Promo {
  /** SKU del producto de referencia (opcional, solo informativo). */
  productId?: string;
  eyebrow: string;
  badge?: string;
  title: string;
  subtitle: string;
  productName: string;
  description: string;
  /** Precio en Bs. */
  price: number;
  /**
   * Precio anterior en Bs (para mostrar descuento). `null` = sin descuento.
   * Se guarda como null y no como undefined a propósito: `JSON.stringify` borra
   * las claves undefined, y al releer la config el valor por defecto del rubro
   * volvería a colarse — o sea, no habría forma de quitar el precio anterior.
   */
  originalPrice?: number | null;
  /** Fecha ISO hasta la que dura la oferta (null = sin cuenta regresiva). */
  validUntil?: string | null;
  image: string;
  /** Imagen secundaria (tarjeta flotante del hero). */
  imageAlt?: string;
  stats: PromoStat[];
  highlights: PromoHighlight[];
  ctaLabel: string;
  /** Mensaje con el que se abre WhatsApp al pulsar el CTA. */
  whatsappMessage: string;

  // ----- Maqueta y aspecto (los usa el diseño `vitrina`) -----

  layout: PromoLayout;
  theme: PromoTheme;
  /**
   * A qué WhatsApp entra el pedido:
   *  - `negocio`  — el teléfono que cargó el negocio (contesta una persona).
   *  - `vendedor` — el número del Vendedor 24/7, o sea el bot con IA.
   */
  whatsappTarget: "negocio" | "vendedor";
  /** Píldora bajo el título ("PRESENTACIÓN 30 ML"). Vacío = no se muestra. */
  presentation: string;
  /** Nota chica al lado del botón de WhatsApp ("Compra segura"). */
  secureNote: string;
  /** Botón de arriba a la derecha. */
  catalogLabel: string;
  /** Adónde va ese botón. Vacío = al catálogo de la tienda del negocio. */
  catalogUrl: string;
  /** Marca de la cabecera. Vacío = el nombre del negocio. */
  brandTitle: string;
  /** Segunda línea de la marca. Vacío = la bajada del negocio. */
  brandSubtitle: string;
}

/** Config editable de la landing (promo + interruptor de visibilidad). */
export interface PromoConfig extends Promo {
  /** Si está desactivada, /promo muestra un aviso en vez de la landing. */
  enabled: boolean;
}

/**
 * Una landing publicada del negocio. Un negocio puede tener VARIAS (una por
 * campaña, sucursal o producto estrella): la primera de la lista es la
 * principal y se sirve en `/promo`; las demás en `/promo/<slug>`.
 */
export interface PromoPage extends PromoConfig {
  /** Identificador estable: no cambia aunque se renombre o cambie el slug. */
  id: string;
  /** Segmento de la URL (`/promo/<slug>`). Único dentro del negocio. */
  slug: string;
  /** Nombre para reconocerla en el CRM; no se publica. */
  name: string;
}

/** Tope de landings por negocio: más que esto es lista imposible de mantener. */
export const MAX_PROMO_PAGES = 12;

/**
 * Rutas que ya existen bajo `/promo/…` o que confundirían al abrir el enlace.
 * Un slug reservado se guarda con sufijo para no chocar con ellas.
 */
const RESERVED_SLUGS = new Set(["api", "admin", "n", "nueva", "new", "index"]);

/** Texto libre → segmento de URL (“Oferta de Navidad 🎄” → `oferta-de-navidad`). */
export function promoSlugify(v: unknown): string {
  const s = (typeof v === "string" ? v : "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return s && RESERVED_SLUGS.has(s) ? `${s}-1` : s;
}

/** Slug libre dentro del negocio: si `oferta` ya está tomado, da `oferta-2`. */
export function uniquePromoSlug(
  wanted: unknown,
  taken: string[],
  fallback = "landing"
): string {
  const base = promoSlugify(wanted) || fallback;
  if (!taken.includes(base)) return base;
  for (let i = 2; i <= taken.length + 2; i++) {
    const s = `${base}-${i}`;
    if (!taken.includes(s)) return s;
  }
  return `${base}-${taken.length + 1}`;
}

/** Promo por defecto de un rubro: su producto estrella con textos ya escritos. */
export function promoFromRubro(
  rubroId: RubroId,
  businessName?: string
): PromoConfig {
  const r = getRubro(rubroId);
  const p = r.promo;
  const name = businessName ?? r.brandName;
  const hero = r.catalog.find((x) => x.id === p.productId);
  const alt = r.catalog.find((x) => x.featured && x.id !== p.productId);

  return {
    // Instalación nueva (rubro sin definir): la landing queda despublicada
    // hasta que se configure desde el panel.
    enabled: rubroId !== "generico",
    productId: p.productId,
    eyebrow: p.eyebrow,
    badge: p.badge,
    title: p.title,
    subtitle: p.subtitle,
    productName: p.productName,
    description: p.description,
    price: p.price,
    originalPrice: p.originalPrice || null,
    // Sin fecha límite: la cuenta regresiva se activa al fijar una en el panel.
    validUntil: null,
    image: hero?.image ?? "",
    imageAlt: alt?.image ?? "",
    stats: p.stats,
    highlights: p.highlights,
    ctaLabel: p.ctaLabel,
    whatsappMessage: `¡Hola ${name}! ${r.emoji} Quiero pedir la promoción de *${p.productName}*.`,
    // El diseño de siempre: las landings que ya existen no cambian de aspecto
    // al agregarse `vitrina`. Se elige desde el CRM.
    layout: "ficha",
    theme: defaultPromoTheme,
    whatsappTarget: "negocio",
    presentation: "",
    secureNote: "Compra segura",
    catalogLabel: "Ver catálogo",
    catalogUrl: "",
    brandTitle: "",
    brandSubtitle: "",
  };
}

/** Config por defecto (rubro por defecto + activada). Server-safe. */
export const defaultPromoConfig: PromoConfig = promoFromRubro(DEFAULT_RUBRO_ID);

// ===== Saneado de lo que llega del CRM =====

const text = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v.trim() : fallback;

const money = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Campo opcional de precio: vacío/0/basura ⇒ null (o sea, "sin precio anterior"). */
const optMoney = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = money(v);
  return n > 0 ? n : null;
};

/**
 * Color de un `<input type="color">`. Cualquier cosa que no sea un hex válido
 * cae al del tema por defecto: un color roto dejaría texto invisible sobre el
 * fondo, y desde la landing pública no hay forma de arreglarlo.
 */
const color = (v: unknown, fallback: string): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
};

const clamp = (v: unknown, fallback: number, min = 0, max = 100): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** Aspecto de la vitrina, con todo dentro de rangos que sepamos dibujar. */
function sanitizeTheme(input: unknown, base: PromoTheme): PromoTheme {
  const t = (input ?? {}) as Partial<PromoTheme>;
  return {
    background: text(t.background, base.background),
    backgroundColor: color(t.backgroundColor, base.backgroundColor),
    overlay: clamp(t.overlay, base.overlay),
    accent: color(t.accent, base.accent),
    accentDeep: color(t.accentDeep, base.accentDeep),
    text: color(t.text, base.text),
    textSoft: color(t.textSoft, base.textSoft),
    frame: typeof t.frame === "boolean" ? t.frame : base.frame,
  };
}

/** Fecha del `datetime-local` del CRM. Si no es una fecha real, null. */
const optDate = (v: unknown): string | null => {
  if (typeof v !== "string" || v.trim() === "") return null;
  return Number.isNaN(new Date(v).getTime()) ? null : v.trim();
};

/**
 * Normaliza lo que manda el CRM antes de guardarlo.
 *
 * Todo campo vacío o inválido cae al valor del rubro, salvo los opcionales
 * (precio anterior, vigencia, badge), que se pueden dejar vacíos a propósito.
 * Las listas se recortan a un tamaño que la landing sepa maquetar y se les
 * tiran las filas sin título.
 */
export function sanitizePromo(
  input: Partial<PromoConfig>,
  base: PromoConfig
): PromoConfig {
  const stats = Array.isArray(input.stats)
    ? input.stats
        .map((s) => ({ value: text(s?.value, ""), label: text(s?.label, "") }))
        .filter((s) => s.value !== "" || s.label !== "")
        .slice(0, 8)
    : base.stats;

  const highlights = Array.isArray(input.highlights)
    ? input.highlights
        .map((h) => ({
          icon: text(h?.icon, "Store") || "Store",
          title: text(h?.title, ""),
          text: text(h?.text, ""),
        }))
        .filter((h) => h.title !== "")
        .slice(0, 9)
    : base.highlights;

  return {
    enabled: input.enabled ?? base.enabled,
    productId: text(input.productId, "") || undefined,
    eyebrow: text(input.eyebrow, base.eyebrow) || base.eyebrow,
    badge: text(input.badge, ""),
    title: text(input.title, base.title) || base.title,
    subtitle: text(input.subtitle, base.subtitle) || base.subtitle,
    productName:
      text(input.productName, base.productName) || base.productName,
    description: text(input.description, base.description) || base.description,
    price: money(input.price ?? base.price),
    originalPrice: optMoney(input.originalPrice),
    validUntil: optDate(input.validUntil),
    image: text(input.image, base.image),
    imageAlt: text(input.imageAlt, ""),
    stats,
    highlights,
    ctaLabel: text(input.ctaLabel, base.ctaLabel) || base.ctaLabel,
    whatsappMessage:
      text(input.whatsappMessage, base.whatsappMessage) || base.whatsappMessage,
    layout: input.layout === "vitrina" ? "vitrina" : "ficha",
    theme: sanitizeTheme(input.theme, base.theme ?? defaultPromoTheme),
    whatsappTarget: input.whatsappTarget === "vendedor" ? "vendedor" : "negocio",
    // Estos van vacíos a propósito cuando el negocio los borra: cada uno tiene
    // su propio respaldo en la landing (el nombre del negocio, o no mostrarse).
    presentation: text(input.presentation, ""),
    secureNote: text(input.secureNote, ""),
    catalogLabel: text(input.catalogLabel, base.catalogLabel) || base.catalogLabel,
    catalogUrl: text(input.catalogUrl, ""),
    brandTitle: text(input.brandTitle, ""),
    brandSubtitle: text(input.brandSubtitle, ""),
  };
}

/**
 * Igual que `sanitizePromo`, pero para una landing de la lista: además de los
 * textos de la promo, fija su nombre interno y su slug.
 *
 * `takenSlugs` son los slugs de LAS DEMÁS landings del negocio (sin la que se
 * está guardando): el slug se corrige acá y no en la base, así que sin esa
 * lista dos landings podrían terminar respondiendo a la misma URL.
 */
export function sanitizePromoPage(
  input: Partial<PromoPage>,
  base: PromoConfig,
  ctx: { id: string; takenSlugs: string[] }
): PromoPage {
  const cfg = sanitizePromo(input, base);
  const name = (text(input.name, "") || cfg.title || "Landing").slice(0, 60);
  return {
    ...cfg,
    id: ctx.id,
    name,
    // Slug vacío ⇒ se deduce del nombre, que es lo que espera quien nunca lo
    // tocó; si choca con otra landing, se numera.
    slug: uniquePromoSlug(text(input.slug, "") || name, ctx.takenSlugs),
  };
}
