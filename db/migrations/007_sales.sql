-- ============================================================
--  Ventas (POS) + proformas y facturas
-- ------------------------------------------------------------
--  Una VENTA es cuando el cliente se lleva un producto que HAY en stock.
--    · tipo 'factura'  → venta real: BAJA el stock del inventario.
--    · tipo 'proforma' → cotización: NO toca el stock (es un presupuesto).
--  El comprobante (proforma/factura) es interno y simple (sin impuestos SIN).
--  Idempotente.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE sale_kind AS ENUM ('proforma', 'factura');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS sales (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text        NOT NULL UNIQUE,        -- FAC-000123 / PRO-000123
  kind         sale_kind   NOT NULL DEFAULT 'factura',
  client_name  text        NOT NULL DEFAULT 'Consumidor final',
  client_phone text        NOT NULL DEFAULT '',
  client_nit   text        NOT NULL DEFAULT '',    -- NIT/CI opcional del cliente
  subtotal     numeric(12,2) NOT NULL DEFAULT 0,
  discount     numeric(12,2) NOT NULL DEFAULT 0,   -- descuento total en Bs
  total        numeric(12,2) NOT NULL DEFAULT 0,
  pay_method   text        NOT NULL DEFAULT 'Efectivo',
  notes        text        NOT NULL DEFAULT '',
  created_by   text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      uuid        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   text        REFERENCES products(id) ON DELETE SET NULL,
  sku          text        NOT NULL DEFAULT '',
  name         text        NOT NULL,
  qty          integer     NOT NULL DEFAULT 1,
  unit_price   numeric(12,2) NOT NULL DEFAULT 0,
  discount_pct numeric(5,2)  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sales_created_at ON sales (created_at DESC);
CREATE INDEX IF NOT EXISTS sale_items_sale ON sale_items (sale_id);
