-- ============================================================
--  Migración 015 — Dirección real de WhatsApp de cada charla.
--
--  WhatsApp ya no siempre identifica al cliente por su número: manda un LID
--  (`1234567890123@lid`), un identificador interno. Guardábamos ESE número como
--  si fuera el teléfono y le contestábamos a `<lid>@s.whatsapp.net`, que no
--  existe: el bot respondía y el mensaje se iba a la nada, sin error.
--
--  Acá queda el JID exacto al que hay que contestar, así la respuesta llega
--  aunque el proceso se haya reiniciado desde que entró el mensaje.
--  Idempotente: se puede re-ejecutar.
-- ============================================================

ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS jid text;
