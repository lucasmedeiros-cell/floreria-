import { query, queryOne } from "./db";
import { parsePhotoRef, photoRef, productPhotos, type Product } from "./products";
import { currentTenant } from "./tenant";

/** Prefijo del negocio en las URLs (`/n/<slug>`), o "" en instalación única. */
export function negocioBase(): string {
  const slug = currentTenant()?.negocio.slug;
  return slug ? `/n/${slug}` : "";
}

/**
 * Cambia las fotos embebidas (data URI) por su URL servida
 * (`/api/products/<sku>/image/<n>`, ver esa ruta). Lo que ya es una ruta o una
 * URL queda igual.
 *
 * Es lo que hace que la tienda y la landing pesen KB en vez de megabytes: el
 * HTML lleva enlaces y el navegador se guarda las fotos en su caché.
 */
export function withPhotoRefs<
  T extends { id: string; image?: string | null; images?: string[] | null },
>(p: T, base = negocioBase()): T {
  const fotos = [
    ...(p.image ? [p.image] : []),
    ...((p.images ?? []).filter((u) => u && u !== p.image) as string[]),
  ];
  const refs = fotos.map((foto, i) => (foto.startsWith("data:") ? photoRef(p.id, i, base) : foto));
  return { ...p, image: refs[0] ?? "", images: refs };
}

/**
 * Traduce las referencias `/api/products/<sku>/image/<n>` de vuelta a la foto
 * guardada.
 *
 * Hace falta al guardar: el primer pintado del CRM usa el catálogo público (con
 * las fotos por enlace), así que un guardado hecho en ese instante escribiría el
 * enlace en lugar de la imagen — la foto quedaría apuntando a sí misma y se
 * perdería. Lo que no es una referencia pasa tal cual.
 */
export async function resolvePhotoRefs(values: string[]): Promise<string[]> {
  const cache = new Map<string, string[]>();
  const out: string[] = [];

  for (const v of values) {
    const ref = parsePhotoRef(v);
    if (!ref) {
      out.push(v);
      continue;
    }
    if (!cache.has(ref.id)) {
      const row = await queryOne<{ image: string | null; images: string[] | null }>(
        `SELECT image, images FROM products WHERE id = $1`,
        [ref.id]
      );
      cache.set(
        ref.id,
        row ? productPhotos({ image: row.image ?? "", images: row.images ?? [] }) : []
      );
    }
    const real = cache.get(ref.id)![ref.index];
    if (real) out.push(real);
  }
  return out;
}

/**
 * Catálogo desde el servidor (SSR). Se pasa al StoreProvider como estado
 * inicial para que la tienda pinte los productos en el primer render (sin
 * parpadeo ni catálogo vacío en el HTML) y no solo tras el fetch del cliente.
 *
 * Solo los ACTIVOS: este HTML lo recibe cualquier visitante, y un producto
 * inactivo no se vende (además, con fotos subidas cada uno pesa lo suyo). El
 * CRM no se queda corto: al montar relee `/api/products`, que con sesión de
 * empleado devuelve también los inactivos.
 */
export async function readProducts(): Promise<Product[]> {
  try {
    const base = negocioBase();
    const rows = await query<Product>(
      // `images` viaja también: la tienda y la landing muestran la galería
      // completa, no solo la foto principal.
      `SELECT id, name, description AS desc, price, image, images, category, featured, stock, status
         FROM products
        WHERE status = 'activo'
        ORDER BY created_at DESC`
    );
    return rows.map((p) => withPhotoRefs(p, base));
  } catch (error) {
    console.warn("[products] no se pudo leer el catálogo:", error);
    return [];
  }
}
