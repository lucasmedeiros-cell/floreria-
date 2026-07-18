import { NextRequest } from "next/server";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { lookupBarcode } from "@/lib/barcodeLookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Params {
  params: { code: string };
}

/**
 * Busca un producto por su código de barras en bases públicas y devuelve los
 * datos para precargar el alta (nombre, marca, categoría, foto) más el país de
 * registro deducido del prefijo GS1.
 *
 * Requiere sesión de empleado. Es "mejor esfuerzo": si el código no está en
 * ninguna base, devuelve `found: false` (con el país si el número es válido) y
 * el empleado completa a mano.
 */
export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  if (!getSession("employee")) return unauthorized();
  const info = await lookupBarcode(params.code);
  return ok(info);
});
