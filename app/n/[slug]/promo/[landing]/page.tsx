import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPromoPageBySlug } from "@/lib/promoStore";
import { readBusinessConfig } from "@/lib/businessStore";
import { promoMetadata } from "@/lib/promoMeta";
import { PromoLanding } from "@/components/promo/PromoLanding";
import { runWithSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Una landing concreta de un negocio: `/n/<slug>/promo/<landing>`. */
export async function generateMetadata({
  params,
}: {
  params: { slug: string; landing: string };
}): Promise<Metadata> {
  const { page, business } = await runWithSlug(params.slug, async () => {
    const [page, business] = await Promise.all([
      readPromoPageBySlug(params.landing),
      readBusinessConfig(),
    ]);
    return { page, business };
  });
  return promoMetadata(page, business.name);
}

export default async function PromoNegocioSlug({
  params,
}: {
  params: { slug: string; landing: string };
}) {
  const page = await runWithSlug(params.slug, () =>
    readPromoPageBySlug(params.landing)
  );
  if (!page) notFound();
  return <PromoLanding promo={page} />;
}
