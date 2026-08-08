import type { Sender } from "./vendedorEngine";
import { cloudSenderFor } from "./whatsappCloud";
import { currentTenant, waNumerosDeNegocio } from "./tenant";

/**
 * Por dónde le escribe el sistema a un cliente cuando NO es una respuesta del
 * bot: el aviso de pago confirmado y los mensajes que manda una persona desde la
 * bandeja.
 *
 * El motor recibe el transporte de quien lo llama (el webhook o el socket), pero
 * acá no hay mensaje entrante del cual deducirlo, así que se elige: número
 * oficial de Meta si el negocio tiene uno, y si no el WhatsApp vinculado por QR.
 */
export async function senderDelNegocio(): Promise<Sender | null> {
  const negocio = currentTenant()?.negocio;

  // 1. Meta, que es el canal oficial.
  if (negocio) {
    const numeros = await waNumerosDeNegocio(negocio.id);
    const activo = numeros.find((n) => n.activo);
    if (activo) {
      const token = activo.token ?? process.env.META_WA_TOKEN ?? null;
      if (token) return cloudSenderFor({ phoneNumberId: activo.phoneNumberId, token });
    }
  }

  // 2. El puente por QR: la sesión de ESTE negocio. Cada uno tiene la suya, así
  //    que nunca se le escribe a un cliente desde el número de otro.
  const { baileys } = await import("./whatsappBaileys");
  const wa = baileys(negocio?.slug);
  return wa.getStatus().connected ? wa.sender : null;
}
