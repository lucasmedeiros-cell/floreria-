import { query, queryOne } from "./db";
import { generarQR } from "./baas";
import {
  generateReply,
  readVendedorConfig,
  type VendedorConfig,
} from "./vendedor247";

/**
 * Motor del Vendedor 24/7 — agnóstico del transporte.
 *
 * Contiene toda la lógica común (persistencia de la conversación, horario,
 * palabra clave, IA y cobro por QR). Cada transporte (WhatsApp Cloud API de
 * Meta o Baileys) solo aporta cómo ENVIAR los mensajes, vía la interfaz Sender.
 */

/** Cómo un transporte envía mensajes al cliente. */
export interface Sender {
  sendText(phone: string, body: string): Promise<void>;
  sendImageBase64(phone: string, base64: string, caption: string): Promise<void>;
}

/** Sender que solo registra en consola (modo local / probador). */
export const loggingSender: Sender = {
  async sendText(phone, body) {
    console.log(`[wa:local] → ${phone}: ${body}`);
  },
  async sendImageBase64(phone, _b64, caption) {
    console.log(`[wa:local] → ${phone}: [imagen QR] ${caption}`);
  },
};

// ------------------------------ Persistencia -------------------------------

interface Conversation {
  phone: string;
  name: string;
  bot_active: boolean;
}

async function saveIncoming(
  phone: string,
  name: string,
  text: string,
  campaign: string | null
): Promise<Conversation> {
  const conv = await queryOne<Conversation>(
    `INSERT INTO wa_conversations (phone, name, campaign, last_message_at)
       VALUES ($1, $2, $3, now())
     ON CONFLICT (phone) DO UPDATE
       SET name = COALESCE(NULLIF(EXCLUDED.name, ''), wa_conversations.name),
           campaign = COALESCE(wa_conversations.campaign, EXCLUDED.campaign),
           last_message_at = now()
     RETURNING phone, name, bot_active`,
    [phone, name, campaign]
  );
  await query(
    `INSERT INTO wa_messages (phone, direction, body, from_bot)
       VALUES ($1, 'in', $2, false)`,
    [phone, text]
  );
  return conv!;
}

async function saveOutgoing(phone: string, body: string): Promise<void> {
  await query(
    `INSERT INTO wa_messages (phone, direction, body, from_bot)
       VALUES ($1, 'out', $2, true)`,
    [phone, body]
  );
  await query(
    `UPDATE wa_conversations SET last_message_at = now() WHERE phone = $1`,
    [phone]
  );
}

async function loadHistory(phone: string, take = 30) {
  const rows = await query<{ direction: string; body: string }>(
    `SELECT direction, body FROM wa_messages
      WHERE phone = $1 ORDER BY created_at DESC LIMIT $2`,
    [phone, take]
  );
  return rows.reverse();
}

async function lastBotAt(phone: string): Promise<number | null> {
  const row = await queryOne<{ created_at: Date }>(
    `SELECT created_at FROM wa_messages
      WHERE phone = $1 AND from_bot = true
      ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  return row ? new Date(row.created_at).getTime() : null;
}

// ------------------------------ Horario ------------------------------------

/** ¿Estamos dentro del horario de atención? Sin horario configurado = 24/7. */
function isWithinHours(cfg: VendedorConfig): boolean {
  const bh = cfg.businessHours;
  if (!bh || typeof bh !== "object") return true;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: cfg.timezone || "America/La_Paz",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
  } catch {
    return true;
  }
  const wd = (parts.find((p) => p.type === "weekday")?.value ?? "").toLowerCase().slice(0, 3);
  let hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  if (hh === "24") hh = "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const cur = parseInt(hh, 10) * 60 + parseInt(mm, 10);
  const ranges = bh[wd];
  if (!Array.isArray(ranges) || ranges.length === 0) return false;
  for (const r of ranges) {
    const [fh, fm] = String(r.from ?? "00:00").split(":").map((n) => parseInt(n, 10) || 0);
    const [th, tm] = String(r.to ?? "23:59").split(":").map((n) => parseInt(n, 10) || 0);
    if (cur >= fh * 60 + fm && cur <= th * 60 + tm) return true;
  }
  return false;
}

// ------------------------------ Núcleo -------------------------------------

/**
 * Procesa un mensaje entrante: lo guarda, decide si el bot responde
 * (horario + palabra clave + control humano), genera la respuesta con IA,
 * maneja el cobro por QR y envía por el transporte dado.
 */
export async function handleIncoming(
  phone: string,
  name: string,
  text: string,
  campaign: string | null,
  sender: Sender
): Promise<{ replied: boolean; reason?: string; text?: string }> {
  if (!text.trim()) return { replied: false, reason: "vacío" };

  const cfg = await readVendedorConfig();
  if (!cfg.botEnabled) return { replied: false, reason: "bot apagado" };

  const conv = await saveIncoming(phone, name, text, campaign);

  // Un humano tomó el control de esta conversación → el bot no interviene.
  if (!conv.bot_active) return { replied: false, reason: "control humano" };

  // Fuera de horario: aviso automático opcional, sin IA.
  if (!isWithinHours(cfg)) {
    const off = (cfg.offHoursMessage ?? "").trim();
    if (off) {
      await sender.sendText(phone, off);
      await saveOutgoing(phone, off);
    }
    return { replied: !!off, reason: "fuera de horario", text: off || undefined };
  }

  // Activación por palabra clave. Vacío = siempre. Si se enfría (>60 min sin
  // respuesta del bot) vuelve a exigir la palabra clave.
  const keyword = (cfg.activationKeyword ?? "").trim().toLowerCase();
  if (keyword && !text.toLowerCase().includes(keyword)) {
    const last = await lastBotAt(phone);
    const recentlyActive = last !== null && Date.now() - last < 60 * 60 * 1000;
    if (!recentlyActive) return { replied: false, reason: "sin palabra clave" };
  }

  const history = await loadHistory(phone);
  const { text: raw } = await generateReply(cfg, conv.name || name, history);

  // Marcador [QR:monto]: cobra por QR. Se limpia del texto visible.
  const qrMatch = raw.match(/\[QR:\s*([\d.]+)\]/i);
  const body = raw.replace(/\[QR:[^\]]*\]/gi, "").trim() || "Perfecto.";

  await sender.sendText(phone, body);
  await saveOutgoing(phone, body);

  if (qrMatch) {
    const amount = Number(qrMatch[1]);
    if (amount > 0) {
      try {
        const qr = await generarQR(amount, `Pedido ${conv.name || name}`);
        if (qr.ok && qr.qrImage) {
          const caption = `QR de pago · Bs ${amount}. Escanéalo desde la app de tu banco.${qr.expiration ? ` Vence: ${qr.expiration}.` : ""}`;
          await sender.sendImageBase64(phone, qr.qrImage, caption);
          await saveOutgoing(phone, caption);
        } else {
          const msg = "No pude generar el QR en este momento; un asesor te lo enviará enseguida.";
          await sender.sendText(phone, msg);
          await saveOutgoing(phone, msg);
        }
      } catch (e) {
        console.warn(`[vendedor] QR error: ${e}`);
      }
    }
  }

  return { replied: true, text: body };
}
