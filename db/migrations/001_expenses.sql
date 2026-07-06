-- ============================================================
--  Migración 001 — Tabla de gastos (egresos) del negocio.
--  Necesaria para calcular ganancias reales (ingresos - gastos)
--  y alimentar el dashboard central COMANDER.
--  Idempotente: se puede re-ejecutar sin romper.
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text          NOT NULL DEFAULT 'General',   -- Insumos, Flores, Transporte, Sueldos, ...
  description text          NOT NULL DEFAULT '',
  amount      numeric(10,2) NOT NULL DEFAULT 0,           -- Bs
  spent_at    date          NOT NULL DEFAULT current_date,
  created_by  text          NOT NULL DEFAULT '',
  created_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_spent_at ON expenses(spent_at DESC);
