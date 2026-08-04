import { handler, ok } from "@/lib/api";
import { baileys } from "@/lib/whatsappBaileys";
import { currentTenant, waNumerosDeNegocio } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Número de WhatsApp del Vendedor 24/7 de ESTE negocio (público).
 *
 * Lo usan la tienda y la landing: la tienda solo cuando el negocio no cargó
 * teléfono propio, y la landing cuando eligió que el pedido entre al bot
 * (`whatsappTarget: "vendedor"`).
 *
 * Sale del número oficial de Meta asociado al negocio en la central. El
 * respaldo por Baileys queda para las instalaciones de un solo negocio, que no
 * tienen central.
 *
 * GET /api/whatsapp/number → { phone: string | null, connected: boolean }
 */
export const GET = handler(async () => {
  const negocio = currentTenant()?.negocio;
  if (negocio) {
    const numeros = await waNumerosDeNegocio(negocio.id);
    const atendiendo = numeros.find((n) => n.activo && n.numero);
    if (atendiendo) return ok({ phone: atendiendo.numero, connected: true });
  }

  const wa = baileys();
  return ok({ phone: wa.getNumber(), connected: wa.getStatus().connected });
});
