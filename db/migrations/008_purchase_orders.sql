-- ============================================================
--  Pedidos a proveedor (reposición de stock)
-- ------------------------------------------------------------
--  Cuando en la tienda NO hay un repuesto, se registra un pedido a la
--  distribuidora para reponerlo. Al marcarlo RECIBIDO, sube el stock del
--  inventario de cada ítem que apunte a un producto del catálogo.
--  (Distinto de una VENTA, que baja el stock. Ver 007_sales.sql). Idempotente.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE purchase_status AS ENUM ('solicitado', 'recibido', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text        NOT NULL UNIQUE,        -- COM-000123
  supplier     text        NOT NULL DEFAULT '',
  status       purchase_status NOT NULL DEFAULT 'solicitado',
  notes        text        NOT NULL DEFAULT '',
  received_at  timestamptz,
  created_by   text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id  uuid        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id   text        REFERENCES products(id) ON DELETE SET NULL,
  sku          text        NOT NULL DEFAULT '',
  name         text        NOT NULL,
  qty          integer     NOT NULL DEFAULT 1,
  unit_cost    numeric(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS purchase_orders_created ON purchase_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_order_items_po ON purchase_order_items (purchase_id);
