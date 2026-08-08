import { NextRequest } from "next/server";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  readVendedorConfig,
  writeVendedorConfig,
  aiConfigured,
  authMode,
  defaultVendedorConfig,
  type VendedorConfig,
} from "@/lib/vendedor247";
import { cloudEnabled } from "@/lib/whatsappCloud";
import { currentTenant, isMultiTenant, waNumerosDeNegocio } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado del WhatsApp de ESTE negocio. Los números los asocia el panel de easy
 * pos (viven en la central), así que acá solo se muestran: el negocio no los
 * puede cambiar por su cuenta.
 */
async function estado() {
  const negocio = currentTenant()?.negocio;
  const numeros = negocio ? await waNumerosDeNegocio(negocio.id) : [];
  const atendiendo = numeros.filter((n) => n.activo);
  return {
    aiConfigured: aiConfigured(),
    authMode: authMode(),
    // En modo negocio único no hay central: vale el número del entorno.
    cloudConnected: isMultiTenant() ? atendiendo.length > 0 : cloudEnabled(),
    numeros: numeros.map((n) => ({
      numero: n.numero,
      etiqueta: n.etiqueta,
      activo: n.activo,
    })),
  };
}

// GET /api/whatsapp/config — config del vendedor 24/7 + estado (solo empleados).
export const GET = handler(async () => {
  if (!getSession("employee")) return unauthorized();
  const config = await readVendedorConfig();
  return ok({ config, status: await estado() });
});

// POST /api/whatsapp/config — guarda la config (solo empleados).
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const b = (await req.json()) as Partial<VendedorConfig>;

  const cfg: Partial<VendedorConfig> = {
    botEnabled: b.botEnabled ?? defaultVendedorConfig.botEnabled,
    botPersona: (b.botPersona ?? defaultVendedorConfig.botPersona).trim(),
    // Las indicaciones se recortan: es el campo donde el negocio escribe libre y
    // todo esto viaja en cada llamada al modelo.
    botInstructions: (b.botInstructions ?? "").slice(0, 4000).trim(),
    activationKeyword: (b.activationKeyword ?? "").trim(),
    aiModel: (b.aiModel ?? defaultVendedorConfig.aiModel).trim() || defaultVendedorConfig.aiModel,
    paymentOptions: (b.paymentOptions ?? defaultVendedorConfig.paymentOptions).trim(),
    offHoursMessage: (b.offHoursMessage ?? "").trim(),
    businessHours: b.businessHours ?? null,
    timezone: (b.timezone ?? defaultVendedorConfig.timezone).trim() || defaultVendedorConfig.timezone,
  };

  const saved = await writeVendedorConfig(cfg);
  return ok({ config: saved, status: await estado() });
});
