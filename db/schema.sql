-- ============================================================
--  FloresOnline — Esquema de base de datos (PostgreSQL)
--  Cubre la tienda web y el CRM/panel de gestión.
--  Idempotente: se puede re-ejecutar sin romper.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), crypt(), gen_salt()

-- ---------- Tipos ----------
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM
    ('borrador', 'programado', 'enCamino', 'entregado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('activo', 'inactivo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Secuencia para el código de pedido (PED-1044, PED-1045, ...)
CREATE SEQUENCE IF NOT EXISTS order_code_seq START 1044;

-- ---------- Empleados (login del CRM / panel /admin) ----------
CREATE TABLE IF NOT EXISTS employees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  email       text        NOT NULL UNIQUE,
  pass_hash   text        NOT NULL,
  role        text        NOT NULL DEFAULT 'Vendedora',
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Cuentas de cliente (login de la tienda web) ----------
CREATE TABLE IF NOT EXISTS customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  email       text        NOT NULL UNIQUE,
  phone       text        NOT NULL DEFAULT '',
  pass_hash   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Clientes / libreta de direcciones del CRM ----------
CREATE TABLE IF NOT EXISTS clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  phone       text        NOT NULL DEFAULT '',
  address     text        NOT NULL DEFAULT '',
  reference   text        NOT NULL DEFAULT '',
  location    text        NOT NULL DEFAULT '',
  notes       text        NOT NULL DEFAULT '',
  -- vínculo opcional con una cuenta de la tienda
  customer_id uuid        REFERENCES customers(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Repartidores ----------
CREATE TABLE IF NOT EXISTS couriers (
  id     serial PRIMARY KEY,
  name   text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);

-- ---------- Productos (catálogo) ----------
CREATE TABLE IF NOT EXISTS products (
  id          text PRIMARY KEY,             -- SKU / código (R208)
  name        text           NOT NULL,
  description text           NOT NULL DEFAULT '',
  price       integer        NOT NULL DEFAULT 0,   -- Bs (enteros)
  image       text           NOT NULL DEFAULT '',
  category    text           NOT NULL,
  featured    boolean        NOT NULL DEFAULT false,
  stock       integer        NOT NULL DEFAULT 0,
  status      product_status NOT NULL DEFAULT 'activo',
  created_at  timestamptz    NOT NULL DEFAULT now(),
  updated_at  timestamptz    NOT NULL DEFAULT now()
);

-- ---------- Ajustes del sitio (clave → JSON) ----------
-- Config editable desde el panel (p. ej. la landing promocional /promo
-- o el Vendedor 24/7 con key = 'vendedor247').
CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Vendedor 24/7 (bot de WhatsApp con IA) ----------
-- Conversaciones entrantes de WhatsApp (una por número) + su historial, para
-- que el asistente de ventas (Claude) tenga contexto. Ver db/migrations/002.
CREATE TABLE IF NOT EXISTS wa_conversations (
  phone           text PRIMARY KEY,
  name            text        NOT NULL DEFAULT '',
  bot_active      boolean     NOT NULL DEFAULT true,
  campaign        text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wa_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text        NOT NULL REFERENCES wa_conversations(phone) ON DELETE CASCADE,
  direction  text        NOT NULL DEFAULT 'in',
  body       text        NOT NULL DEFAULT '',
  from_bot   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON wa_messages(phone, created_at);

-- ---------- Pedidos ----------
CREATE TABLE IF NOT EXISTS orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text        NOT NULL UNIQUE,
  client_id     uuid        REFERENCES clients(id) ON DELETE SET NULL,
  customer_id   uuid        REFERENCES customers(id) ON DELETE SET NULL,
  client_name   text        NOT NULL,
  phone         text        NOT NULL DEFAULT '',
  address       text        NOT NULL DEFAULT '',
  reference     text        NOT NULL DEFAULT '',
  location      text        NOT NULL DEFAULT '',
  client_notes  text        NOT NULL DEFAULT '',
  delivery_date date        NOT NULL,
  delivery_time text        NOT NULL DEFAULT '15:00',
  priority      text        NOT NULL DEFAULT 'Media',
  courier       text        NOT NULL DEFAULT 'Sin asignar',
  status        order_status NOT NULL DEFAULT 'programado',
  pay_method    text        NOT NULL DEFAULT 'Efectivo',
  needs_receipt boolean     NOT NULL DEFAULT false,
  delivery_cost numeric(10,2) NOT NULL DEFAULT 0,
  delivery_obs  text        NOT NULL DEFAULT '',
  order_notes   text        NOT NULL DEFAULT '',
  channel       text        NOT NULL DEFAULT 'crm',  -- 'crm' | 'web'
  created_by    text        NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- Gastos / egresos del negocio ----------
-- Necesario para calcular ganancias reales (ingresos - gastos) y el
-- dashboard central COMANDER. Ver db/migrations/001_expenses.sql.
CREATE TABLE IF NOT EXISTS expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text          NOT NULL DEFAULT 'General',
  description text          NOT NULL DEFAULT '',
  amount      numeric(10,2) NOT NULL DEFAULT 0,
  spent_at    date          NOT NULL DEFAULT current_date,
  created_by  text          NOT NULL DEFAULT '',
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- ---------- Ítems del pedido ----------
CREATE TABLE IF NOT EXISTS order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   text          REFERENCES products(id) ON DELETE SET NULL,
  name         text          NOT NULL,
  detail       text          NOT NULL DEFAULT '',
  qty          integer       NOT NULL DEFAULT 1,
  unit_price   numeric(10,2) NOT NULL DEFAULT 0,
  discount_pct numeric(5,2)  NOT NULL DEFAULT 0,
  image        text
);

-- ---------- Índices ----------
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category);
CREATE INDEX IF NOT EXISTS idx_expenses_spent_at    ON expenses(spent_at DESC);

-- ---------- Vistas de apoyo ----------
-- Totales calculados por pedido
CREATE OR REPLACE VIEW order_totals AS
SELECT
  o.id,
  o.code,
  COALESCE(SUM(i.qty * i.unit_price), 0)                                AS subtotal,
  COALESCE(SUM(i.qty * i.unit_price * (i.discount_pct / 100)), 0)       AS discount,
  o.delivery_cost,
  COALESCE(SUM(i.qty * i.unit_price * (1 - i.discount_pct / 100)), 0)
    + o.delivery_cost                                                   AS total,
  COALESCE(SUM(i.qty), 0)                                               AS item_count
FROM orders o
LEFT JOIN order_items i ON i.order_id = o.id
GROUP BY o.id;

-- Estadísticas por cliente (para el CRM)
CREATE OR REPLACE VIEW client_stats AS
SELECT
  c.id,
  c.name,
  COUNT(o.id)                                        AS orders_count,
  COALESCE(SUM(t.total), 0)                          AS total_spent,
  MAX(o.delivery_date)                               AS last_order
FROM clients c
LEFT JOIN orders o        ON o.client_id = c.id
LEFT JOIN order_totals t  ON t.id = o.id
GROUP BY c.id;
