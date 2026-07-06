import { NextRequest } from "next/server";
import { bad, handler, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { handleIncoming, loggingSender } from "@/lib/vendedorEngine";
import { cloudEnabled } from "@/lib/whatsappCloud";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prueba LOCAL del Vendedor 24/7 — simula un mensaje entrante de WhatsApp sin
 * pasar por Meta. Devuelve la respuesta del bot y el historial de la charla.
 *
 * Disponible solo cuando NO hay credenciales de Meta (modo local/demo) o para
 * empleados con sesión. En producción con WhatsApp conectado queda deshabilitado
 * para el público.
 *
 * POST /api/whatsapp/simulate  { phone?, name?, text }
 */
export const POST = handler(async (req: NextRequest) => {
  if (cloudEnabled() && !getSession("employee")) {
    return bad("Endpoint de prueba deshabilitado con WhatsApp conectado.", 403);
  }

  const b = (await req.json()) as { phone?: string; name?: string; text?: string };
  const text = (b.text ?? "").trim();
  if (!text) return bad("Falta el texto del mensaje.");
  const phone = (b.phone ?? "+59170000001").trim();
  const name = (b.name ?? "Cliente de prueba").trim();

  const result = await handleIncoming(phone, name, text, null, loggingSender);

  const history = await query<{ direction: string; body: string; from_bot: boolean; created_at: Date }>(
    `SELECT direction, body, from_bot, created_at FROM wa_messages
      WHERE phone = $1 ORDER BY created_at ASC`,
    [phone]
  );

  return ok({ ...result, history });
});

/** GET /api/whatsapp/simulate?phone= — historial de una conversación de prueba. */
export const GET = handler(async (req: NextRequest) => {
  const phone = (req.nextUrl.searchParams.get("phone") ?? "+59170000001").trim();
  const history = await query(
    `SELECT direction, body, from_bot, created_at FROM wa_messages
      WHERE phone = $1 ORDER BY created_at ASC`,
    [phone]
  );
  return ok({ phone, history });
});
