import { createHmac, timingSafeEqual } from "crypto";
import { handleIncoming, type Sender } from "./vendedorEngine";
import {
  estaActivo,
  isMultiTenant,
  runWithTenant,
  waNumeroByPhoneId,
} from "./tenant";

/**
 * Transporte WhatsApp Cloud API OFICIAL (Meta) para el Vendedor 24/7.
 *
 * Recibe por webhook y envía por la Graph API. Es MULTI-NÚMERO: cada negocio
 * tiene el suyo (uno o dos), registrados en la central (tabla `wa_numero`).
 *
 * De quién es un mensaje se sabe por `metadata.phone_number_id` — el ID que Meta
 * le da a NUESTRO número, el que recibió. Con eso se resuelve el negocio y el
 * motor corre dentro de SU base (`runWithTenant`); si no, todos los negocios
 * leerían el catálogo y escribirían las conversaciones en la base por defecto.
 *
 * Las credenciales normalmente son las mismas para todos (una sola app de easy
 * pos): META_WA_TOKEN del entorno, y lo único que cambia por negocio es el
 * `phone_number_id`. Un negocio con cuenta de Meta propia guarda su token en la
 * fila de `wa_numero`.
 *
 * Variables: META_WA_TOKEN, META_WA_PHONE_ID (modo negocio único),
 * META_WA_VERIFY_TOKEN, META_WA_APP_SECRET, WA_GRAPH_VERSION.
 */

const GRAPH_VER = process.env.WA_GRAPH_VERSION || "v21.0";

/** Credenciales para hablar por UN número. */
export interface WaCreds {
  phoneNumberId: string;
  token: string | null;
}

/** Credenciales del entorno: el modo de un solo negocio (Coquito). */
function envCreds(): WaCreds | null {
  const phoneNumberId = process.env.META_WA_PHONE_ID;
  if (!phoneNumberId) return null;
  return { phoneNumberId, token: process.env.META_WA_TOKEN ?? null };
}

/** ¿Están cargadas las credenciales de Meta del entorno? */
export function cloudEnabled(): boolean {
  return !!(process.env.META_WA_TOKEN && process.env.META_WA_PHONE_ID);
}

/** Verificación del webhook (GET de Meta): challenge si el token coincide. */
export function verifyWebhook(
  mode?: string | null,
  token?: string | null,
  challenge?: string | null
): string | null {
  if (mode === "subscribe" && token && token === process.env.META_WA_VERIFY_TOKEN) {
    return challenge ?? "";
  }
  return null;
}

/**
 * Valida la firma `X-Hub-Signature-256` del POST con el secreto de la app.
 *
 * El verify token solo cubre el GET de alta. Este endpoint es público y ahora
 * escribe en la base de VARIOS negocios, así que sin firma cualquiera podría
 * inyectar conversaciones. Sin META_WA_APP_SECRET configurado no se valida
 * (para poder probar en local), pero en producción tiene que estar.
 */
export function verifySignature(raw: string, header?: string | null): boolean {
  const secret = process.env.META_WA_APP_SECRET;
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const esperado = createHmac("sha256", secret).update(raw, "utf8").digest();
  let recibido: Buffer;
  try {
    recibido = Buffer.from(header.slice(7), "hex");
  } catch {
    return false;
  }
  if (recibido.length !== esperado.length) return false;
  return timingSafeEqual(recibido, esperado);
}

const digits = (s: string) => s.replace(/[^0-9]/g, "");

async function graphSendText(
  creds: WaCreds,
  to: string,
  body: string
): Promise<void> {
  if (!creds.token) {
    console.log(`[wa:cloud:local] → ${to}: ${body}`);
    return;
  }
  try {
    const r = await fetch(
      `https://graph.facebook.com/${GRAPH_VER}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: digits(to),
          type: "text",
          text: { body },
        }),
      }
    );
    if (!r.ok) console.warn(`[wa:cloud] send ${r.status}: ${await r.text()}`);
  } catch (e) {
    console.warn(`[wa:cloud] send error: ${e}`);
  }
}

async function graphSendImage(
  creds: WaCreds,
  to: string,
  base64: string,
  caption: string
): Promise<void> {
  if (!creds.token) {
    console.log(`[wa:cloud:local] → ${to}: [imagen QR] ${caption}`);
    return;
  }
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append(
      "file",
      new Blob([Buffer.from(base64, "base64")], { type: "image/png" }),
      "qr.png"
    );
    const up = await fetch(
      `https://graph.facebook.com/${GRAPH_VER}/${creds.phoneNumberId}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.token}` },
        body: form,
      }
    );
    if (!up.ok) {
      console.warn(`[wa:cloud] media ${up.status}: ${await up.text()}`);
      return graphSendText(creds, to, caption);
    }
    const { id } = (await up.json()) as { id: string };
    const r = await fetch(
      `https://graph.facebook.com/${GRAPH_VER}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: digits(to),
          type: "image",
          image: { id, caption },
        }),
      }
    );
    if (!r.ok) console.warn(`[wa:cloud] send image ${r.status}: ${await r.text()}`);
  } catch (e) {
    console.warn(`[wa:cloud] send image error: ${e}`);
    await graphSendText(creds, to, caption);
  }
}

/**
 * Sender atado a UN número: se contesta desde el mismo número que recibió. Con
 * un sender global, los negocios se responderían entre ellos desde el número
 * del entorno.
 */
export function cloudSenderFor(creds: WaCreds): Sender {
  return {
    sendText: (phone, body) => graphSendText(creds, phone, body),
    sendImageBase64: (phone, b64, caption) =>
      graphSendImage(creds, phone, b64, caption),
  };
}

// -------------------------------- Webhook ------------------------------------

interface WebhookValue {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: { profile?: { name?: string } }[];
  messages?: {
    type?: string;
    from?: string;
    text?: { body?: string };
    referral?: { headline?: string; source_id?: string; body?: string };
  }[];
}

/** Procesa el payload del webhook de Meta (mensajes entrantes de texto). */
export async function processWebhook(body: unknown): Promise<void> {
  const b = body as { entry?: { changes?: { value?: WebhookValue }[] }[] };

  for (const entry of b?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const mensajes = value?.messages ?? [];
      if (mensajes.length === 0) continue; // estados de entrega, lecturas, etc.

      const phoneId = value?.metadata?.phone_number_id ?? null;

      // ¿De qué negocio es este número? En modo negocio único no hay central y
      // se atiende como siempre, contra la base por defecto.
      const wa = phoneId ? await waNumeroByPhoneId(phoneId) : null;
      if (!wa && isMultiTenant()) {
        console.warn(
          `[wa:cloud] número ${phoneId ?? "sin id"} sin negocio asociado: mensaje ignorado`
        );
        continue;
      }
      if (wa && !estaActivo(wa.negocio)) {
        console.warn(`[wa:cloud] negocio ${wa.negocio.slug} ${wa.negocio.estado}: no atiende`);
        continue;
      }

      const creds: WaCreds | null = wa
        ? { phoneNumberId: wa.phoneNumberId, token: wa.token ?? process.env.META_WA_TOKEN ?? null }
        : envCreds();
      const sender = cloudSenderFor(
        creds ?? { phoneNumberId: phoneId ?? "", token: null }
      );

      const contactsMeta = value?.contacts ?? [];
      for (const msg of mensajes) {
        if (msg.type !== "text") continue;
        const phone = "+" + (msg.from ?? "");
        const text = msg.text?.body ?? "";
        const name = contactsMeta[0]?.profile?.name || phone;
        const ref = msg.referral;
        const campaign = ref
          ? String(ref.headline || ref.source_id || ref.body || "Anuncio Meta").slice(0, 80)
          : null;

        const atender = () =>
          handleIncoming(phone, name, text, campaign, sender).then(() => undefined);

        await (wa ? runWithTenant(wa.negocio, atender) : atender()).catch((e) =>
          console.warn(`[wa:cloud] ingest: ${e}`)
        );
      }
    }
  }
}
