import { NextRequest } from "next/server";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  readVendedorConfig,
  writeVendedorConfig,
  aiConfigured,
  defaultVendedorConfig,
  type VendedorConfig,
} from "@/lib/vendedor247";
import { cloudEnabled } from "@/lib/whatsappCloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/whatsapp/config — config del vendedor 24/7 + estado (solo empleados).
export const GET = handler(async () => {
  if (!getSession("employee")) return unauthorized();
  const config = await readVendedorConfig();
  return ok({
    config,
    status: {
      aiConfigured,
      authMode: process.env.ANTHROPIC_API_KEY
        ? "api-key"
        : aiConfigured
          ? "cuenta"
          : "simulado",
      cloudConnected: cloudEnabled(),
    },
  });
});

// POST /api/whatsapp/config — guarda la config (solo empleados).
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const b = (await req.json()) as Partial<VendedorConfig>;

  const cfg: Partial<VendedorConfig> = {
    botEnabled: b.botEnabled ?? true,
    botPersona: (b.botPersona ?? defaultVendedorConfig.botPersona).trim(),
    activationKeyword: (b.activationKeyword ?? "").trim(),
    aiModel: (b.aiModel ?? defaultVendedorConfig.aiModel).trim() || defaultVendedorConfig.aiModel,
    paymentOptions: (b.paymentOptions ?? defaultVendedorConfig.paymentOptions).trim(),
    offHoursMessage: (b.offHoursMessage ?? "").trim(),
    businessHours: b.businessHours ?? null,
    timezone: (b.timezone ?? defaultVendedorConfig.timezone).trim() || defaultVendedorConfig.timezone,
  };

  const saved = await writeVendedorConfig(cfg);
  return ok({
    config: saved,
    status: {
      aiConfigured,
      authMode: process.env.ANTHROPIC_API_KEY
        ? "api-key"
        : aiConfigured
          ? "cuenta"
          : "simulado",
      cloudConnected: cloudEnabled(),
    },
  });
});
