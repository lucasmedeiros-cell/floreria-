import { NextRequest } from "next/server";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { readPromoConfig, writePromoConfig } from "@/lib/promoStore";
import { defaultPromoConfig, type PromoConfig } from "@/lib/promo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/promo — config actual de la landing (pública).
export const GET = handler(async () => {
  return ok(await readPromoConfig());
});

// POST /api/promo — guarda la config (solo empleados).
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const b = (await req.json()) as Partial<PromoConfig>;

  // Normaliza/sanea los campos editables.
  const cfg: PromoConfig = {
    ...defaultPromoConfig,
    ...b,
    enabled: b.enabled ?? true,
    price: Math.round(Number(b.price) || 0),
    originalPrice:
      b.originalPrice == null || b.originalPrice === ("" as unknown)
        ? undefined
        : Math.round(Number(b.originalPrice) || 0),
    productName: (b.productName ?? defaultPromoConfig.productName).trim(),
    title: (b.title ?? defaultPromoConfig.title).trim(),
  };

  return ok(await writePromoConfig(cfg));
});
