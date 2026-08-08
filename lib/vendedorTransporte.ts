import type { Sender } from "./vendedorEngine";
import { cloudSenderFor } from "./whatsappCloud";
import { currentTenant, isMultiTenant, waNumerosDeNegocio } from "./tenant";

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

  // 2. El puente por QR. Solo si es el WhatsApp de ESTE negocio: con varios
  //    negocios en la misma instalación, el socket es de uno solo y mandar por
  //    ahí el aviso de otro sería escribirle al cliente desde el número
  //    equivocado.
  const slug = (process.env.WA_BAILEYS_NEGOCIO ?? "").trim();
  const esSuyo = !isMultiTenant() || (!!negocio && slug === negocio.slug);
  if (!esSuyo) return null;

  const { baileys } = await import("./whatsappBaileys");
  const wa = baileys();
  return wa.getStatus().connected ? wa.sender : null;
}
