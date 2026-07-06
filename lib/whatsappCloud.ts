import { handleIncoming, type Sender } from "./vendedorEngine";

/**
 * Transporte WhatsApp Cloud API OFICIAL (Meta) para el Vendedor 24/7.
 *
 * Recibe por webhook y envía por la Graph API con las credenciales de Meta
 * (variables de entorno): META_WA_TOKEN, META_WA_PHONE_ID,
 * META_WA_VERIFY_TOKEN, WA_GRAPH_VERSION.
 *
 * Sin credenciales, `cloudEnabled()` es false y el envío solo se registra.
 */

const GRAPH_VER = process.env.WA_GRAPH_VERSION || "v21.0";

/** ¿Están cargadas las credenciales de Meta? */
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

const digits = (s: string) => s.replace(/[^0-9]/g, "");

async function graphSendText(to: string, body: string): Promise<void> {
  const token = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_ID;
  if (!token || !phoneId) {
    console.log(`[wa:cloud:local] → ${to}: ${body}`);
    return;
  }
  try {
    const r = await fetch(
      `https://graph.facebook.com/${GRAPH_VER}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
  to: string,
  base64: string,
  caption: string
): Promise<void> {
  const token = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_ID;
  if (!token || !phoneId) {
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
      `https://graph.facebook.com/${GRAPH_VER}/${phoneId}/media`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
    );
    if (!up.ok) {
      console.warn(`[wa:cloud] media ${up.status}: ${await up.text()}`);
      return graphSendText(to, caption);
    }
    const { id } = (await up.json()) as { id: string };
    const r = await fetch(
      `https://graph.facebook.com/${GRAPH_VER}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
    await graphSendText(to, caption);
  }
}

/** Sender del transporte Cloud API. */
export const cloudSender: Sender = {
  sendText: graphSendText,
  sendImageBase64: graphSendImage,
};

/** Procesa el payload del webhook de Meta (mensajes entrantes de texto). */
export async function processWebhook(body: unknown): Promise<void> {
  const b = body as {
    entry?: {
      changes?: {
        value?: {
          contacts?: { profile?: { name?: string } }[];
          messages?: {
            type?: string;
            from?: string;
            text?: { body?: string };
            referral?: { headline?: string; source_id?: string; body?: string };
          }[];
        };
      }[];
    }[];
  };
  for (const entry of b?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const contactsMeta = value?.contacts ?? [];
      for (const msg of value?.messages ?? []) {
        if (msg.type !== "text") continue;
        const phone = "+" + (msg.from ?? "");
        const text = msg.text?.body ?? "";
        const name = contactsMeta[0]?.profile?.name || phone;
        const ref = msg.referral;
        const campaign = ref
          ? String(ref.headline || ref.source_id || ref.body || "Anuncio Meta").slice(0, 80)
          : null;
        await handleIncoming(phone, name, text, campaign, cloudSender).catch((e) =>
          console.warn(`[wa:cloud] ingest: ${e}`)
        );
      }
    }
  }
}
