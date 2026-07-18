-- ============================================================
--  Varias imágenes por producto
-- ------------------------------------------------------------
--  Antes cada producto tenía UNA imagen (columna `image`). Ahora puede tener
--  varias (`images`, un arreglo de URLs). `image` se mantiene como la principal
--  (la primera del arreglo) para no romper la tienda ni la app, que la leen.
--  Idempotente.
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

-- Backfill: los productos que ya tenían una imagen suelta pasan a tenerla como
-- primer (y único) elemento del arreglo.
UPDATE products
   SET images = ARRAY[image]
 WHERE image <> '' AND (images IS NULL OR array_length(images, 1) IS NULL);
