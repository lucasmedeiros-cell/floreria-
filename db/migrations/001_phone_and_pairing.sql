-- ============================================================
--  Login por teléfono + pareo de dispositivos por código
-- ------------------------------------------------------------
--  Idempotente: se puede correr varias veces. Ya está incluida en schema.sql
--  para instalaciones nuevas; este archivo la aplica a una base existente.
--    PGPASSWORD=... psql -h host -U user -d <base> -f db/migrations/001_phone_and_pairing.sql
-- ============================================================

-- ---------- Empleados: teléfono como identidad principal ----------
-- El alta desde la app es por teléfono + contraseña; el correo pasa a opcional.
-- Las cuentas viejas (solo correo) siguen entrando por correo: por eso el
-- teléfono es NULLable y el correo deja de ser NOT NULL.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;

-- Único, pero solo entre los que tienen teléfono (varios NULL conviven).
CREATE UNIQUE INDEX IF NOT EXISTS employees_phone_key
  ON employees (phone) WHERE phone IS NOT NULL;

-- ---------- Pareo de dispositivos ----------
-- El CRM emite un código de 6 dígitos, de un solo uso y con vencimiento. La app
-- lo canjea por un token de dispositivo (48 hex) que después manda en cada
-- request (X-Device-Token). El código NO se guarda en claro: se guarda su hash,
-- igual que una contraseña, porque quien lea la base no debe poder parear.
CREATE TABLE IF NOT EXISTS device_pairing (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Fase 1 — código pendiente de canje.
  code_hash   text        NOT NULL,           -- crypt(codigo, gen_salt('bf'))
  expires_at  timestamptz NOT NULL,           -- vencimiento del CÓDIGO (~15 min)
  attempts    int         NOT NULL DEFAULT 0, -- canjes fallidos; corta la fuerza bruta
  created_by  uuid REFERENCES employees(id) ON DELETE SET NULL,

  -- Fase 2 — ya canjeado: el dispositivo vinculado.
  token       text UNIQUE,                    -- token de sesión del dispositivo
  paired_at   timestamptz,
  revoked     boolean     NOT NULL DEFAULT false,

  -- Lo que reporta la app (headers X-Device-*), para la ficha del dispositivo.
  platform    text,
  model       text,
  os_version  text,
  app_version text,
  device_name text,
  last_seen   timestamptz,
  last_ip     text,

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Canje: se busca por código vigente sin canjear. Índice parcial para que esa
-- búsqueda no recorra los dispositivos ya pareados.
CREATE INDEX IF NOT EXISTS device_pairing_pending
  ON device_pairing (expires_at) WHERE token IS NULL AND NOT revoked;

-- Autenticación de cada request de la app: por token.
CREATE INDEX IF NOT EXISTS device_pairing_token
  ON device_pairing (token) WHERE token IS NOT NULL;
