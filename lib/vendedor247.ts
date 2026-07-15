import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { query, queryOne } from "./db";
import { type Product } from "./products";
import { readBusinessConfig } from "./businessStore";
import { botPersonaFor } from "./business";
import { getRubro } from "./rubros";

/**
 * Vendedor 24/7 — asistente de ventas del negocio por WhatsApp.
 *
 * Portado del proyecto "Vendedor247" (easy-pay-pos): un chatbot (Claude) que
 * atiende WhatsApp actuando como vendedor — usa el catálogo real, responde
 * breve y cordial, orienta al cierre y cobra por QR.
 *
 * Es agnóstico del rubro: la persona y las reglas de venta salen del rubro
 * activo (lib/rubros.ts) salvo que se personalicen desde el panel.
 *
 * Funciona SIN credenciales en "modo simulado" (respuestas de ejemplo), para
 * poder probarlo local; al cargar ANTHROPIC_API_KEY responde con IA real.
 */

// ------------------------------ Configuración ------------------------------

export interface VendedorConfig {
  /** Si está apagado, el bot no responde ningún mensaje. */
  botEnabled: boolean;
  /** Persona / rol del asistente (primera línea del system prompt). */
  botPersona: string;
  /**
   * Palabra clave de activación. Vacío = responde siempre. Si se define, el bot
   * solo entra cuando el mensaje la contiene (o si la charla sigue "caliente").
   */
  activationKeyword: string;
  /** Modelo de Claude a usar. */
  aiModel: string;
  /** Formas de pago que puede ofrecer el bot. */
  paymentOptions: string;
  /** Mensaje automático fuera de horario (vacío = no responde nada). */
  offHoursMessage: string;
  /**
   * Horario de atención por día de semana (sun..sat) → rangos [{from,to}].
   * null = atiende 24/7.
   */
  businessHours: Record<string, { from: string; to: string }[]> | null;
  /** Zona horaria para evaluar el horario de atención. */
  timezone: string;
}

export const defaultVendedorConfig: VendedorConfig = {
  botEnabled: true,
  // Vacío = se usa la persona del rubro activo (ver botPersonaFor). El panel
  // permite escribir una propia y esa gana.
  botPersona: "",
  activationKeyword: "",
  aiModel: "claude-haiku-4-5",
  paymentOptions: "QR / transferencia (BCP), tarjeta o efectivo contra entrega",
  offHoursMessage: "",
  businessHours: null,
  timezone: "America/La_Paz",
};

const KEY = "vendedor247";

/** Lee la config del vendedor 24/7 desde `settings` (defaults si no existe). */
export async function readVendedorConfig(): Promise<VendedorConfig> {
  try {
    const row = await queryOne<{ value: Partial<VendedorConfig> }>(
      `SELECT value FROM settings WHERE key = $1`,
      [KEY]
    );
    if (!row) return defaultVendedorConfig;
    return { ...defaultVendedorConfig, ...row.value };
  } catch (error) {
    console.warn(
      "[vendedor247] no se pudo leer la config; usando valores por defecto.",
      error
    );
    return defaultVendedorConfig;
  }
}

/** Guarda (upsert) la config del vendedor 24/7. */
export async function writeVendedorConfig(
  cfg: Partial<VendedorConfig>
): Promise<VendedorConfig> {
  const merged: VendedorConfig = { ...defaultVendedorConfig, ...cfg };
  await query(
    `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify(merged)]
  );
  return merged;
}

// ------------------------------ Catálogo -----------------------------------

/** Productos activos para alimentar el prompt (BD real; cae al catálogo del rubro). */
async function loadCatalog(): Promise<Product[]> {
  try {
    const rows = await query<Product>(
      `SELECT id, name, description AS desc, price, image, category, featured, stock, status
         FROM products
        WHERE COALESCE(status, 'activo') = 'activo'
        ORDER BY featured DESC, price ASC
        LIMIT 40`
    );
    if (rows.length) return rows;
  } catch (error) {
    console.warn("[vendedor247] catálogo desde BD falló; uso el del rubro.", error);
  }
  const business = await readBusinessConfig();
  return getRubro(business.rubroId).catalog;
}

// ------------------------------ System prompt ------------------------------

function systemPrompt(
  cfg: VendedorConfig,
  contactName: string,
  products: Product[],
  /** Persona y reglas del rubro activo (se usan si el panel no las personalizó). */
  persona: string,
  rubroGuidance: string,
  noun: { one: string; many: string }
): string {
  const catalog = products
    .slice(0, 20)
    .map((p) => `- ${p.name} (${p.category}): Bs ${p.price}`)
    .join("\n");

  return [
    cfg.botPersona.trim() || persona,
    "",
    "Reglas:",
    "- Responde en español, breve y cordial (1 a 3 frases).",
    "- NO uses emojis ni emoticones. Tono profesional, claro y humano, sin caritas ni símbolos.",
    "- Los precios van en bolivianos (Bs).",
    `- Orienta a cerrar la venta: sugiere un ${noun.one} del catálogo y ofrece tomar el pedido.`,
    "- Para concretar la entrega pide solo lo que falte: a quién va dirigido, dirección de entrega, fecha y hora, y teléfono de contacto.",
    `- Formas de pago disponibles: ${cfg.paymentOptions}. Si el cliente pregunta cómo pagar, ofrécelas.`,
    "- COBRO POR QR: cuando el cliente confirme el pedido y quiera pagar por QR o transferencia, termina tu mensaje con el marcador EXACTO [QR:MONTO] usando el total en número, por ejemplo [QR:600]. No expliques ni menciones el marcador: el sistema genera y ENVÍA el QR real del banco automáticamente. Úsalo UNA sola vez por pedido.",
    "- Revisa lo que el cliente YA te dijo (dirección, fecha, dedicatoria, teléfono, forma de pago) y NO se lo vuelvas a preguntar. Pregunta solo lo que falta.",
    "- No inventes productos ni precios fuera del catálogo.",
    "- SIEMPRE responde a lo que el cliente escribe, sugiriendo opciones del catálogo con su precio.",
    `- ${rubroGuidance}`,
    "- Si el cliente saluda o escribe algo corto o ambiguo, preséntate breve y pregunta en qué lo puedes ayudar. NUNCA te despidas ni uses frases como \"cuando quieras\", \"aquí estaré\" o \"si cambias de idea\", salvo que el cliente diga EXPLÍCITAMENTE que no quiere nada.",
    "- Haz avanzar la conversación pidiendo solo el dato que falta. No repitas el mismo mensaje.",
    "",
    "Catálogo disponible:",
    catalog || "(sin productos cargados)",
    "",
    `Estás conversando con ${contactName} por WhatsApp.`,
  ].join("\n");
}

/** Quita emojis/emoticones del texto del bot (red de seguridad además del prompt). */
export function stripEmojis(s: string): string {
  return s
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}\u{2122}\u{2139}]/gu,
      ""
    )
    .replace(/ {2,}/g, " ")
    .replace(/ ([.,!?])/g, "$1")
    .trim();
}

// ------------------------------ Motor de IA --------------------------------

export type ChatMsg = { role: "user" | "assistant"; content: string };

/** Historial de la BD → mensajes para Claude (el primero debe ser 'user'). */
function toMessages(history: { direction: string; body: string }[]): ChatMsg[] {
  const msgs: ChatMsg[] = history
    .filter((m) => m.body)
    .map((m) => ({
      role: (m.direction === "in" ? "user" : "assistant") as "user" | "assistant",
      content: m.body,
    }));
  while (msgs.length && msgs[0].role === "assistant") msgs.shift();
  if (!msgs.length) msgs.push({ role: "user", content: "Hola, quiero información." });
  if (msgs[msgs.length - 1].role === "assistant") {
    msgs.push({
      role: "user",
      content: "Continúa la conversación con un mensaje breve de seguimiento para el cliente.",
    });
  }
  return msgs;
}

/**
 * Autenticación con Claude. Dos modos:
 *  1) API key clásica (ANTHROPIC_API_KEY) → header x-api-key.
 *  2) Token de la CUENTA (OAuth de Claude Code/suscripción) → Bearer + beta.
 *     Se toma de ANTHROPIC_AUTH_TOKEN o, en local, del archivo de credenciales
 *     de Claude Code (~/.claude/.credentials.json). El token se relee en cada
 *     llamada para tomar el valor renovado (los OAuth caducan y se refrescan).
 */
const OAUTH_BETA = "oauth-2025-04-20";

function accountToken(): string | null {
  if (process.env.ANTHROPIC_AUTH_TOKEN) return process.env.ANTHROPIC_AUTH_TOKEN;
  try {
    const file = path.join(os.homedir(), ".claude", ".credentials.json");
    const tok = JSON.parse(fs.readFileSync(file, "utf8"))?.claudeAiOauth?.accessToken;
    return typeof tok === "string" && tok ? tok : null;
  } catch {
    return null;
  }
}

const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

/** Construye el cliente + headers según el modo de autenticación disponible. */
function buildClient(): { client: Anthropic; headers?: Record<string, string> } | null {
  if (hasApiKey) return { client: new Anthropic() };
  const tok = accountToken();
  if (tok) {
    return {
      client: new Anthropic({ authToken: tok, apiKey: null }),
      headers: { "anthropic-beta": OAUTH_BETA },
    };
  }
  return null;
}

/** ¿Hay IA real disponible? (false = modo simulado). */
export const aiConfigured = hasApiKey || !!accountToken();

/**
 * Genera la respuesta del vendedor para una conversación.
 * @param history mensajes previos (orden ascendente por fecha).
 */
export async function generateReply(
  cfg: VendedorConfig,
  contactName: string,
  history: { direction: string; body: string }[]
): Promise<{ text: string; simulated: boolean }> {
  const products = await loadCatalog();
  const business = await readBusinessConfig();
  const rubro = getRubro(business.rubroId);
  const system = systemPrompt(
    cfg,
    contactName,
    products,
    botPersonaFor(business),
    rubro.bot.guidance,
    rubro.noun
  );
  const messages = toMessages(history);

  const built = buildClient();
  if (!built) {
    return { text: mockReply(contactName, products, business.name), simulated: true };
  }

  try {
    const resp = await built.client.messages.create(
      {
        model: cfg.aiModel || defaultVendedorConfig.aiModel,
        max_tokens: 1024,
        system,
        messages,
      },
      built.headers ? { headers: built.headers } : undefined
    );
    let text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) text = "Hola, ¿en qué te puedo ayudar?";
    return { text: stripEmojis(text), simulated: false };
  } catch (error) {
    console.error("[vendedor247] error llamando a Claude:", error);
    return { text: mockReply(contactName, products, business.name), simulated: true };
  }
}

/** Respuesta de ejemplo cuando no hay API key (modo demo). */
function mockReply(name: string, products: Product[], businessName = "la tienda"): string {
  const p = products[0];
  const suffix =
    " (respuesta simulada — configura ANTHROPIC_API_KEY para IA real)";
  if (p) {
    return `Hola ${name}, gracias por escribir a ${businessName}. Tenemos, por ejemplo, ${p.name} a Bs ${p.price}. ¿En qué te puedo ayudar?${suffix}`;
  }
  return `Hola ${name}, ¿en qué te puedo ayudar hoy?${suffix}`;
}
