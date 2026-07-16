import { NextRequest } from "next/server";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { redeemPairCode } from "@/lib/pairing";
import { currentTenant, negociosEasyposActivos, runWithTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Canjea el código de 6 dígitos por un token de dispositivo. Público (la app
 * todavía no está pareada, no tiene con qué autenticarse); lo que lo protege es
 * que el código es de un solo uso, vence rápido y tiene límite de intentos.
 *
 * Multi-negocio: la app llega con SOLO el código, sin saber a qué negocio
 * pertenece. Si la request ya trae negocio (llegó por `/n/<slug>/…`), se canjea
 * ahí; si no, se busca el código en la base de cada negocio easy pos. Así la app
 * se puede parear con un código a secas, sin tener que saber el slug de antemano.
 * La respuesta incluye el negocio, para que la app sepa contra quién quedó.
 */
export const POST = handler(async (req: NextRequest) => {
  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return bad("Falta el código de vinculación.");
  }

  const h = req.headers;
  const meta = {
    platform: h.get("x-device-platform"),
    model: h.get("x-device-model"),
    osVersion: h.get("x-device-os"),
    appVersion: h.get("x-app-version"),
    deviceName: h.get("x-device-name"),
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
  };

  const noValido = () =>
    unauthorized("Código incorrecto o vencido. Pedí uno nuevo en el CRM.");

  // La request ya está en un negocio (vino por /n/<slug>/…): se canjea ahí.
  const actual = currentTenant();
  if (actual) {
    const result = await redeemPairCode(code, meta);
    if (!result.ok) return noValido();
    return ok({
      token: result.token,
      negocio: { slug: actual.negocio.slug, nombre: actual.negocio.nombre },
    });
  }

  // Sin negocio en la request: se prueba el código contra cada negocio easy pos.
  for (const neg of await negociosEasyposActivos()) {
    const result = await runWithTenant(neg, () => redeemPairCode(code, meta));
    if (result.ok) {
      return ok({
        token: result.token,
        negocio: { slug: neg.slug, nombre: neg.nombre },
      });
    }
  }
  return noValido();
});
