import { NextRequest } from "next/server";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { generarQR } from "@/lib/baas";

export const runtime = "nodejs";

// Toda ruta de la API resuelve a qué negocio pertenece la request (lee headers
// en `handler()`), así que nunca se puede renderizar estáticamente.
export const dynamic = "force-dynamic";

// POST /api/payments/qr  { amount, gloss? }
// Genera un QR dinámico del BCP (vía BaaS) por el monto de la compra.
export const POST = handler(async (req: NextRequest) => {
  // Solo el POS: sin sesión, cualquiera podría generar QRs ilimitados contra
  // las credenciales BaaS del comercio.
  if (!getSession("employee")) return unauthorized();
  const body = await req.json();
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return bad("Monto inválido para generar el QR.");
  const gloss = (body?.gloss ?? "Compra FloresOnline").toString();

  const qr = await generarQR(amount, gloss);
  // 400 y no 502: los proxies (p. ej. el túnel de Cloudflare) reemplazan los
  // 502 por su propia página HTML y el POS nunca vería el motivo real.
  if (!qr.ok) return bad(qr.error ?? "No se pudo generar el QR", 400);

  return ok({
    correlativo: qr.correlativo,
    qrId: qr.id,
    // data-URI listo para <img src>
    qrImage: `data:image/png;base64,${qr.qrImage}`,
    amount: qr.amount ?? amount,
    expiration: qr.expiration,
  });
});
