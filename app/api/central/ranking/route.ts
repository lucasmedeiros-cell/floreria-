import { NextRequest } from "next/server";
import { handler, ok, unauthorized } from "@/lib/api";
import {
  centralConfigured,
  centralTokenOk,
  getRanking,
  readCentralToken,
  type Periodo,
} from "@/lib/central";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: Periodo[] = ["hoy", "semana", "mes", "anio"];

// GET /api/central/ranking?token=...&periodo=mes
// Ramos más vendidos + desglose por categoría, canal y método de pago.
export const GET = handler(async (req: NextRequest) => {
  if (!centralConfigured())
    return new Response(
      JSON.stringify({ error: "Integración no configurada (falta CENTRAL_API_TOKEN)." }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  if (!centralTokenOk(readCentralToken(req))) return unauthorized("Token inválido.");
  const p = req.nextUrl.searchParams.get("periodo") as Periodo | null;
  const periodo: Periodo = p && VALID.includes(p) ? p : "mes";
  return ok(await getRanking(periodo));
});
