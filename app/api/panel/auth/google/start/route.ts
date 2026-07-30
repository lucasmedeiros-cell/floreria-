import { NextRequest, NextResponse } from "next/server";
import { panelCallbackUri, panelOauth, panelOrigin, signOauthState } from "@/lib/panelAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/panel/auth/google/start → manda a elegir la cuenta de Google.
// `hd` le pide a Google mostrar solo cuentas del dominio; la verificación
// de verdad la hace el callback (hd es solo cosmético, se puede forjar).
export async function GET(req: NextRequest) {
  const { enabled, clientId, domain } = panelOauth();
  if (!enabled)
    return NextResponse.redirect(`${panelOrigin(req.headers)}/panel?oauth_error=no_config`);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: panelCallbackUri(req.headers),
    response_type: "code",
    scope: "openid email profile",
    state: signOauthState(),
    hd: domain,
    prompt: "select_account",
  });
  return NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
}
