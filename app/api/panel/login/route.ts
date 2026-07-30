import { NextRequest, NextResponse } from "next/server";
import { getPanelSession, logActividad, panelLogin, panelLogout, panelOauth } from "@/lib/panelAuth";
import { isMultiTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/panel/login  { email, pass } → deja la cookie de sesión del panel.
// Solo cuando NO hay Google configurado (desarrollo): con OAuth el panel entra
// únicamente con la cuenta @petroboxinc.com, sin contraseñas.
export async function POST(req: NextRequest) {
  const oauth = panelOauth();
  if (oauth.enabled)
    return NextResponse.json(
      { error: `El panel entra solo con Google (cuentas @${oauth.domain}).` },
      { status: 403 }
    );
  if (!isMultiTenant())
    return NextResponse.json(
      { error: "Esta instalación no tiene central de negocios (CENTRAL_DATABASE_URL)." },
      { status: 501 }
    );
  const body = (await req.json().catch(() => ({}))) as { email?: string; pass?: string };
  const email = (body.email ?? "").toString().trim();
  const pass = (body.pass ?? "").toString();
  if (!email || !pass)
    return NextResponse.json({ error: "Poné el correo y la contraseña." }, { status: 400 });

  const session = await panelLogin(email, pass);
  if (!session) {
    // Freno suave a la fuerza bruta; el mensaje no dice si el correo existe.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }
  logActividad(session.email, "login", null, {});
  return NextResponse.json({ user: { email: session.email, name: session.name } });
}

// DELETE /api/panel/login → cierra la sesión.
export async function DELETE() {
  const s = getPanelSession();
  panelLogout();
  if (s) logActividad(s.email, "logout", null, {});
  return NextResponse.json({ ok: true });
}
