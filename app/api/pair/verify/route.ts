import { NextRequest } from "next/server";
import { bad, handler, ok } from "@/lib/api";
import { readBusiness } from "@/lib/businessStore";
import { currentTenant } from "@/lib/tenant";
import { deviceToken } from "@/lib/tenantRequest";

export const runtime = "nodejs";

// Toda ruta de la API resuelve a qué negocio pertenece la request (lee headers
// en `handler()`), así que nunca se puede renderizar estáticamente.
export const dynamic = "force-dynamic";

/**
 * Pareo: "este token, ¿de qué negocio es?".
 *
 * Lo llama el CRM móvil apenas escanea el QR que emite el panel de Case
 * (`{url, token}`), para confirmar que el token sirve y que la URL está viva
 * ANTES de dar el pareo por bueno — si esto falla, la app debe deshacerlo y no
 * quedar pegada a un comercio que no existe.
 *
 *   GET /api/pair/verify
 *   X-Device-Token: <token del QR>
 *   → 200 { negocio, api, web, crm }   · 401 token inválido/bloqueado
 *   → 403 comercio suspendido          · 400 sin token
 *
 * El 401 y el 403 los devuelve `handler()` al resolver el negocio; si llegamos
 * al cuerpo, el token es bueno. De paso queda registrado el dispositivo como
 * visto en la central (última conexión, versión de la app, plataforma).
 */
export const GET = handler(async (req: NextRequest) => {
  if (!deviceToken()) {
    return bad("Falta el token de pareo (header X-Device-Token).");
  }
  const tenant = currentTenant();
  if (!tenant) {
    // Sin central configurada no hay pareo posible: es una instalación de un
    // solo negocio.
    return bad("Esta instalación no tiene pareo de negocios habilitado.", 501);
  }

  const { negocio } = tenant;
  const business = await readBusiness();
  const base = `${req.nextUrl.origin}/n/${negocio.slug}`;

  return ok({
    negocio: {
      id: negocio.id,
      nombre: negocio.nombre,
      slug: negocio.slug,
      rubro: negocio.rubro,
      estado: negocio.estado,
    },
    // Marca del negocio, para que la app se pinte con sus colores y su nombre
    // sin tener que pedir nada más.
    marca: {
      nombre: business.name,
      rubro: business.rubro.id,
      rubroLabel: business.rubro.label,
      colores: business.colors,
      whatsapp: business.whatsapp,
    },
    // De acá cuelga toda la API del negocio: {api}/products, {api}/orders, …
    api: `${base}/api`,
    web: base,
    crm: `${base}/admin`,
  });
});
