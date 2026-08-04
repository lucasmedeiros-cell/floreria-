-- ============================================================
--  Central PROPIA de easy pos: base `bo_epos_central`.
--
--  Reemplaza a la central de Case (`bo_case_central`): easy pos ya no comparte
--  registro con otros productos. Acá vive el padrón de negocios, los tokens de
--  pareo de los dispositivos, los usuarios del PANEL (equipo easy pos, no los
--  empleados de un negocio) y el historial de acciones del panel.
--
--  Crear la base (una vez, como superusuario o un rol con CREATEDB):
--    CREATE DATABASE bo_epos_central OWNER petrobox;
--  Aplicar este archivo (idempotente, se puede re-ejecutar):
--    psql -d bo_epos_central -f db/central.sql
--
--  Las columnas de `negocio` y `dispositivo` conservan los nombres que ya usa
--  el código (lib/tenant.ts, /api/provision): migrar fue cambiar de base, no
--  de contrato. Lo que era de Case (producto, plan_id, comision_qr, …) no está.
-- ============================================================

SET ROLE petrobox;

-- crypt()/gen_salt() para las contraseñas del panel; gen_random_uuid() para ids.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Negocios ----------
-- Un negocio = una base `bo_epos_<slug>` propia (db_name). El estado gobierna
-- el acceso: 'suspendido' y 'baja' no atienden ni web ni app (lib/tenant.ts).
CREATE TABLE IF NOT EXISTS negocio (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre     text NOT NULL,
  slug       text NOT NULL UNIQUE,
  db_name    text NOT NULL UNIQUE,
  rubro      text,
  nit        text,
  telefono   text,
  email      text,
  direccion  text,
  ciudad     text,
  estado     varchar(16) NOT NULL DEFAULT 'activo'
             CHECK (estado IN ('prueba', 'activo', 'suspendido', 'baja')),
  -- Cobro con QR: % de comisión de easy pos sobre lo recaudado por QR, y a qué
  -- cuenta caen los pagos. 'empresa' = todo entra a la cuenta easy pos (0564) y
  -- se le paga el neto al comercio; 'comercio' = entra a la cuenta del comercio
  -- y se le cobra la comisión. Base de la liquidación (Gestión de QR/Comisiones).
  comision_qr numeric(5,2) NOT NULL DEFAULT 0,
  cuenta_qr   varchar(8)  NOT NULL DEFAULT 'empresa'
              CHECK (cuenta_qr IN ('empresa', 'comercio')),
  fecha_alta timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negocio_estado ON negocio (estado);

-- ---------- Dispositivos pareados ----------
-- Cada fila es una app móvil vinculada por QR o código. El token es la llave
-- con la que la app se presenta en cada request; `habilitado = false` la corta
-- al instante. Los campos de metadata los reporta la propia app (touchDevice).
CREATE TABLE IF NOT EXISTS dispositivo (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  negocio_id  text NOT NULL REFERENCES negocio(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  label       text,
  habilitado  boolean NOT NULL DEFAULT true,
  last_seen   timestamptz,
  fecha_alta  timestamptz NOT NULL DEFAULT now(),
  plataforma  text,
  modelo      text,
  os_version  text,
  app_version text,
  device_name text,
  ultimo_ip   text,
  -- Código corto (4 dígitos) para parear a mano cuando no se puede escanear el
  -- QR. De un solo uso y con vencimiento: al canjearse se limpia. El QR sigue
  -- llevando el token completo (más seguro); esto es el atajo tipeable.
  pair_code     text,
  pair_code_exp timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dispositivo_negocio ON dispositivo (negocio_id);
-- Búsqueda del código corto vigente (parcial: solo filas con código sin vencer).
CREATE INDEX IF NOT EXISTS idx_dispositivo_paircode ON dispositivo (pair_code)
  WHERE pair_code IS NOT NULL;

-- ---------- Números de WhatsApp (Cloud API de Meta) ----------
-- Un negocio puede tener uno o dos números; cada número atiende a UN negocio.
-- Vive en la central y no en la base del negocio porque el webhook de Meta llega
-- sin saber de quién es: hay que resolver el negocio ANTES de abrir su base
-- (lib/tenant.ts → waNumeroByPhoneId, lib/whatsappCloud.ts → processWebhook).
--
-- `phone_number_id` es el ID que da Meta a NUESTRO número (el que recibe), y es
-- lo que viene en `value.metadata.phone_number_id` de cada evento del webhook.
--
-- `token` normalmente va NULL: todos los números cuelgan de la misma app de easy
-- pos y usan META_WA_TOKEN del entorno. Se llena solo si un negocio trae su
-- propia cuenta de Meta.
CREATE TABLE IF NOT EXISTS wa_numero (
  phone_number_id text PRIMARY KEY,
  negocio_id      text NOT NULL REFERENCES negocio(id) ON DELETE CASCADE,
  numero          text,                    -- +591..., solo para mostrarlo
  etiqueta        text,                    -- 'Ventas', 'Pedidos', …
  token           text,                    -- NULL = usa META_WA_TOKEN del entorno
  activo          boolean NOT NULL DEFAULT true,
  fecha_alta      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_numero_negocio ON wa_numero (negocio_id);

-- ---------- Usuarios del panel ----------
-- El equipo que administra easy pos (alta de negocios, suspensiones, pareo).
-- NO confundir con `employees` de cada negocio: esto es la puerta del panel.
CREATE TABLE IF NOT EXISTS usuario (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre     text NOT NULL,
  email      text NOT NULL,
  pass_hash  text NOT NULL,           -- crypt(clave, gen_salt('bf'))
  rol        varchar(16) NOT NULL DEFAULT 'admin',
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS usuario_email_unico ON usuario (lower(email));

-- ---------- Actividad del panel ----------
-- Quién hizo qué: alta de negocio, cambio de estado, pareo, bloqueo, etc.
-- `negocio_id` sin FK a propósito: el historial sobrevive si el negocio se borra.
CREATE TABLE IF NOT EXISTS actividad (
  id         bigserial PRIMARY KEY,
  usuario    text,                    -- email del usuario del panel, o 'clave-api'
  negocio_id text,
  accion     text NOT NULL,
  detalle    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actividad_fecha   ON actividad (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actividad_negocio ON actividad (negocio_id, created_at DESC);

RESET ROLE;
