import { NextRequest } from "next/server";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { createPromoPage, readPromoPages } from "@/lib/promoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Landings promocionales del negocio (varias por negocio).
 *
 * Las páginas públicas NO pasan por acá: leen el store directo en el servidor.
 * Esta ruta es la del CRM, así que pide sesión de empleado — la lista incluye
 * las landings despublicadas (borradores), que nadie de afuera debería ver.
 */

// GET /api/promos — todas las landings, la principal primero.
export const GET = handler(async () => {
  if (!getSession("employee")) return unauthorized();
  return ok({ pages: await readPromoPages() });
});

// POST /api/promos — crea una landing (opcionalmente duplicando otra).
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    copyFromId?: string;
  };

  const res = await createPromoPage(body);
  if ("error" in res) return bad(res.error);
  return ok(res, { status: 201 });
});
