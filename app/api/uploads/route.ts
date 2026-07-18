import { NextRequest } from "next/server";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sube una imagen y devuelve una referencia lista para usar en un producto o el
 * logo del negocio. La app manda los bytes en base64.
 *
 * Devuelve la imagen como **data URI** (`data:<mime>;base64,…`), autocontenida:
 * se guarda tal cual en el producto/negocio y renderiza en la app (MemoryImage)
 * y en el web (`<img src>`) sin depender del filesystem. Esto funciona en
 * cualquier despliegue: `next start` y serverless NO sirven archivos escritos en
 * `public/` en runtime, así que guardar en disco daba 404. (Si en el futuro se
 * suma almacenamiento de objetos S3/R2, este endpoint puede volver a devolver
 * una URL http sin tocar a quien lo llama.)
 *
 * Requiere sesión de empleado (no es un buzón abierto de subida).
 */
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB por imagen
const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized("Iniciá sesión para subir imágenes.");

  const { data, mime } = (await req.json()) as { data?: string; mime?: string };
  if (!data) return bad("Falta la imagen.");

  const type = (mime ?? "image/jpeg").toLowerCase();
  if (!OK_TYPES.has(type)) return bad("Formato no soportado (usá JPG, PNG o WebP).");

  // Acepta tanto un data URI ("data:image/...;base64,XXXX") como base64 puro.
  const base64 = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0) return bad("La imagen está vacía o mal codificada.");
  if (buf.length > MAX_BYTES) return bad("La imagen supera los 6 MB.");

  return ok({ url: `data:${type};base64,${base64}` });
});
