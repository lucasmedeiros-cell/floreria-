import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { currentTenant } from "./tenant";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-floresonline";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export interface SessionPayload {
  sub: string; // id
  email: string;
  name: string;
  role?: string; // solo empleados
  kind: "employee" | "customer";
  /**
   * Negocio dueño de la sesión (id en la central). Sin esto, la cookie de la
   * vendedora del negocio A abriría el CRM del negocio B: la firma es válida en
   * los dos (mismo AUTH_SECRET) y las cuentas viven en bases distintas, así que
   * nadie más se daría cuenta. Ausente = instalación de un solo negocio.
   */
  neg?: string;
  exp: number; // epoch segundos
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
}

/** Firma un payload como token compacto `body.signature`. */
export function signToken(
  payload: Omit<SessionPayload, "exp" | "neg"> & { exp?: number }
): string {
  const full: SessionPayload = {
    ...payload,
    // Queda estampado el negocio en el que se hizo el login.
    neg: currentTenant()?.negocio.id,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + MAX_AGE,
  };
  const body = b64url(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

/** Verifica y decodifica un token; null si es inválido o expiró. */
export function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  // Comparación de tiempo constante
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    ) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const COOKIE = { employee: "emp_session", customer: "cust_session" } as const;

/**
 * La cookie de sesión vive bajo la URL del negocio (`/n/<slug>`), no en la raíz.
 * Así, en el mismo navegador, entrar al CRM de un negocio no cierra la sesión
 * del otro: son dos cookies distintas. En instalación de un solo negocio es `/`,
 * como siempre.
 */
function cookiePath(): string {
  const slug = currentTenant()?.negocio.slug;
  return slug ? `/n/${slug}` : "/";
}

export function setSessionCookie(
  kind: "employee" | "customer",
  token: string
) {
  cookies().set(COOKIE[kind], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: cookiePath(),
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(kind: "employee" | "customer") {
  cookies().delete({ name: COOKIE[kind], path: cookiePath() });
}

export function getSession(
  kind: "employee" | "customer"
): SessionPayload | null {
  // 1) Cookie (web) · 2) Authorization: Bearer <token> (apps móviles)
  let token = cookies().get(COOKIE[kind])?.value;
  if (!token) {
    const auth = headers().get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) token = auth.slice(7).trim();
  }
  const payload = verifyToken(token);
  if (!payload || payload.kind !== kind) return null;
  // La sesión solo vale en el negocio donde se hizo el login (ver `neg`).
  const actual = currentTenant()?.negocio.id ?? null;
  if ((payload.neg ?? null) !== actual) return null;
  return payload;
}
