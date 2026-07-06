-- ============================================================
--  Migración 002 — Vendedor 24/7 (bot de WhatsApp con IA).
--  Guarda las conversaciones entrantes de WhatsApp para que el
--  asistente de ventas (Claude) tenga contexto e historial.
--  La configuración del bot vive en la tabla `settings`
--  (key = 'vendedor247'), igual que la landing promocional.
--  Idempotente: se puede re-ejecutar sin romper.
-- ============================================================

-- Una conversación por número de WhatsApp.
CREATE TABLE IF NOT EXISTS wa_conversations (
  phone           text PRIMARY KEY,                 -- +59170000000
  name            text        NOT NULL DEFAULT '',  -- nombre del perfil de WhatsApp
  bot_active      boolean     NOT NULL DEFAULT true, -- false = un humano tomó el control
  campaign        text,                             -- anuncio Meta (click-to-WhatsApp), si aplica
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Historial de mensajes de cada conversación.
CREATE TABLE IF NOT EXISTS wa_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text        NOT NULL REFERENCES wa_conversations(phone) ON DELETE CASCADE,
  direction  text        NOT NULL DEFAULT 'in',   -- 'in' (cliente) | 'out' (tienda/bot)
  body       text        NOT NULL DEFAULT '',
  from_bot   boolean     NOT NULL DEFAULT false,  -- true = respuesta generada por la IA
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON wa_messages(phone, created_at);
