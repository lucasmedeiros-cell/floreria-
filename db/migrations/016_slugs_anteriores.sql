-- ============================================================
--  Migración 016 (CENTRAL) — Historial de direcciones de un negocio.
--
--  Al renombrar un negocio, su dirección pública (`/n/<slug>`) pasa a seguir al
--  nombre nuevo. El problema es lo ya compartido: las landings mandadas por
--  WhatsApp, el QR impreso, lo que el cliente guardó en favoritos — todo eso
--  apunta a la dirección vieja y quedaría en 404.
--
--  Acá se guardan las direcciones anteriores. `negocioBySlug` también busca en
--  esta lista, así que los enlaces viejos siguen entrando y se redirigen solos a
--  la nueva. Idempotente.
--
--  OJO: el nombre de la BASE (`db_name`) NO cambia nunca. Es interno, no lo ve
--  nadie, y renombrarlo exigiría cerrar todas las conexiones abiertas.
-- ============================================================

ALTER TABLE negocio ADD COLUMN IF NOT EXISTS slugs_anteriores text[] NOT NULL DEFAULT '{}';

-- Búsqueda por dirección vieja: sin índice, cada visita recorrería la tabla.
CREATE INDEX IF NOT EXISTS idx_negocio_slugs_anteriores
  ON negocio USING gin (slugs_anteriores);
