-- ============================================================
--  Migración 013 — Consumo de IA del Vendedor 24/7.
--  Una fila por llamada al modelo: tokens, caché y costo.
--  En modo PLAN (CLAUDE_CODE_OAUTH_TOKEN) el costo es el que
--  HABRÍA salido por API — sirve para medir cuánto rinde el plan
--  de la cuenta dedicada al vendedor.
--  Portado del bot de soporte (Jarvis, repo tickets).
--  Idempotente: se puede re-ejecutar sin romper.
-- ============================================================

CREATE TABLE IF NOT EXISTS ia_uso (
  id             bigserial PRIMARY KEY,
  modelo         text        NOT NULL DEFAULT '',  -- claude-haiku-4-5-20251001, etc.
  tipo           text        NOT NULL DEFAULT '',  -- 'responder' (a futuro: clasificar, contexto)
  input_tokens   integer     NOT NULL DEFAULT 0,
  output_tokens  integer     NOT NULL DEFAULT 0,
  cache_read     integer     NOT NULL DEFAULT 0,
  cache_creation integer     NOT NULL DEFAULT 0,
  costo_usd      numeric(12, 6) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_uso_fecha ON ia_uso(created_at);
