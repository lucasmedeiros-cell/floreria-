import { NextResponse } from "next/server";
import { panelOauth } from "@/lib/panelAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/panel/auth/config → cómo se entra al panel: con Google (y qué
// dominio se acepta) o, si no está configurado, con correo y contraseña.
export async function GET() {
  const { enabled, domain } = panelOauth();
  return NextResponse.json({ oauth: enabled, domain });
}
