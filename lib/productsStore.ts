import { query } from "./db";
import type { Product } from "./products";

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
    return await query<Product>(
      // `images` viaja también: la tienda y la landing muestran la galería
      // completa, no solo la foto principal.
      `SELECT id, name, description AS desc, price, image, images, category, featured, stock, status
         FROM products
        WHERE status = 'activo'
        ORDER BY created_at DESC`
    );
  } catch (error) {
    console.warn("[products] no se pudo leer el catálogo:", error);
    return [];
  }
}
