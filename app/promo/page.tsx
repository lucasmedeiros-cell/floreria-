import type { Metadata } from "next";
import { readPromoConfig } from "@/lib/promoStore";
import { readBusinessConfig } from "@/lib/businessStore";
import { promoMetadata } from "@/lib/promoMeta";
import { PromoLanding } from "@/components/promo/PromoLanding";

export const dynamic = "force-dynamic";

/**
 * Landing PRINCIPAL del negocio. Las demás cuelgan de `/promo/<slug>`
 * (ver `app/promo/[slug]/page.tsx`), y cuál es la principal se elige desde el
 * CRM (Configuración → Landings).
 */
export async function generateMetadata(): Promise<Metadata> {
  const [promo, business] = await Promise.all([
    readPromoConfig(),
    readBusinessConfig(),
  ]);
  return promoMetadata(promo, business.name);
}

export default async function PromoPage() {
  const promo = await readPromoConfig();
  return <PromoLanding promo={promo} />;
}
