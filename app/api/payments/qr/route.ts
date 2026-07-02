import { NextRequest } from "next/server";
import { bad, handler, ok } from "@/lib/api";
import { generarQR } from "@/lib/baas";

export const runtime = "nodejs";

// POST /api/payments/qr  { amount, gloss? }
// Genera un QR dinámico del BCP (vía BaaS) por el monto de la compra.
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json();
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return bad("Monto inválido para generar el QR.");
  const gloss = (body?.gloss ?? "Compra FloresOnline").toString();

  const qr = await generarQR(amount, gloss);
  if (!qr.ok) return bad(qr.error ?? "No se pudo generar el QR", 502);

  return ok({
    correlativo: qr.correlativo,
    qrId: qr.id,
    // data-URI listo para <img src>
    qrImage: `data:image/png;base64,${qr.qrImage}`,
    amount: qr.amount ?? amount,
    expiration: qr.expiration,
  });
});
