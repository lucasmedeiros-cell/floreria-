import crypto from "crypto";
import { headers } from "next/headers";
import { query, queryOne } from "./db";

/**
 * Pareo de dispositivos por código.
 *
 * El CRM emite un código de 6 dígitos, de un solo uso y con vencimiento. La app
 * lo canjea por un token de dispositivo. El código NUNCA se guarda en claro: se
 * guarda su hash (crypt/bcrypt), igual que una contraseña — quien lea la base no
 * debe poder parear un dispositivo.
 *
 * Guarda relación con `lib/tenant.ts`: allá el token de pareo resuelve el
 * negocio en el modo multi-tenant (tabla `dispositivo` de la central). Acá, en
 * modo de un solo negocio, el registro vive en `device_pairing` de la base del
 * negocio. La app funciona igual en los dos: manda `X-Device-Token` y el backend
 * lo valida donde corresponda.
 *
 * NOTA (multi-tenant): en ese modo el token lo tiene que emitir/validar la
 * central de Case (tabla `dispositivo`), no esta tabla. La app ya manda el
 * header; falta el emisor del lado de Case. Ver mobile/README.md.
 */

/** Vida del código antes de canjearse. Corto a propósito. */
export const PAIR_CODE_TTL_MIN = 15;

/** Genera un código de 6 dígitos con azar criptográfico (no Math.random). */
function genCode(): string {
  // 0..999999 uniforme, sin sesgo de módulo: se descartan los valores altos.
  const LIMIT = 1_000_000;
  const MAX = Math.floor(0xffffffff / LIMIT) * LIMIT;
  let n: number;
  do {
    n = crypto.randomBytes(4).readUInt32BE(0);
  } while (n >= MAX);
  return (n % LIMIT).toString().padStart(6, "0");
}

/** Token opaco del dispositivo: 48 hex, como el de pareo de la central. */
function genToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Normaliza un teléfono a una forma canónica: SOLO dígitos (sin `+`, espacios ni
 * guiones). Así "+591 700-2233", "591 7002233" y "5917002233" son la misma
 * cuenta y entran igual al login, sin importar cómo se tipeó. La MISMA función la
 * usan el alta (al guardar) y el login (al buscar), que es lo que garantiza que
 * coincidan.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export interface EmittedCode {
  code: string;
  expiresAt: string; // ISO
}

/**
 * Emite un código de pareo. Lo llama una ruta autenticada del CRM; `employeeId`
 * es quién lo generó. Devuelve el código EN CLARO una sola vez: no se puede
 * volver a leer, solo verificar.
 *
 * De paso limpia los códigos vencidos sin canjear: si no, se acumularían para
 * siempre y cada canje tendría que compararlos con bcrypt uno por uno.
 */
export async function emitPairCode(employeeId: string): Promise<EmittedCode> {
  await query(
    `DELETE FROM device_pairing WHERE token IS NULL AND expires_at < now()`
  );
  const code = genCode();
  const row = await queryOne<{ expires_at: string }>(
    `INSERT INTO device_pairing (code_hash, expires_at, created_by)
     VALUES (crypt($1, gen_salt('bf')), now() + ($2 || ' minutes')::interval, $3)
     RETURNING expires_at`,
    [code, String(PAIR_CODE_TTL_MIN), employeeId]
  );
  return { code, expiresAt: new Date(row!.expires_at).toISOString() };
}

export type RedeemResult =
  | { ok: true; token: string }
  | { ok: false; reason: "invalid" };

/**
 * Canjea un código por un token de dispositivo. Un solo uso: al primer acierto,
 * el registro pasa a "pareado" y el código deja de valer.
 *
 * Solo compara contra códigos VIGENTES y sin canjear (`expires_at > now()`), así
 * que el conjunto de comparaciones bcrypt está acotado por el TTL (a lo sumo los
 * códigos de los últimos 15 min) y un código vencido simplemente no matchea. La
 * protección contra fuerza bruta es la entropía (1.000.000) más el TTL corto: un
 * código equivocado no "gasta" ni bloquea a los códigos legítimos de nadie.
 */
export async function redeemPairCode(
  code: string,
  meta: {
    platform?: string | null;
    model?: string | null;
    osVersion?: string | null;
    appVersion?: string | null;
    deviceName?: string | null;
    ip?: string | null;
  }
): Promise<RedeemResult> {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) return { ok: false, reason: "invalid" };

  const match = await queryOne<{ id: string }>(
    `SELECT id
       FROM device_pairing
      WHERE token IS NULL AND NOT revoked AND expires_at > now()
        AND code_hash = crypt($1, code_hash)
      LIMIT 1`,
    [clean]
  );
  if (!match) return { ok: false, reason: "invalid" };

  const token = genToken();
  const paired = await queryOne<{ token: string }>(
    `UPDATE device_pairing
        SET token = $2, paired_at = now(), last_seen = now(),
            platform = $3, model = $4, os_version = $5,
            app_version = $6, device_name = $7, last_ip = $8
      WHERE id = $1 AND token IS NULL
      RETURNING token`,
    [
      match.id,
      token,
      meta.platform ?? null,
      meta.model ?? null,
      meta.osVersion ?? null,
      meta.appVersion ?? null,
      meta.deviceName ?? null,
      meta.ip ?? null,
    ]
  );
  // Carrera: si dos canjes del mismo código entran a la vez, solo uno hace el
  // UPDATE (token IS NULL); el otro recibe null y se trata como inválido.
  if (!paired) return { ok: false, reason: "invalid" };
  return { ok: true, token: paired.token };
}

/**
 * Valida el token de dispositivo de la request (header `X-Device-Token`, o el
 * Bearer si es un token de pareo). Devuelve el id del registro si el dispositivo
 * está pareado y NO revocado; null si no hay token, no existe o fue revocado.
 *
 * Es lo que hace efectiva la revocación: un `revoked = true` corta el acceso del
 * dispositivo aunque su sesión de empleado siga firmada. De paso registra el
 * `last_seen`.
 */
const DEVICE_TOKEN_RE = /^[a-f0-9]{32,}$/i;

export async function deviceFromRequest(): Promise<{ id: string } | null> {
  const h = headers();
  let token = h.get("x-device-token")?.trim() ?? "";
  if (!token) {
    const auth = h.get("authorization") ?? "";
    if (auth.toLowerCase().startsWith("bearer ")) {
      const b = auth.slice(7).trim();
      if (DEVICE_TOKEN_RE.test(b)) token = b;
    }
  }
  if (!token || !DEVICE_TOKEN_RE.test(token)) return null;
  return queryOne<{ id: string }>(
    `UPDATE device_pairing SET last_seen = now()
      WHERE token = $1 AND NOT revoked
      RETURNING id`,
    [token]
  );
}

/** ¿La request trae un header de token de dispositivo (válido o no)? */
export function hasDeviceToken(): boolean {
  const h = headers();
  if (h.get("x-device-token")?.trim()) return true;
  const auth = h.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return DEVICE_TOKEN_RE.test(auth.slice(7).trim());
  }
  return false;
}
