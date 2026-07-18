-- ============================================================
--  Ajustes manuales de stock (Fase 2)
-- ------------------------------------------------------------
--  Registro de cada ajuste manual (merma, conteo físico, corrección) con su
--  motivo, para tener trazabilidad de por qué cambió el stock. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_moves (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  text        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta       int         NOT NULL,                 -- +/- unidades
  reason      text        NOT NULL DEFAULT '',
  stock_after int         NOT NULL DEFAULT 0,
  created_by  text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_moves_product_idx ON stock_moves (product_id, created_at DESC);
