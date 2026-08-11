import { notFound, redirect } from "next/navigation";
import { estaActivo, negocioBySlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Todo lo que cuelga de `/n/<slug>` es de un negocio: su tienda, su landing y
 * su CRM. Acá se decide si ese negocio existe y si está en condiciones de
 * atender; de la base correcta ya se encargan el middleware (que pone el slug
 * en el header) y `lib/tenant.ts`.
 */
export default async function NegocioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const negocio = await negocioBySlug(params.slug);
  if (!negocio) notFound();

  // Entró por una dirección vieja (el negocio se renombró): se manda a la actual
  // en vez de servirla en dos URLs. Así lo ya compartido —una landing mandada
  // por WhatsApp, un QR impreso— sigue funcionando y de paso se corrige solo.
  if (negocio.slug !== params.slug) {
    redirect(`/n/${negocio.slug}`);
  }

  // Suspendido o dado de baja: la web no atiende, pero se dice por qué (una
  // pantalla en blanco haría que el comercio crea que se le rompió el sitio).
  if (!estaActivo(negocio)) {
    return (
      <main className="min-h-screen grid place-items-center p-8 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="font-display text-3xl">{negocio.nombre}</h1>
          <p className="text-ink/70">
            Esta tienda está temporalmente fuera de servicio. Si sos el dueño del
            negocio, comunicate con tu proveedor de easy pos para reactivarla.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
