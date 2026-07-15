import type { Metadata } from "next";
import { readPromoConfig } from "@/lib/promoStore";
import { readBusinessConfig } from "@/lib/businessStore";
import { PromoLanding } from "@/components/promo/PromoLanding";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [promo, business] = await Promise.all([
    readPromoConfig(),
    readBusinessConfig(),
  ]);
  return {
    title: `${promo.title} · ${business.name}`,
    description: promo.subtitle,
  };
}

export default async function PromoPage() {
  const promo = await readPromoConfig();
  return <PromoLanding promo={promo} />;
}
