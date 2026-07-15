import { AdminGate } from "@/components/admin/AdminGate";
import { readAnimConfig } from "@/lib/animStore";
import { runWithSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * CRM del negocio: `/n/<slug>/admin`. Es el mismo panel de easy pos, contra la
 * base de este negocio. Los empleados también son suyos: la sesión que se emite
 * acá no sirve en el CRM de otro negocio (ver `lib/auth.ts`).
 */
export default async function CrmNegocio({
  params,
}: {
  params: { slug: string };
}) {
  const anim = await runWithSlug(params.slug, readAnimConfig);
  return <AdminGate adminIntro={anim.admin} />;
}
