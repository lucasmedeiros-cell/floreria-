import { NextRequest } from "next/server";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { baileys } from "@/lib/whatsappBaileys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Control del transporte Baileys (WhatsApp por QR).
 *
 * GET  → estado + QR (data URL) para vincular el número.
 * POST → { action: "start" | "stop" | "logout" }.
 *
 * Requiere sesión de empleado (se maneja desde el panel admin).
 */

// GET /api/whatsapp/baileys
export const GET = handler(async () => {
  if (!getSession("employee")) return unauthorized();
  const wa = baileys();
  return ok({ ...wa.getStatus(), qr: wa.getQr() });
});

// POST /api/whatsapp/baileys  { action }
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const wa = baileys();

  if (action === "start") {
    await wa.start();
    return ok({ ...wa.getStatus(), qr: wa.getQr() });
  }
  if (action === "logout") {
    await wa.logout();
    return ok({ ...wa.getStatus() });
  }
  return bad("Acción inválida. Usa start o logout.");
});
