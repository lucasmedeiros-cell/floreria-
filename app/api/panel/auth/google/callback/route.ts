import { NextRequest, NextResponse } from "next/server";
import {
  checkOauthState,
  logActividad,
  panelCallbackUri,
  panelLoginGoogle,
  panelOauth,
  panelOrigin,
} from "@/lib/panelAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/panel/auth/google/callback → Google vuelve acá con el `code`.
 * Se canjea por el id_token directo contra Google (TLS, con el client_secret),
 * así que el payload es confiable sin verificar la firma; igual se chequean
 * emisor, audiencia, correo verificado y — lo que importa — el DOMINIO.
 */
export async function GET(req: NextRequest) {
  // Los redirects van al origen PÚBLICO: detrás de nginx, req.url es localhost.
  const origin = panelOrigin(req.headers);
  const back = (err: string) =>
    NextResponse.redirect(`${origin}/panel?oauth_error=${encodeURIComponent(err)}`);

  const { enabled, clientId, clientSecret, domain } = panelOauth();
  if (!enabled) return back("no_config");
  if (!checkOauthState(req.nextUrl.searchParams.get("state"))) return back("bad_state");
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return back("no_code");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: panelCallbackUri(req.headers),
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  if (!tokenRes?.ok) return back("token_exchange");

  const { id_token: idToken } = (await tokenRes.json().catch(() => ({}))) as { id_token?: string };
  const body = idToken?.split(".")[1];
  if (!body) return back("bad_id_token");
  let payload: {
    iss?: string;
    aud?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    hd?: string;
  };
  try {
    payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  } catch {
    return back("bad_id_token");
  }

  if (!["https://accounts.google.com", "accounts.google.com"].includes(payload.iss ?? ""))
    return back("bad_issuer");
  if (payload.aud !== clientId) return back("bad_audience");
  if (!payload.email_verified) return back("email_no_verificado");
  const email = String(payload.email ?? "").toLowerCase();
  if (payload.hd && String(payload.hd).toLowerCase() !== domain) return back("dominio");

  const session = await panelLoginGoogle(email, payload.name ?? "");
  if (session === "dominio") return back("dominio");
  if (session === "inactivo") return back("inactivo");
  if (!session) return back("sin_central");

  logActividad(session.email, "login", null, { via: "google" });
  return NextResponse.redirect(`${origin}/panel`);
}
