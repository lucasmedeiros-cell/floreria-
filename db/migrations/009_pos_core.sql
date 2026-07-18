-- ============================================================
--  Núcleo POS (Fase 1): anulación de ventas + corte de caja
-- ------------------------------------------------------------
--  · sales.voided        → una factura anulada deja de contar y devuelve stock.
--  · cash_closes         → arqueo/corte de caja: foto de lo vendido en el turno,
--                          efectivo contado y diferencia.
--  Idempotente.
-- ============================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS voided boolean NOT NULL DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS voided_at timestamptz;

CREATE TABLE IF NOT EXISTS cash_closes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_at        timestamptz NOT NULL,               -- desde el corte anterior
  closed_at      timestamptz NOT NULL DEFAULT now(),
  num_ventas     int         NOT NULL DEFAULT 0,
  total_ventas   numeric(12,2) NOT NULL DEFAULT 0,
  total_efectivo numeric(12,2) NOT NULL DEFAULT 0,
  total_qr       numeric(12,2) NOT NULL DEFAULT 0,
  total_otros    numeric(12,2) NOT NULL DEFAULT 0,
  counted_cash   numeric(12,2) NOT NULL DEFAULT 0,   -- efectivo contado en caja
  difference     numeric(12,2) NOT NULL DEFAULT 0,   -- contado - efectivo esperado
  created_by     text        NOT NULL DEFAULT '',
  notes          text        NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS cash_closes_closed_at_idx ON cash_closes (closed_at DESC);
