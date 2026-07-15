import { query } from "./db";
import type { Product } from "./products";

/**
 * Catálogo desde el servidor (SSR). Se pasa al StoreProvider como estado
 * inicial para que la tienda pinte los productos en el primer render (sin
 * parpadeo ni catálogo vacío en el HTML) y no solo tras el fetch del cliente.
 */
export async function readProducts(): Promise<Product[]> {
  try {
    return await query<Product>(
      `SELECT id, name, description AS desc, price, image, category, featured, stock, status
         FROM products
        ORDER BY created_at DESC`
    );
  } catch (error) {
    console.warn("[products] no se pudo leer el catálogo:", error);
    return [];
  }
}
