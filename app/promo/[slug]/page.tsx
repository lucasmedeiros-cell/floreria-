import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPromoPageBySlug } from "@/lib/promoStore";
import { readBusinessConfig } from "@/lib/businessStore";
import { promoMetadata } from "@/lib/promoMeta";
import { PromoLanding } from "@/components/promo/PromoLanding";

export const dynamic = "force-dynamic";

/** Una landing concreta del negocio: `/promo/<slug>`. */
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const [page, business] = await Promise.all([
    readPromoPageBySlug(params.slug),
    readBusinessConfig(),
  ]);
  return promoMetadata(page, business.name);
}

export default async function PromoDeSlug({
  params,
}: {
  params: { slug: string };
}) {
  // Slug que no existe: 404 de verdad, no una landing en blanco. Un enlace
  // viejo (landing borrada o renombrada) no debe parecer una oferta rota.
  const page = await readPromoPageBySlug(params.slug);
  if (!page) notFound();
  return <PromoLanding promo={page} />;
}
