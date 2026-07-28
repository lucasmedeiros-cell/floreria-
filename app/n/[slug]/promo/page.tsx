import type { Metadata } from "next";
import { readPromoConfig } from "@/lib/promoStore";
import { readBusinessConfig } from "@/lib/businessStore";
import { promoMetadata } from "@/lib/promoMeta";
import { PromoLanding } from "@/components/promo/PromoLanding";
import { runWithSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Landing PRINCIPAL del negocio: `/n/<slug>/promo`. Las demás campañas del
 * mismo negocio cuelgan de `/n/<slug>/promo/<landing>`.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const { promo, business } = await runWithSlug(params.slug, async () => {
    const [promo, business] = await Promise.all([
      readPromoConfig(),
      readBusinessConfig(),
    ]);
    return { promo, business };
  });
  return promoMetadata(promo, business.name);
}

export default async function PromoNegocio({
  params,
}: {
  params: { slug: string };
}) {
  const promo = await runWithSlug(params.slug, readPromoConfig);
  return <PromoLanding promo={promo} />;
}
