import { handler, ok } from "@/lib/api";
import { baileys } from "@/lib/whatsappBaileys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Número de WhatsApp del negocio para la tienda (público).
 *
 * Es el número al que está vinculado el Vendedor 24/7 (Baileys). Así, cuando el
 * cliente pulsa "Continuar por WhatsApp", cae en el mismo WhatsApp que atiende
 * el bot. Si no hay número vinculado, devuelve null y la tienda usa el de
 * respaldo (kWhatsapp).
 *
 * GET /api/whatsapp/number → { phone: string | null, connected: boolean }
 */
export const GET = handler(async () => {
  const wa = baileys();
  return ok({ phone: wa.getNumber(), connected: wa.getStatus().connected });
});
