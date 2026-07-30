import { NextResponse } from "next/server";
import { getPanelSession } from "@/lib/panelAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/panel/me → quién está logueado en el panel (401 si nadie).
export async function GET() {
  const s = getPanelSession();
  if (!s) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  return NextResponse.json({ user: { email: s.email, name: s.name } });
}
