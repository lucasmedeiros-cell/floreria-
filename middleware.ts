import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { NEGOCIO_HEADER } from "@/lib/tenantHeaders";

/**
 * Dos trabajos:
 *
 * 1. **Negocio de la request.** Todo lo que cuelga de `/n/<slug>/…` pertenece a
 *    ese negocio: se pone el slug en el header `x-negocio` para que lo vean el
 *    layout y las rutas de la API (`lib/tenantRequest.ts`), y las llamadas a
 *    `/n/<slug>/api/…` se reescriben a `/api/…` — así la API se escribe una
 *    sola vez y sirve a todos los negocios.
 *
 *    El header entrante se BORRA siempre antes de escribirlo: el slug sale de
 *    la URL y de ningún otro lado. Si no, cualquiera se haría pasar por otro
 *    negocio mandando el header a mano.
 *
 * 2. **CORS** para `/api/*`, que es lo que consumen las apps móviles (el CRM
 *    pareado) desde otro origen.
 */
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    // X-Device-*: el token de pareo y lo que la app reporta de sí misma.
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Device-Token, X-Device-Platform, X-Device-Model, X-Device-OS, X-Device-Name, X-App-Version",
    "Access-Control-Max-Age": "86400",
  };
}

// `/n/<slug>` y, opcionalmente, lo que siga.
const TENANT_PATH = /^\/n\/([a-z0-9][a-z0-9_-]*)(\/.*)?$/i;

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  const { pathname } = req.nextUrl;
  const tenant = pathname.match(TENANT_PATH);
  const slug = tenant?.[1]?.toLowerCase() ?? null;
  const rest = tenant?.[2] ?? "";
  const isApi = pathname.startsWith("/api/") || rest.startsWith("/api/");

  if (req.method === "OPTIONS" && isApi) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  const reqHeaders = new Headers(req.headers);
  reqHeaders.delete(NEGOCIO_HEADER);
  if (slug) reqHeaders.set(NEGOCIO_HEADER, slug);

  // `/n/<slug>/api/products` → `/api/products`, con el negocio ya en el header.
  const res =
    slug && rest.startsWith("/api/")
      ? NextResponse.rewrite(new URL(rest + req.nextUrl.search, req.url), {
          request: { headers: reqHeaders },
        })
      : NextResponse.next({ request: { headers: reqHeaders } });

  if (isApi) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
  }
  return res;
}

export const config = { matcher: ["/api/:path*", "/n/:path*"] };
