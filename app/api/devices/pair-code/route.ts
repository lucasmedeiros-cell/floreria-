import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { emitPairCode } from "@/lib/pairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Emite un código de pareo. Lo llama el CRM (Configuración → Vincular
 * dispositivo), así que exige sesión de empleado: solo alguien de adentro del
 * negocio puede autorizar un dispositivo nuevo.
 */
export const POST = handler(async () => {
  const s = getSession("employee");
  if (!s) return unauthorized("Iniciá sesión para vincular un dispositivo.");

  const { code, expiresAt } = await emitPairCode(s.sub);
  return ok({ code, expiresAt });
});
