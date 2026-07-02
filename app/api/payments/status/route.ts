import { NextRequest } from "next/server";
import { bad, handler, ok } from "@/lib/api";
import { consultarEstado } from "@/lib/baas";

export const runtime = "nodejs";

// POST /api/payments/status  { correlativo, qrId }
// Consulta al BaaS si el QR ya fue pagado (polling desde el checkout).
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json();
  const correlativo = (body?.correlativo ?? "").toString();
  if (!correlativo) return bad("Falta el correlativo del QR.");
  const qrId = body?.qrId ?? null;

  const estado = await consultarEstado(correlativo, qrId);
  return ok({
    pagado: estado.pagado,
    amount: estado.amount ?? null,
    operationNumber: estado.operationNumber ?? null,
    receiverName: estado.receiverName ?? null,
    fecha: estado.fecha ?? null,
  });
});
