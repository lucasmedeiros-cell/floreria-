// ============================================================
//  Configuración del negocio (multi-rubro)
// ------------------------------------------------------------
//  El sistema no está atado a una florería: se elige un RUBRO (ver lib/rubros.ts)
//  y encima se guardan los datos propios del negocio (nombre, WhatsApp, dirección,
//  colores, categorías…). La web, la landing /promo y el CRM leen todo desde acá.
//
//  Data pura y serializable: la usan el servidor (layout, API, bot) y el cliente
//  (StoreProvider → useBusiness()).
// ============================================================

import { defaultModules, normalizeModules, type Modules } from "./modules";
import { DEFAULT_RUBRO_ID, getRubro, type Rubro, type RubroId } from "./rubros";

/**
 * Paleta de easy pos (amarillo + negro). FIJA: es la marca del producto, no
 * cambia con el rubro ni con el negocio. Debe coincidir con app/globals.css.
 */
export const EASYPOS_COLORS = {
  accent: "#FEBB03",
  accentDeep: "#E2A500",
  soft: "#FFF3CC",
  hero: "#FFFAEB",
  onAccent: "#14110F",
} as const;

export interface BusinessConfig {
  /** Rubro activo. Define colores, textos, categorías y catálogo demo. */
  rubroId: RubroId;

  /**
   * Secciones del CRM que usa este negocio (ver lib/modules.ts). Una tienda de
   * repuestos que no reparte apaga "entregas" y la sección desaparece del menú.
   * Arrancan según el rubro y se cambian en Configuración → Módulos del CRM.
   */
  modules: Modules;

  /**
   * false = instalación nueva de easy pos, todavía sin negocio.
   * Pasa a true en cuanto se guarda la configuración desde el panel (o cuando
   * se vincule un negocio con el pareo). El CRM lo usa para avisar que falta
   * configurar y para no mostrar datos de ejemplo como si fueran reales.
   */
  configured: boolean;

  // ---- Marca ----
  name: string;
  /** Parte inicial del nombre en tipografía fina ("Flores" de FloresOnline). */
  nameLight: string;
  tagline: string;
  /** URL de un logo propio. Vacío = se usa el icono del rubro. */
  logoUrl: string;

  // ---- Contacto ----
  whatsapp: string;
  phone: string;
  address: string;
  hours: string;

  // ---- Ventas ----
  payReference: string;
  deliveryCost: number;
  payMethods: Record<string, boolean>;

  // ---- Catálogo ----
  categories: string[];

  // ---- Look (sobrescribe la paleta del rubro) ----
  colors: { accent: string; accentDeep: string; soft: string; hero: string };

  // ---- Copy de la tienda (sobrescribe el del rubro) ----
  hero: {
    eyebrow: string;
    title: string;
    highlight: string;
    subtitle: string;
  };
  about: string;
}

/**
 * Config por defecto de un rubro: el preset (marca, colores, textos, categorías).
 *
 * Los DATOS DEL NEGOCIO (WhatsApp, teléfono, dirección, horario) quedan VACÍOS:
 * son de cada negocio, no del rubro, y se cargan al configurar o al parear. Así
 * una instalación nueva no arrastra los datos de nadie.
 */
export function businessFromRubro(rubroId: RubroId): BusinessConfig {
  const r = getRubro(rubroId);
  return {
    rubroId: r.id,
    modules: defaultModules(r.id),
    configured: false,
    name: r.brandName,
    nameLight: r.brandLight,
    tagline: r.tagline,
    logoUrl: "",
    whatsapp: "",
    phone: "",
    address: "",
    hours: "",
    payReference: "",
    deliveryCost: 0,
    payMethods: { Efectivo: true, "QR / Transferencia": true, Tarjeta: false },
    categories: [...r.categories],
    // Colores fijos de easy pos (ya no salen del rubro): la marca es una sola.
    colors: {
      accent: EASYPOS_COLORS.accent,
      accentDeep: EASYPOS_COLORS.accentDeep,
      soft: EASYPOS_COLORS.soft,
      hero: EASYPOS_COLORS.hero,
    },
    hero: {
      eyebrow: r.hero.eyebrow,
      title: r.hero.title,
      highlight: r.hero.highlight,
      subtitle: r.hero.subtitle,
    },
    about: r.about,
  };
}

export const defaultBusinessConfig: BusinessConfig =
  businessFromRubro(DEFAULT_RUBRO_ID);

/**
 * Normaliza una config leída de la BD (o enviada por el cliente) contra los
 * defaults del rubro, para tolerar configs viejas a las que les falte un campo.
 */
export function normalizeBusiness(raw: Partial<BusinessConfig> | null | undefined): BusinessConfig {
  const rubroId = getRubro(raw?.rubroId).id;
  const base = businessFromRubro(rubroId);
  if (!raw) return base;
  const categories = (raw.categories ?? base.categories)
    .map((c) => c.trim())
    .filter(Boolean);
  return {
    ...base,
    ...raw,
    rubroId,
    modules: normalizeModules(raw.modules, rubroId),
    configured: raw.configured ?? base.configured,
    categories: categories.length ? categories : base.categories,
    colors: { ...base.colors, ...raw.colors },
    hero: { ...base.hero, ...raw.hero },
    payMethods: { ...base.payMethods, ...raw.payMethods },
    deliveryCost: Number(raw.deliveryCost ?? base.deliveryCost) || 0,
  };
}

// ============================================================
//  Business resuelto (config + preset del rubro)
// ============================================================

export interface Business extends BusinessConfig {
  rubro: Rubro;
  /** "Todos" + las categorías del negocio (para los filtros de la tienda). */
  allCategories: string[];
  /** Catálogo demo del rubro (semilla de la tienda mientras no haya productos propios). */
  catalog: Rubro["catalog"];
  /** Cómo llamar a un producto en este rubro ("arreglo", "repuesto", "plato"). */
  noun: Rubro["noun"];
  /** Saludo con el que arrancan los mensajes de WhatsApp. */
  greeting: string;
}

export const kAll = "Todos";

export function resolveBusiness(cfg: BusinessConfig): Business {
  const rubro = getRubro(cfg.rubroId);
  return {
    ...cfg,
    // Estos textos ya NO son configurables (solo nombre y logo lo son): salen
    // siempre del rubro, así no quedan pegados valores viejos al cambiar de rubro.
    nameLight: rubro.brandLight,
    tagline: rubro.tagline,
    about: rubro.about,
    hero: {
      eyebrow: rubro.hero.eyebrow,
      title: rubro.hero.title,
      highlight: rubro.hero.highlight,
      subtitle: rubro.hero.subtitle,
    },
    // Colores fijos de easy pos (la marca del producto).
    colors: {
      accent: EASYPOS_COLORS.accent,
      accentDeep: EASYPOS_COLORS.accentDeep,
      soft: EASYPOS_COLORS.soft,
      hero: EASYPOS_COLORS.hero,
    },
    rubro,
    allCategories: [kAll, ...cfg.categories],
    catalog: rubro.catalog,
    noun: rubro.noun,
    greeting: `¡Hola ${cfg.name}! ${rubro.emoji}`,
  };
}

/** Persona por defecto del Vendedor 24/7 para este negocio. */
export function botPersonaFor(cfg: BusinessConfig): string {
  const rubro = getRubro(cfg.rubroId);
  return `Eres el asistente de ventas de ${cfg.name}, ${rubro.bot.persona}`;
}

// ============================================================
//  Tema (variables CSS)
// ============================================================

/** "#E8366B" → "232 54 107" (formato que espera Tailwind con <alpha-value>). */
export function hexToRgbChannels(hex: string): string {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return "232 54 107";
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * Color de texto legible SOBRE el color de marca. Un rubro con acento claro
 * (amarillo, lima) necesita texto negro; uno oscuro (azul, vino), texto blanco.
 * Fórmula de luminancia relativa (WCAG).
 */
export function onAccent(hex: string): string {
  const [r, g, b] = hexToRgbChannels(hex).split(" ").map(Number);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#14110F" : "#FFFFFF";
}

/**
 * Variables CSS del tema. Toda la web y el CRM usan los colores de easy pos;
 * ya no dependen de la config del negocio (solo el nombre y el logo son
 * configurables). Se mantiene la firma con `cfg` por compatibilidad.
 */
export function themeVars(_cfg?: BusinessConfig): Record<string, string> {
  return {
    "--c-accent": hexToRgbChannels(EASYPOS_COLORS.accent),
    "--c-accent-deep": hexToRgbChannels(EASYPOS_COLORS.accentDeep),
    "--c-accent-soft": hexToRgbChannels(EASYPOS_COLORS.soft),
    "--c-accent-hero": hexToRgbChannels(EASYPOS_COLORS.hero),
    "--c-on-accent": hexToRgbChannels(EASYPOS_COLORS.onAccent),
  };
}
