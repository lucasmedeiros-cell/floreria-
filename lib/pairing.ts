import crypto from "crypto";
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
 */

/** Vida del código antes de canjearse. Corto a propósito. */
export const PAIR_CODE_TTL_MIN = 15;
/** Canjes fallidos permitidos antes de invalidar el código (anti fuerza bruta). */
const MAX_ATTEMPTS = 5;

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

export interface EmittedCode {
  code: string;
  expiresAt: string; // ISO
}

/**
 * Emite un código de pareo. Lo llama una ruta autenticada del CRM; `employeeId`
 * es quién lo generó (para la ficha del dispositivo). Devuelve el código EN
 * CLARO una sola vez: no se puede volver a leer, solo verificar.
 */
export async function emitPairCode(employeeId: string): Promise<EmittedCode> {
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
  | { ok: false; reason: "invalid" | "expired" | "too_many" };

/**
 * Canjea un código por un token de dispositivo. Un solo uso: al primer acierto,
 * el registro pasa a "pareado" y el código deja de valer.
 *
 * `meta` es lo que la app reporta de sí misma (headers X-Device-*), que se guarda
 * para la ficha del dispositivo.
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

  // Candidatos: pendientes de canje y no revocados. Se compara el hash de a uno;
  // son pocos (los vigentes) y así el código nunca viaja en el WHERE en claro.
  const candidates = await query<{
    id: string;
    expired: boolean;
    attempts: number;
    matches: boolean;
  }>(
    `SELECT id,
            expires_at < now()                    AS expired,
            attempts,
            code_hash = crypt($1, code_hash)       AS matches
       FROM device_pairing
      WHERE token IS NULL AND NOT revoked
      ORDER BY created_at DESC`,
    [clean]
  );

  const match = candidates.find((c) => c.matches);
  if (!match) return { ok: false, reason: "invalid" };
  if (match.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };
  if (match.expired) return { ok: false, reason: "expired" };

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

/** Suma un intento fallido a los códigos vigentes (freno a la fuerza bruta). */
export async function bumpFailedAttempts(): Promise<void> {
  await query(
    `UPDATE device_pairing
        SET attempts = attempts + 1
      WHERE token IS NULL AND NOT revoked AND expires_at > now()`
  );
}

/** Valida un token de dispositivo (lo usa la API en cada request de la app). */
export async function deviceByToken(token: string): Promise<{ id: string } | null> {
  if (!/^[a-f0-9]{32,}$/i.test(token)) return null;
  const row = await queryOne<{ id: string }>(
    `UPDATE device_pairing SET last_seen = now()
      WHERE token = $1 AND NOT revoked
      RETURNING id`,
    [token]
  );
  return row;
}
