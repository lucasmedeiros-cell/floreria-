import { query } from "./db";
import { getRubro, type RubroId } from "./rubros";

/**
 * Ajusta el catálogo de la base de datos al cambiar de rubro.
 *
 * SIEMPRE: quita los productos de EJEMPLO del rubro anterior (los que conservan
 * su SKU de demo). Los que el negocio cargó tienen SKU propio y no se tocan.
 *
 * SOLO SI `loadDemo`: inserta el catálogo de ejemplo del rubro nuevo. Por
 * defecto NO se carga: una instalación de easy pos arranca con el catálogo
 * vacío y el negocio carga sus productos (o los trae el pareo).
 *
 * Los pedidos históricos no se rompen: order_items.product_id es
 * ON DELETE SET NULL y el nombre del ítem queda guardado en el pedido.
 */
export async function applyRubroCatalog(
  prevRubroId: RubroId,
  nextRubroId: RubroId,
  loadDemo = false
): Promise<{ removed: number; added: number }> {
  const prevSkus = getRubro(prevRubroId).catalog.map((p) => p.id);
  const next = loadDemo ? getRubro(nextRubroId).catalog : [];

  const removed =
    prevRubroId === nextRubroId || prevSkus.length === 0
      ? []
      : await query(`DELETE FROM products WHERE id = ANY($1::text[]) RETURNING id`, [
          prevSkus,
        ]);

  let added = 0;
  for (const [i, p] of next.entries()) {
    const rows = await query(
      `INSERT INTO products (id, name, description, price, image, category, featured, stock, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'activo')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        p.id,
        p.name,
        p.desc,
        p.price,
        p.image,
        p.category,
        !!p.featured,
        p.stock ?? 12 + ((i * 7) % 40),
      ]
    );
    added += rows.length;
  }

  return { removed: removed.length, added };
}
