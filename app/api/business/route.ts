import { NextRequest } from "next/server";
import { handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { readBusinessConfig, writeBusinessConfig } from "@/lib/businessStore";
import { resetPromoConfig } from "@/lib/promoStore";
import { applyRubroCatalog } from "@/lib/rubroApply";
import { defaultModules } from "@/lib/modules";
import type { BusinessConfig } from "@/lib/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business — config del negocio (rubro, marca, contacto). Pública:
// la tienda la necesita para pintarse con el rubro correcto.
export const GET = handler(async () => {
  return ok(await readBusinessConfig());
});

// POST /api/business — guarda la config (solo empleados).
//
// Si cambia el RUBRO se aplica el preset: colores, textos, categorías y la
// landing /promo vuelven a las del rubro nuevo, y se quitan los productos de
// ejemplo del rubro anterior. El catálogo de ejemplo del rubro nuevo SOLO se
// carga si se pide con `loadDemoCatalog` (por defecto el catálogo queda vacío).
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();

  const body = (await req.json()) as Partial<BusinessConfig> & {
    loadDemoCatalog?: boolean;
  };
  const loadDemo = !!body.loadDemoCatalog;
  const prev = await readBusinessConfig();

  // Cambiar de rubro aplica el preset completo, y los módulos son parte del
  // preset: pasar a repuestos apaga entregas y agenda, pasar a florería las
  // prende. Después se ajustan a mano en Configuración → Módulos del CRM.
  const cambiaRubro = !!body.rubroId && body.rubroId !== prev.rubroId;
  const saved = await writeBusinessConfig(
    cambiaRubro ? { ...body, modules: defaultModules(body.rubroId!) } : body
  );

  let catalog: { removed: number; added: number } | null = null;
  if (saved.rubroId !== prev.rubroId || loadDemo) {
    try {
      catalog = await applyRubroCatalog(prev.rubroId, saved.rubroId, loadDemo);
      if (saved.rubroId !== prev.rubroId) await resetPromoConfig();
    } catch (error) {
      // La config del negocio ya quedó guardada: no abortamos el guardado
      // porque la parte opcional (catálogo demo / promo) haya fallado.
      console.warn("[business] no se pudo aplicar el preset del rubro:", error);
    }
  }

  return ok({ ...saved, rubroChanged: saved.rubroId !== prev.rubroId, catalog });
});
