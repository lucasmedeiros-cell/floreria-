import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook, processWebhook } from "@/lib/whatsappCloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de WhatsApp Cloud API (Meta).
 *
 * GET  → verificación del webhook (Meta hace un GET al configurarlo).
 * POST → mensajes entrantes: se procesan (CRM + IA) y respondemos 200.
 */

// GET /api/whatsapp/webhook?hub.mode=&hub.verify_token=&hub.challenge=
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const challenge = verifyWebhook(
    sp.get("hub.mode"),
    sp.get("hub.verify_token"),
    sp.get("hub.challenge")
  );
  if (challenge !== null) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// POST /api/whatsapp/webhook — payload de mensajes de Meta.
export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Meta a veces manda pings sin JSON; respondemos 200 igual.
  }
  // Procesamos antes de responder para que funcione en entornos serverless
  // (Netlify) donde el trabajo posterior al response no está garantizado.
  try {
    await processWebhook(body);
  } catch (e) {
    console.warn(`[wa] webhook: ${e}`);
  }
  return new NextResponse("ok", { status: 200 });
}
