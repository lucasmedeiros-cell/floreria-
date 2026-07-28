import { NextRequest } from "next/server";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  defaultPromoForBusiness,
  readPromoConfig,
  resetPromoConfig,
  writePromoConfig,
} from "@/lib/promoStore";
import { sanitizePromo, type PromoConfig } from "@/lib/promo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * API de la landing PRINCIPAL (la de `/promo`).
 *
 * Existe desde cuando había una sola landing por negocio y se mantiene por
 * compatibilidad (apps ya instaladas). Para trabajar con todas las landings del
 * negocio está `/api/promos` (plural).
 */

// GET /api/promo — config actual de la landing principal (pública).
export const GET = handler(async () => {
  return ok(await readPromoConfig());
});

// POST /api/promo — guarda la landing principal (solo empleados).
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const body = (await req.json()) as Partial<PromoConfig>;

  // Los defaults salen del rubro activo del negocio, no de la florería.
  const base = await defaultPromoForBusiness();

  return ok(await writePromoConfig(sanitizePromo(body, base)));
});

/**
 * DELETE /api/promo — borra TODAS las landings guardadas.
 *
 * "Restablecer todo" en el CRM cae acá: el negocio vuelve a tener una sola
 * landing, la promo por defecto DE SU RUBRO. (Antes el CRM guardaba los valores
 * del rubro "generico", que dejaban la landing despublicada y con relleno.)
 */
export const DELETE = handler(async () => {
  if (!getSession("employee")) return unauthorized();
  await resetPromoConfig();
  return ok(await readPromoConfig());
});
