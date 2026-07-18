import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

/**
 * Búsqueda de un producto por su código de barras en bases públicas.
 *
 * Se consultan varias fuentes en orden y se devuelve el primer acierto,
 * normalizado a los campos que usa el alta de productos. Es "mejor esfuerzo":
 * si ninguna fuente conoce el código (frecuente en repuestos y productos
 * locales), devuelve `found: false` y el usuario completa a mano.
 *
 * Corre en el servidor para evitar CORS y para poder RE-HOSPEDAR la imagen: la
 * foto que devuelve la fuente se descarga y se guarda en `public/images`, así el
 * producto no depende de un enlace externo que puede caerse.
 */

export interface BarcodeInfo {
  found: boolean;
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  /** Path ya re-hospedado (`/images/...`), listo para guardar en el producto. */
  image?: string;
  source?: string;
  /** País de registro, deducido del prefijo GS1 del código. Siempre que el
   *  código sea un EAN/UPC válido, esto se puede saber aunque no haya foto ni
   *  nombre en ninguna base — es lo único que el NÚMERO en sí codifica. */
  country?: string;
}

/**
 * País de registro según el prefijo GS1 (primeros dígitos del EAN-13). OJO: es
 * dónde se registró el FABRICANTE, no necesariamente dónde se hizo el producto.
 * Es lo único legible que contiene el número de un código de barras.
 */
export function gs1Country(code: string): string | undefined {
  const c = code.replace(/\D/g, "");
  if (c.length < 3) return undefined;
  const p = Number(c.slice(0, 3));
  const rango = (a: number, b: number) => p >= a && p <= b;

  if (rango(0, 19) || rango(30, 39) || rango(60, 139)) return "Estados Unidos / Canadá";
  if (rango(300, 379)) return "Francia";
  if (rango(400, 440)) return "Alemania";
  if (rango(450, 459) || rango(490, 499)) return "Japón";
  if (rango(460, 469)) return "Rusia";
  if (rango(500, 509)) return "Reino Unido";
  if (rango(690, 699)) return "China";
  if (rango(700, 709)) return "Noruega";
  if (rango(729, 729)) return "Israel";
  if (rango(750, 750)) return "México";
  if (rango(754, 755)) return "Canadá";
  if (rango(759, 759)) return "Venezuela";
  if (rango(770, 771)) return "Colombia";
  if (rango(773, 773)) return "Uruguay";
  if (rango(775, 775)) return "Perú";
  if (rango(777, 777)) return "Bolivia";
  if (rango(778, 779)) return "Argentina";
  if (rango(780, 780)) return "Chile";
  if (rango(784, 784)) return "Paraguay";
  if (rango(786, 786)) return "Ecuador";
  if (rango(789, 790)) return "Brasil";
  if (rango(800, 839)) return "Italia";
  if (rango(840, 849)) return "España";
  if (rango(870, 879)) return "Países Bajos";
  if (rango(880, 880)) return "Corea del Sur";
  if (rango(885, 885)) return "Tailandia";
  if (rango(890, 890)) return "India";
  if (rango(893, 893)) return "Vietnam";
  if (rango(955, 955)) return "Malasia";
  return undefined;
}

const UA = "easypos/1.0 (https://easypos.bo)";
const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Descarga la imagen de la fuente y la guarda local; devuelve su path o "". */
async function rehostImage(url: string | undefined): Promise<string> {
  if (!url || !/^https?:\/\//i.test(url)) return "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return "";
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 8 * 1024 * 1024) return "";
    const name = `bc-${Date.now()}-${randomBytes(5).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", "images");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);
    return `/images/${name}`;
  } catch {
    return "";
  }
}

// --- Fuentes -----------------------------------------------------------------

/** Open Food Facts: alimentos y bebidas. Gratis, sin API key. */
async function openFoodFacts(code: string): Promise<BarcodeInfo | null> {
  const data = (await getJson(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}` +
      `.json?fields=product_name,brands,categories,image_url`
  )) as {
    status?: number;
    product?: {
      product_name?: string;
      brands?: string;
      categories?: string;
      image_url?: string;
    };
  } | null;

  if (!data || data.status !== 1 || !data.product) return null;
  const p = data.product;
  const name = (p.product_name ?? "").trim();
  if (!name) return null;
  // De "Colas, Bebidas azucaradas" se toma la primera categoría, capitalizada.
  const category = (p.categories ?? "").split(",")[0].trim();
  return {
    found: true,
    name: titleCase(name),
    brand: (p.brands ?? "").split(",")[0].trim() || undefined,
    category: category ? titleCase(category) : undefined,
    image: p.image_url,
    source: "Open Food Facts",
  };
}

/** UPCitemdb (nivel de prueba, sin key): mercadería general. Rate-limited. */
async function upcItemDb(code: string): Promise<BarcodeInfo | null> {
  const data = (await getJson(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`
  )) as {
    code?: string;
    items?: Array<{
      title?: string;
      brand?: string;
      category?: string;
      description?: string;
      images?: string[];
    }>;
  } | null;

  const item = data?.code === "OK" ? data.items?.[0] : null;
  if (!item?.title) return null;
  // La categoría de upcitemdb viene como ruta "Electronics > Phones"; se toma
  // la última hoja, que es la más específica.
  const cat = (item.category ?? "").split(">").pop()?.trim();
  return {
    found: true,
    name: item.title.trim(),
    brand: item.brand?.trim() || undefined,
    category: cat || undefined,
    description: item.description?.trim() || undefined,
    image: item.images?.find((u) => /^https?:\/\//i.test(u)),
    source: "UPCitemdb",
  };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    .trim();
}

/**
 * Busca el código en todas las fuentes y devuelve el primer acierto, con la
 * imagen ya re-hospedada. Nunca tira: ante cualquier problema, `found: false`.
 */
export async function lookupBarcode(code: string): Promise<BarcodeInfo> {
  const clean = code.trim();
  if (!/^\d{6,14}$/.test(clean)) return { found: false };

  // Lo único que el NÚMERO codifica: el país de registro. Se calcula siempre,
  // así aunque ninguna base conozca el producto, el alta arranca con un dato.
  const country = gs1Country(clean);

  // Open Food Facts primero: sus datos de alimentos/bebidas son más limpios
  // (nombre, marca y categoría curados). UPCitemdb como respaldo para el resto
  // (electrónica, mercadería general), aunque su categoría a veces es ruido.
  const hit = (await openFoodFacts(clean)) ?? (await upcItemDb(clean));
  if (!hit) return { found: false, country };

  const image = await rehostImage(hit.image);
  return { ...hit, image: image || undefined, country };
}
