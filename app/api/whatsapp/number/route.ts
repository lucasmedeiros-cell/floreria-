import { handler, ok } from "@/lib/api";
import { baileys } from "@/lib/whatsappBaileys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Número de WhatsApp del negocio para la tienda (público).
 *
 * Es el número al que está vinculado el Vendedor 24/7 (Baileys). Solo se usa
 * cuando el negocio NO tiene teléfono propio (ni en su CRM ni en el panel de
 * easy pos): manda el del negocio, que es el que su dueño cargó. Sin ninguno de
 * los dos, la tienda abre WhatsApp sin destinatario.
 *
 * GET /api/whatsapp/number → { phone: string | null, connected: boolean }
 */
export const GET = handler(async () => {
  const wa = baileys();
  return ok({ phone: wa.getNumber(), connected: wa.getStatus().connected });
});
