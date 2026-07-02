import { NextRequest } from "next/server";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { readAnimConfig, writeAnimConfig } from "@/lib/animStore";
import type { AnimConfig } from "@/lib/anim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/anim — config actual de animaciones (pública).
export const GET = handler(async () => {
  return ok(await readAnimConfig());
});

// POST /api/anim — guarda la config (solo empleados).
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const b = (await req.json()) as Partial<AnimConfig>;
  return ok(await writeAnimConfig({ web: !!b.web, admin: !!b.admin }));
});
