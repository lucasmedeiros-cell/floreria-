import { NextRequest } from "next/server";
import { handler, ok, unauthorized } from "@/lib/api";
import {
  centralConfigured,
  centralTokenOk,
  getResumen,
  readCentralToken,
} from "@/lib/central";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/central/resumen?token=...
// KPIs agregados (ingresos, gastos, ganancia, pedidos) hoy/semana/mes/año.
// Consumido por el dashboard central COMANDER.
export const GET = handler(async (req: NextRequest) => {
  if (!centralConfigured())
    return new Response(
      JSON.stringify({ error: "Integración no configurada (falta CENTRAL_API_TOKEN)." }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  if (!centralTokenOk(readCentralToken(req))) return unauthorized("Token inválido.");
  return ok(await getResumen());
});
