import type { Metadata } from "next";
import { readPromoConfig } from "@/lib/promoStore";
import { PromoLanding } from "@/components/promo/PromoLanding";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const promo = await readPromoConfig();
  return {
    title: `${promo.title} · FloresOnline`,
    description: promo.subtitle,
  };
}

export default async function PromoPage() {
  const promo = await readPromoConfig();
  return <PromoLanding promo={promo} />;
}
