import { headers } from "next/headers";
import { DEVICE_HEADER, NEGOCIO_HEADER } from "./tenantHeaders";
import {
  estaActivo,
  isMultiTenant,
  negocioBySlug,
  negocioByToken,
  touchDevice,
  type Negocio,
} from "./tenant";

/**
 * De la request al negocio. Dos maneras de decir "soy tal negocio":
 *
 *   1. **Token de pareo** (`X-Device-Token`, o `Authorization: Bearer <token>`)
 *      — lo usa la app móvil después de escanear el QR. El token identifica al
 *      dispositivo, y el dispositivo pertenece a un negocio.
 *   2. **Slug** (`x-negocio`) — lo inyecta el middleware cuando la URL es
 *      `/n/<slug>/…`. Es el caso de la web (tienda y CRM del navegador).
 *
 * Si no viene ninguna, no hay negocio: la app corre en modo de un solo negocio
 * (`DATABASE_URL`), que es como funcionaba antes del pareo.
 */

export { NEGOCIO_HEADER, DEVICE_HEADER };

// El token de pareo son 48 hex (`crypto.randomBytes(24)`); el token de sesión
// de un empleado es `payload.firma` en base64url. El punto los distingue, así
// que un Bearer puede llevar cualquiera de los dos sin ambigüedad.
const DEVICE_TOKEN_RE = /^[a-f0-9]{32,}$/i;

/** Token de pareo de esta request, si viene. */
export function deviceToken(): string | null {
  const h = headers();
  const explicit = h.get(DEVICE_HEADER)?.trim();
  if (explicit) return explicit;
  const auth = h.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const bearer = auth.slice(7).trim();
  // Un Bearer que NO es token de pareo es la sesión del empleado: no es asunto
  // nuestro (lo valida `lib/auth.ts`).
  return DEVICE_TOKEN_RE.test(bearer) ? bearer : null;
}

/** Slug del negocio de esta request, si la URL era `/n/<slug>/…`. */
export function negocioSlug(): string | null {
  return headers().get(NEGOCIO_HEADER)?.trim() || null;
}

/**
 * Resultado de resolver el negocio. Los casos de error se distinguen a
 * propósito: un token revocado o un slug inexistente NO pueden caer a la base
 * por defecto (le estaríamos sirviendo los datos de otro negocio a quien no
 * corresponde). Cada uno tiene su respuesta HTTP en `lib/api.ts`.
 */
export type TenantResolution =
  /** Sin negocio en la request: modo de un solo negocio (rutas viejas). */
  | { kind: "ninguno" }
  | { kind: "negocio"; negocio: Negocio; token: string | null }
  /** Token de pareo desconocido, de un dispositivo bloqueado o borrado → 401. */
  | { kind: "token-invalido" }
  /** `/n/<slug>` de un negocio que no existe → 404. */
  | { kind: "slug-desconocido"; slug: string }
  /** El comercio existe pero está suspendido o dado de baja → 403. */
  | { kind: "suspendido"; negocio: Negocio };

/**
 * Negocio de esta request. Cuando llega por token de pareo, de paso registra el
 * dispositivo como visto en la central, con lo que reportó la app — es lo que
 * el panel de Case muestra en la ficha del comercio.
 */
export async function resolveRequestTenant(): Promise<TenantResolution> {
  if (!isMultiTenant()) return { kind: "ninguno" };

  const token = deviceToken();
  if (token) {
    const negocio = await negocioByToken(token);
    if (!negocio) return { kind: "token-invalido" };
    if (!estaActivo(negocio)) return { kind: "suspendido", negocio };
    const h = headers();
    await touchDevice(token, {
      plataforma: h.get("x-device-platform"),
      modelo: h.get("x-device-model"),
      osVersion: h.get("x-device-os"),
      appVersion: h.get("x-app-version"),
      deviceName: h.get("x-device-name"),
      ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    });
    return { kind: "negocio", negocio, token };
  }

  const slug = negocioSlug();
  if (slug) {
    const negocio = await negocioBySlug(slug);
    if (!negocio) return { kind: "slug-desconocido", slug };
    if (!estaActivo(negocio)) return { kind: "suspendido", negocio };
    return { kind: "negocio", negocio, token: null };
  }
  return { kind: "ninguno" };
}

export { estaActivo };
