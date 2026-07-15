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
  /** Precio anterior en Bs (para mostrar descuento). */
  originalPrice?: number;
  /** Fecha ISO hasta la que dura la oferta (activa la cuenta regresiva). */
  validUntil?: string;
  image: string;
  /** Imagen secundaria (tarjeta flotante del hero). */
  imageAlt?: string;
  stats: PromoStat[];
  highlights: PromoHighlight[];
  ctaLabel: string;
  /** Mensaje con el que se abre WhatsApp al pulsar el CTA. */
  whatsappMessage: string;
}

/** Config editable de la landing (promo + interruptor de visibilidad). */
export interface PromoConfig extends Promo {
  /** Si está desactivada, /promo muestra un aviso en vez de la landing. */
  enabled: boolean;
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
    originalPrice: p.originalPrice,
    // Sin fecha límite: la cuenta regresiva se activa al fijar una en el panel.
    validUntil: undefined,
    image: hero?.image ?? "",
    imageAlt: alt?.image ?? "",
    stats: p.stats,
    highlights: p.highlights,
    ctaLabel: p.ctaLabel,
    whatsappMessage: `¡Hola ${name}! ${r.emoji} Quiero pedir la promoción de *${p.productName}*.`,
  };
}

/** Config por defecto (rubro por defecto + activada). Server-safe. */
export const defaultPromoConfig: PromoConfig = promoFromRubro(DEFAULT_RUBRO_ID);
