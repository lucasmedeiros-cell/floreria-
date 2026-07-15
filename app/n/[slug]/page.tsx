import { Storefront } from "@/components/Storefront";
import { RoseIntro } from "@/components/RoseIntro";
import { readAnimConfig } from "@/lib/animStore";
import { runWithSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Tienda del negocio: `/n/<slug>`. Misma tienda de siempre, con SUS datos. */
export default async function TiendaNegocio({
  params,
}: {
  params: { slug: string };
}) {
  const anim = await runWithSlug(params.slug, readAnimConfig);
  return (
    <>
      <RoseIntro enabled={anim.web} />
      <Storefront />
    </>
  );
}
