import { NextRequest } from "next/server";
import { bad, handler, ok } from "@/lib/api";
import { readBusiness } from "@/lib/businessStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy de reporte de bugs → sistema de Tickets (tickets.petroboxinc.com).
 *
 * El botón "Debug" (web/CRM, programa de PC y app de celular) postea acá; este
 * endpoint reenvía a `/api/public/report` de Tickets con la API key del
 * app_client. La key vive SOLO en el servidor (env TICKETS_API_KEY), nunca en
 * el cliente, y así también se evita el CORS. Los tickets entran en desarrollo.
 *
 * Acepta dos formatos:
 *   · multipart/form-data → la web (puede adjuntar una captura).
 *   · application/json     → el programa de PC y la app (sin imagen).
 *
 * El PROYECTO con el que se etiqueta el ticket es configurable (TICKETS_PROJECT)
 * para que cada instalación (p. ej. "Auto Piezas Coquito") reporte a su nombre.
 */

const TICKETS_API = process.env.TICKETS_API || "https://tickets.petroboxinc.com/api";
const TICKETS_API_KEY = process.env.TICKETS_API_KEY || "";
// Marca de la plataforma. El nombre del NEGOCIO se agrega dinámicamente por
// request (readBusiness), así el ticket dice "easy pos · <negocio>".
const TICKETS_PROJECT = process.env.TICKETS_PROJECT || "easy pos";

function origenLabel(surface: string): string {
  switch (surface) {
    case "crm": return "CRM / Admin";
    case "pc": return "Programa de PC";
    case "mobile": return "App de celular";
    default: return "Tienda web";
  }
}

export const POST = handler(async (req: NextRequest) => {
  if (!TICKETS_API_KEY) {
    return bad("El reporte de bugs no está configurado (falta TICKETS_API_KEY).", 503);
  }

  // Según el content-type: la web manda multipart (con captura); el programa de
  // PC y la app mandan JSON.
  const ct = req.headers.get("content-type") || "";
  let tipo = "error";
  let titulo = "";
  let descripcion = "";
  let email = "";
  let surface = "web";
  let url = "";
  let imagen: File | null = null;

  if (ct.includes("application/json")) {
    const b = await req.json();
    tipo = b.tipo === "optimizacion" ? "optimizacion" : "error";
    titulo = String(b.titulo ?? "").trim();
    descripcion = String(b.descripcion ?? "").trim();
    email = String(b.email ?? "").trim();
    surface = String(b.surface ?? "web").trim();
    url = String(b.url ?? "").trim();
  } else {
    const form = await req.formData();
    tipo = (form.get("tipo") as string) === "optimizacion" ? "optimizacion" : "error";
    titulo = ((form.get("titulo") as string) || "").trim();
    descripcion = ((form.get("descripcion") as string) || "").trim();
    email = ((form.get("email") as string) || "").trim();
    surface = ((form.get("surface") as string) || "web").trim();
    url = ((form.get("url") as string) || "").trim();
    const img = form.get("imagen");
    if (img && typeof img !== "string" && (img as File).size > 0) imagen = img as File;
  }

  if (!titulo || !descripcion) return bad("Título y descripción son obligatorios.");
  if (!email) return bad("El correo es obligatorio.");

  // Nombre del negocio de esta request (para etiquetar el ticket). Si falla la
  // lectura, se sigue solo con la marca de la plataforma.
  let negocio = "";
  try {
    negocio = (await readBusiness()).name?.trim() ?? "";
  } catch {
    /* sin negocio: queda solo "easy pos" */
  }
  const etiqueta = negocio ? `${TICKETS_PROJECT} · ${negocio}` : TICKETS_PROJECT;

  // Contexto útil para el ticket (además del origen/IP/UA que ya guarda Tickets).
  const contexto =
    `\n\n--- Contexto ---\n` +
    `Plataforma: ${TICKETS_PROJECT}\n` +
    `Negocio: ${negocio || "N/A"}\n` +
    `Origen: ${origenLabel(surface)}\n` +
    `URL: ${url || "N/A"}`;

  const out = new FormData();
  out.append("tipo", tipo);
  out.append("titulo", `[${etiqueta}] ${titulo}`);
  out.append("descripcion", descripcion + contexto);
  out.append("email", email);
  if (imagen) {
    // El campo DEBE llamarse "imagenes" (plural) para Tickets.
    out.append("imagenes", imagen, imagen.name || "captura.jpg");
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
