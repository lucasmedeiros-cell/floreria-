import { apiUrl } from "./apiBase";

/**
 * Subida de imágenes desde el CRM (arrastrar y soltar, elegir archivo o pegar).
 *
 * El servidor (`/api/uploads`) devuelve la imagen como **data URI**, así que
 * queda guardada dentro de la config del negocio y se ve en la web sin depender
 * del filesystem (ver el comentario de esa ruta). Como el data URI viaja en cada
 * carga de la landing, acá se **reduce la imagen antes de subirla**: una foto de
 * celular de 4 MB se convertiría en ~5,5 MB de base64 en cada visita.
 *
 * El formato se conserva (PNG y WebP siguen con transparencia, que es lo que
 * hace que el producto "flote" sobre el círculo de la landing).
 */

/** Lo que acepta `/api/uploads`. */
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB, igual que el servidor

/**
 * Lado máximo por defecto: de sobra para el hero de la landing en pantallas 2x.
 * Quien la use para algo más chico (una foto de catálogo, un logo) puede bajarlo
 * — el data URI viaja en cada carga, y el catálogo trae la imagen de CADA
 * producto en la misma respuesta.
 */
const MAX_SIDE = 1600;

/** Por debajo de esto, y ya dentro de medida, no vale la pena recomprimir. */
const RECOMPRESS_OVER = 900 * 1024;

const readAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("No se pudo leer el archivo."));
    fr.readAsDataURL(file);
  });

/** Mime real de un data URI (el navegador puede no soportar el que se pidió). */
const mimeOf = (dataUrl: string): string =>
  dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";

/**
 * Achica la imagen a `maxSide` px por lado si hace falta. Si el navegador no
 * puede decodificarla, se devuelve el archivo tal cual: mejor subir la original
 * que fallar (el servidor igual valida tamaño y formato).
 */
async function shrink(file: File, maxSide: number): Promise<string> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    // Ya está dentro de medida y no pesa: se sube tal cual, sin recomprimir.
    if (scale === 1 && file.size <= RECOMPRESS_OVER) {
      bmp.close?.();
      return readAsDataUrl(file);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return readAsDataUrl(file);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    // JPG se recomprime; PNG y WebP mantienen su formato (transparencia).
    const target = file.type === "image/jpeg" ? "image/jpeg" : file.type;
    return canvas.toDataURL(target, 0.85);
  } catch {
    return readAsDataUrl(file);
  }
}

/**
 * Sube un archivo de imagen y devuelve la referencia lista para guardar.
 * Tira `Error` con un mensaje en claro si el archivo no sirve o falla la subida.
 */
export async function uploadImageFile(
  file: File,
  maxSide: number = MAX_SIDE
): Promise<string> {
  if (!IMAGE_MIMES.includes(file.type as (typeof IMAGE_MIMES)[number])) {
    throw new Error(
      file.type.startsWith("image/")
        ? "Ese formato de imagen no se admite: usa JPG, PNG o WebP."
        : "El archivo no es una imagen."
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("La imagen supera los 6 MB. Usa una más liviana.");
  }

  const dataUrl = await shrink(file, maxSide);
  const res = await fetch(apiUrl("/api/uploads"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: dataUrl, mime: mimeOf(dataUrl) }),
  });
  const data = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "No se pudo subir la imagen. Revisa tu sesión.");
  }
  return data.url;
}

/** Primer archivo de imagen de un arrastre o de un pegado (Ctrl+V). */
export function imageFromTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  const files = Array.from(dt.files ?? []);
  const fromFiles = files.find((f) => f.type.startsWith("image/"));
  if (fromFiles) return fromFiles;
  // Al pegar, la imagen llega como item del portapapeles y no como archivo.
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return files[0] ?? null;
}

/** Peso aproximado de una imagen ya guardada como data URI, para mostrarlo. */
export function dataUrlSize(value: string): string | null {
  if (!value.startsWith("data:")) return null;
  const base64 = value.slice(value.indexOf(",") + 1);
  const bytes = Math.round((base64.length * 3) / 4);
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
