import { clearSessionCookie } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

export const runtime = "nodejs";

// Toda ruta de la API resuelve a qué negocio pertenece la request (lee headers
// en `handler()`), así que nunca se puede renderizar estáticamente.
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  clearSessionCookie("customer");
  return ok({ ok: true });
});
