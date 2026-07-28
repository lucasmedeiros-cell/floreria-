import type { Metadata } from "next";
import type { PromoConfig } from "./promo";

/**
 * Título y descripción de una landing promocional.
 *
 * Despublicada (o inexistente): ni el título ni la vista previa del enlace
 * (WhatsApp, redes) deben seguir anunciando una oferta que la página ya no
 * muestra, y tampoco se indexa.
 */
export function promoMetadata(
  promo: Pick<PromoConfig, "enabled" | "title" | "subtitle"> | null,
  businessName: string
): Metadata {
  if (!promo?.enabled) {
    return {
      title: businessName,
      description: "En este momento no hay una oferta activa.",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${promo.title} · ${businessName}`,
    description: promo.subtitle,
  };
}
