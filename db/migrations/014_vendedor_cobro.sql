-- ============================================================
--  Migración 014 — Cobro del Vendedor 24/7 de punta a punta.
--
--  El bot manda el QR del banco, pero el pedido no guardaba NADA del cobro, así
--  que no había con qué preguntarle al banco si ya pagaron. Sin eso, la venta y
--  el descuento de stock quedaban siempre a mano.
--
--  Con estas columnas el pedido recuerda su QR y el confirmador puede cerrar el
--  ciclo: consulta el estado, y cuando está pagado crea la venta y descuenta.
--  Idempotente: se puede re-ejecutar.
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_correlativo text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_id          text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_amount      numeric(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_sent_at     timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at        timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_reference text;
-- La venta generada al confirmarse el pago (sales.id). Sin FK a propósito: si se
-- anula la venta, el pedido conserva el rastro de que se había cobrado.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_id        uuid;

-- Lo que busca el confirmador: pedidos con QR mandado y todavía sin pagar.
CREATE INDEX IF NOT EXISTS idx_orders_cobro_pendiente
  ON orders (qr_sent_at)
  WHERE qr_correlativo IS NOT NULL AND paid_at IS NULL;
