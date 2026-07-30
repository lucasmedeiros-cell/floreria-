import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { centralQuery, isMultiTenant } from "./tenant";

/**
 * Sesión del PANEL de easy pos (`/panel`): la puerta del equipo que administra
 * los negocios (altas, estados, pareo). No confundir con `lib/auth.ts`, que es
 * la sesión de los empleados/clientes DE un negocio: acá la cuenta vive en la
 * central (`bo_epos_central.usuario`) y la cookie es otra (`panel_session`,
 * con path `/` porque tiene que viajar a /api/panel y /api/provision).
 */

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-floresonline";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días: es una herramienta de administración
const COOKIE = "panel_session";

// Login con Google (mismo patrón que el panel Case): restringido al dominio
// del equipo. Con GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET el panel entra SOLO
// con Google; sin ellas queda el correo+contraseña de siempre (desarrollo).
const PANEL_DOMAIN = (process.env.PANEL_ALLOWED_DOMAIN ?? "petroboxinc.com").toLowerCase();

export function panelOauth(): { enabled: boolean; clientId: string; clientSecret: string; domain: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  return { enabled: !!(clientId && clientSecret), clientId, clientSecret, domain: PANEL_DOMAIN };
}

export interface PanelSession {
  sub: string; // id en `usuario`
  email: string;
  name: string;
  kind: "panel"; // que un token de empleado jamás valga acá
  exp: number; // epoch segundos
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const sign = (data: string): string =>
  b64url(crypto.createHmac("sha256", SECRET).update(data).digest());

function signPanelToken(payload: Omit<PanelSession, "exp" | "kind">): string {
  const full: PanelSession = {
    ...payload,
    kind: "panel",
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  };
  const body = b64url(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

function verifyPanelToken(token: string | undefined): PanelSession | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    ) as PanelSession;
    if (payload.kind !== "panel" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Valida las credenciales contra la central y, si son buenas, deja la cookie
 * de sesión. La comparación de la clave la hace Postgres (crypt del hash
 * guardado), así que acá nunca viaja ni se compara un hash a mano.
 */
export async function panelLogin(email: string, pass: string): Promise<PanelSession | null> {
  if (!isMultiTenant()) return null; // sin central no hay panel
  const rows = await centralQuery<{ id: string; nombre: string; email: string }>(
    `SELECT id, nombre, email FROM usuario
      WHERE lower(email) = lower($1) AND activo AND pass_hash = crypt($2, pass_hash)`,
    [email.trim(), pass]
  );
  const u = rows[0];
  if (!u) return null;
  centralQuery(`UPDATE usuario SET last_login = now() WHERE id = $1`, [u.id]).catch(() => {});
  const token = signPanelToken({ sub: u.id, email: u.email, name: u.nombre });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return verifyPanelToken(token);
}

/**
 * Origen público de la request (https://easypos.easypaybo.com). Se arma con
 * los headers que reenvía nginx (Host / X-Forwarded-*): detrás del proxy,
 * `req.url` trae el host INTERNO (localhost:3090) y cualquier redirect armado
 * con él mandaría al navegador a localhost.
 */
export function panelOrigin(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Adónde vuelve Google. Sale de GOOGLE_REDIRECT_URI si está, o se arma con el
 * origen público de la request. Tiene que estar registrada tal cual en la
 * consola de Google del cliente OAuth.
 */
export function panelCallbackUri(h: Headers): string {
  return process.env.GOOGLE_REDIRECT_URI ?? `${panelOrigin(h)}/api/panel/auth/google/callback`;
}

/**
 * `state` del baile OAuth: un token firmado con vencimiento corto. Evita que
 * un callback forjado (CSRF) inicie sesión; no necesita guardar nada.
 */
export function signOauthState(): string {
  const body = b64url(JSON.stringify({ p: "oauth", exp: Math.floor(Date.now() / 1000) + 300 }));
  return `${body}.${sign(body)}`;
}

export function checkOauthState(state: string | null): boolean {
  if (!state) return false;
  const [body, sig] = state.split(".");
  if (!body || !sig) return false;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return false;
  try {
    const p = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as {
      p?: string;
      exp?: number;
    };
    return p.p === "oauth" && (p.exp ?? 0) >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/**
 * Entra al panel con una identidad ya verificada por Google. Solo cuentas del
 * dominio del equipo; el usuario se crea solo la primera vez (con una clave
 * aleatoria imposible de adivinar: esa cuenta nunca entra por contraseña).
 * Devuelve la sesión, o el motivo del rechazo.
 */
export async function panelLoginGoogle(
  email: string,
  name: string
): Promise<PanelSession | "dominio" | "inactivo" | null> {
  if (!isMultiTenant()) return null; // sin central no hay panel
  const mail = email.trim().toLowerCase();
  if (!mail.endsWith("@" + PANEL_DOMAIN)) return "dominio";

  const rows = await centralQuery<{ id: string; nombre: string; activo: boolean }>(
    `SELECT id, nombre, activo FROM usuario WHERE lower(email) = lower($1)`,
    [mail]
  );
  let u = rows[0];
  if (u && !u.activo) return "inactivo";
  if (!u) {
    const ins = await centralQuery<{ id: string; nombre: string; activo: boolean }>(
      `INSERT INTO usuario (nombre, email, pass_hash)
       VALUES ($1, $2, crypt(gen_random_uuid()::text, gen_salt('bf')))
       RETURNING id, nombre, activo`,
      [name.trim() || mail, mail]
    );
    u = ins[0];
  }
  centralQuery(`UPDATE usuario SET last_login = now() WHERE id = $1`, [u.id]).catch(() => {});
  const token = signPanelToken({ sub: u.id, email: mail, name: u.nombre });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return verifyPanelToken(token);
}

export function panelLogout(): void {
  cookies().delete({ name: COOKIE, path: "/" });
}

/** Sesión del panel de esta request (cookie, o Bearer para herramientas). */
export function getPanelSession(): PanelSession | null {
  let token = cookies().get(COOKIE)?.value;
  if (!token) {
    const auth = headers().get("authorization") ?? "";
    if (auth.toLowerCase().startsWith("bearer ")) token = auth.slice(7).trim();
  }
  return verifyPanelToken(token);
}

/**
 * Historial del panel: quién hizo qué sobre qué negocio. Nunca tira — un log
 * caído no puede voltear la operación que está registrando.
 */
export async function logActividad(
  usuario: string,
  accion: string,
  negocioId?: string | null,
  detalle?: Record<string, unknown>
): Promise<void> {
  try {
    await centralQuery(
      `INSERT INTO actividad (usuario, negocio_id, accion, detalle) VALUES ($1, $2, $3, $4::jsonb)`,
      [usuario, negocioId ?? null, accion, JSON.stringify(detalle ?? {})]
    );
  } catch (err) {
    console.warn("[panel] no se pudo registrar la actividad:", err);
  }
}
