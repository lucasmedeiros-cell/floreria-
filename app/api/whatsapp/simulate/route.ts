import { NextRequest } from "next/server";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { handleIncoming, loggingSender } from "@/lib/vendedorEngine";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Probador del Vendedor 24/7 — simula un mensaje entrante y devuelve la
 * respuesta del bot + el historial. Solo empleados con sesión (se usa desde el
 * panel admin); así no se expone la IA (que consume tokens) al público.
 *
 * POST /api/whatsapp/simulate  { phone?, name?, text }
 */
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();

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

/** GET /api/whatsapp/simulate?phone= — historial de una conversación (empleados). */
export const GET = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const phone = (req.nextUrl.searchParams.get("phone") ?? "+59170000001").trim();
  const history = await query(
    `SELECT direction, body, from_bot, created_at FROM wa_messages
      WHERE phone = $1 ORDER BY created_at ASC`,
    [phone]
  );
  return ok({ phone, history });
});
