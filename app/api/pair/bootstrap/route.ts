import { NextRequest } from "next/server";
import { bad, handler, ok } from "@/lib/api";
import { query, queryOne } from "@/lib/db";
import { writeBusinessConfig } from "@/lib/businessStore";
import { resetPromoConfig } from "@/lib/promoStore";
import { applyRubroCatalog } from "@/lib/rubroApply";
import { defaultModules } from "@/lib/modules";
import { RUBROS, type RubroId } from "@/lib/rubros";
import { currentTenant } from "@/lib/tenant";
import { deviceToken } from "@/lib/tenantRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deja lista la base de un negocio recién activado: rubro aplicado (colores,
 * textos, categorías, landing), catálogo de ejemplo si se pide, y el PRIMER
 * empleado, que es con quien el dueño entra a su CRM.
 *
 * Lo llama el panel de Case justo después de crear la base, con el token de
 * pareo del comercio. El esquema (tablas) lo crea el provisioning por SQL; lo
 * que sabe de rubros es easy pos, así que esa parte la siembra easy pos.
 *
 *   POST /api/pair/bootstrap
 *   X-Device-Token: <token del comercio>
 *   { nombre, rubro, email, pass, whatsapp?, loadDemoCatalog? }
 *
 * Corre UNA sola vez: si el negocio ya tiene empleados, devuelve 409 y no toca
 * nada. Si no, el token —que es de un dispositivo, no de una persona— alcanzaría
 * para reescribirle la marca y crearse un usuario a un comercio en marcha.
 */
export const POST = handler(async (req: NextRequest) => {
  if (!deviceToken()) return bad("Falta el token de pareo (header X-Device-Token).");
  const tenant = currentTenant();
  if (!tenant) return bad("Esta instalación no tiene pareo de negocios habilitado.", 501);

  const b = (await req.json().catch(() => ({}))) as {
    nombre?: string;
    rubro?: string;
    email?: string;
    pass?: string;
    whatsapp?: string;
    loadDemoCatalog?: boolean;
  };

  const nombre = (b.nombre ?? tenant.negocio.nombre).trim();
  const email = (b.email ?? "").trim().toLowerCase();
  const pass = b.pass ?? "";
  const rubro = (b.rubro ?? "").trim();

  if (!email || !pass) return bad("Hace falta el correo y la contraseña del dueño.");
  if (pass.length < 6) return bad("La contraseña debe tener al menos 6 caracteres.");
  if (!(rubro in RUBROS)) {
    return bad(`Rubro desconocido: "${rubro}". Ver lib/rubros.ts.`);
  }

  const yaHay = await queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM employees`);
  if (Number(yaHay?.n ?? 0) > 0) {
    return bad("Este negocio ya está inicializado.", 409);
  }

  // 1) Marca + rubro del negocio (lo que pinta la tienda, la landing y el bot).
  //    Los módulos arrancan según el rubro (una ferretería nace sin entregas ni
  //    agenda). Van explícitos: si no, al mezclar con el default de arranque
  //    (florería, todo prendido) se quedarían todos en on.
  const saved = await writeBusinessConfig({
    rubroId: rubro as RubroId,
    modules: defaultModules(rubro as RubroId),
    name: nombre,
    whatsapp: b.whatsapp ?? "",
    configured: true,
  });

  // 2) Preset del rubro: catálogo de ejemplo (opcional) y landing por defecto.
  let catalog: { removed: number; added: number } | null = null;
  try {
    catalog = await applyRubroCatalog(saved.rubroId, saved.rubroId, !!b.loadDemoCatalog);
    await resetPromoConfig();
  } catch (error) {
    // La base ya quedó utilizable: no abortamos el alta porque falle el demo.
    console.warn("[pair] no se pudo aplicar el preset del rubro:", error);
  }

  // 3) Dueño del negocio: la cuenta con la que entra a su CRM.
  const owner = await queryOne<{ id: string; name: string; email: string; role: string }>(
    `INSERT INTO employees (name, email, pass_hash, role)
       VALUES ($1, $2, crypt($3, gen_salt('bf')), 'Administrador')
     RETURNING id, name, email, role`,
    [nombre, email, pass]
  );

  return ok({ negocio: tenant.negocio, business: saved, owner, catalog }, { status: 201 });
});
