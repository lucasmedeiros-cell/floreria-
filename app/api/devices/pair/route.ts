import { NextRequest } from "next/server";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { bumpFailedAttempts, redeemPairCode } from "@/lib/pairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Canjea el código de 6 dígitos por un token de dispositivo. Público (la app
 * todavía no está pareada, no tiene con qué autenticarse); lo que lo protege es
 * que el código es de un solo uso, vence rápido y tiene límite de intentos.
 */
export const POST = handler(async (req: NextRequest) => {
  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return bad("Falta el código de vinculación.");
  }

  const h = req.headers;
  const result = await redeemPairCode(code, {
    platform: h.get("x-device-platform"),
    model: h.get("x-device-model"),
    osVersion: h.get("x-device-os"),
    appVersion: h.get("x-app-version"),
    deviceName: h.get("x-device-name"),
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
  });

  if (!result.ok) {
    // Un fallo suma un intento a los códigos vigentes: así 10.000/1.000.000 de
    // pruebas a ciegas se cortan solas.
    await bumpFailedAttempts();
    const msg = {
      invalid: "Código incorrecto.",
      expired: "El código venció. Pedí uno nuevo en el CRM.",
      too_many: "Demasiados intentos. Pedí un código nuevo.",
    }[result.reason];
    return unauthorized(msg);
  }

  return ok({ token: result.token });
});
