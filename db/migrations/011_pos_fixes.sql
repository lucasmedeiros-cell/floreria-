-- 011: arreglos del ciclo POS detectados en la auditoría.
--
-- a) `sales.client_ref`: clave de idempotencia que manda la app. Si el POST
--    original hizo timeout pero el servidor sí procesó la venta, el reintento
--    de la cola offline trae el mismo ref y el backend devuelve la existente
--    en vez de duplicar la venta.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS sales_client_ref_key
  ON sales (client_ref) WHERE client_ref IS NOT NULL AND client_ref <> '';

-- b) Renombrar el SKU (products.id) de un producto con historial fallaba con
--    violación de FK: las referencias no seguían el cambio. ON UPDATE CASCADE
--    hace que ventas, pedidos, compras y movimientos acompañen el rename.
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_product_id_fkey;
ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE stock_moves DROP CONSTRAINT IF EXISTS stock_moves_product_id_fkey;
ALTER TABLE stock_moves ADD CONSTRAINT stock_moves_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE;
