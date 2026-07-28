import { NextRequest } from "next/server";
import { bad, handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  deletePromoPage,
  readPromoPages,
  savePromoPage,
  setPrincipalPromoPage,
} from "@/lib/promoStore";
import type { PromoPage } from "@/lib/promo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

// GET /api/promos/<id> — una landing.
export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  if (!getSession("employee")) return unauthorized();
  const page = (await readPromoPages()).find((p) => p.id === params.id);
  return page ? ok(page) : notFound("Esa landing ya no existe.");
});

/**
 * POST /api/promos/<id> — guarda la landing.
 *
 * Es POST y no PUT porque el CORS del middleware (y las apps pareadas) solo
 * habilitan GET/POST/PATCH/DELETE.
 */
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  if (!getSession("employee")) return unauthorized();
  const body = (await req.json()) as Partial<PromoPage>;

  const saved = await savePromoPage(params.id, body);
  return saved ? ok(saved) : notFound("Esa landing ya no existe.");
});

// PATCH /api/promos/<id> — `{ principal: true }` la deja como landing de /promo.
export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  if (!getSession("employee")) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { principal?: boolean };
  if (!body.principal) return bad("Nada que cambiar.");

  const res = await setPrincipalPromoPage(params.id);
  if ("error" in res) return notFound(res.error);
  return ok(res);
});

// DELETE /api/promos/<id> — borra la landing (nunca la última que queda).
export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  if (!getSession("employee")) return unauthorized();
  const res = await deletePromoPage(params.id);
  if ("error" in res) return bad(res.error);
  return ok(res);
});
