import { NextRequest } from "next/server";
import { bad, handler, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy de reporte de bugs → sistema de Tickets (tickets.petroboxinc.com).
 *
 * El botón "Debug" (web y CRM) postea acá; este endpoint reenvía a
 * `/api/public/report` de Tickets con la API key del app_client de FloresOnline.
 * La key vive SOLO en el servidor (env TICKETS_API_KEY), nunca en el navegador,
 * y así también se evita el CORS. Los tickets entran en estado "desarrollo"
 * (caso_desarrollo) con el slug del proyecto (FLORESONLINE) en el título.
 */

const TICKETS_API = process.env.TICKETS_API || "https://tickets.petroboxinc.com/api";
const TICKETS_API_KEY = process.env.TICKETS_API_KEY || "";

export const POST = handler(async (req: NextRequest) => {
  if (!TICKETS_API_KEY) {
    return bad("El reporte de bugs no está configurado (falta TICKETS_API_KEY).", 503);
  }

  const form = await req.formData();
  const tipo = (form.get("tipo") as string) === "optimizacion" ? "optimizacion" : "error";
  const titulo = ((form.get("titulo") as string) || "").trim();
  const descripcion = ((form.get("descripcion") as string) || "").trim();
  const email = ((form.get("email") as string) || "").trim();
  const surface = ((form.get("surface") as string) || "web").trim();
  const url = ((form.get("url") as string) || "").trim();
  const imagen = form.get("imagen");

  if (!titulo || !descripcion) return bad("Título y descripción son obligatorios.");
  if (!email) return bad("El correo es obligatorio.");

  // Contexto útil para el ticket (además del origen/IP/UA que ya guarda Tickets).
  const contexto =
    `\n\n--- Contexto ---\n` +
    `Proyecto: FloresOnline\n` +
    `Origen: ${surface === "crm" ? "CRM / Admin" : "Tienda web"}\n` +
    `URL: ${url || "N/A"}`;

  const out = new FormData();
  out.append("tipo", tipo);
  out.append("titulo", titulo);
  out.append("descripcion", descripcion + contexto);
  out.append("email", email);
  if (imagen && typeof imagen !== "string" && (imagen as File).size > 0) {
    // El campo DEBE llamarse "imagenes" (plural) para Tickets.
    out.append("imagenes", imagen as File, (imagen as File).name || "captura.jpg");
  }

  const r = await fetch(`${TICKETS_API}/public/report`, {
    method: "POST",
    headers: { "X-Api-Key": TICKETS_API_KEY },
    body: out,
  });
  const data = (await r.json().catch(() => ({}))) as {
    ok?: boolean;
    numero_ticket?: string;
    error?: string;
    mensaje?: string;
  };
  if (!r.ok) {
    const status = r.status >= 400 && r.status < 600 ? r.status : 502;
    return bad(data?.mensaje || data?.error || "No se pudo enviar el reporte.", status);
  }
  return ok({ numero_ticket: data.numero_ticket ?? null });
});
