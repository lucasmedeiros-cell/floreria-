-- ============================================================
--  Productos: código de barras y costo
-- ------------------------------------------------------------
--  barcode: el código FÍSICO del producto (EAN-13, UPC-A, Code128…), el que
--  trae impreso el envase. Es distinto del SKU (`products.id`), que es el código
--  interno del negocio: un repuesto viene con su EAN de fábrica y el negocio le
--  pone además su propio SKU. Por eso va en su propia columna.
--
--  cost: precio de COSTO en Bs (lo que le cuesta al negocio). `price` es el de
--  venta. Se carga al ingresar mercadería.
--
--  Idempotente: se puede re-ejecutar.
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text    NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost    integer NOT NULL DEFAULT 0;

-- Un código de barras identifica un solo producto. Los vacíos no compiten entre
-- sí (índice parcial): muchos productos pueden no tener código.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
  ON products (barcode)
  WHERE barcode <> '';
