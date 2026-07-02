import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS para las rutas /api/* — permite que las apps móviles (Flutter,
 * incl. la vista en Chrome) consuman el backend desde otro origen.
 */
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = { matcher: "/api/:path*" };
