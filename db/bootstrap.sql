-- ============================================================
--  Bootstrap: crea el rol y la base de datos.
--  Ejecutar UNA vez como superusuario del servidor Postgres:
--    psql -h <host> -p <port> -U <superuser> -d postgres -f db/bootstrap.sql
--  (En bilbo: el superusuario y su clave los provee el admin del servidor.)
-- ============================================================

-- Rol de la aplicación
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'petrobox') THEN
    CREATE ROLE petrobox LOGIN PASSWORD 'petrobox';
  END IF;
END $$;

-- Base de datos (CREATE DATABASE no admite IF NOT EXISTS; se ignora si ya existe)
SELECT 'CREATE DATABASE floreria OWNER petrobox'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'floreria')\gexec

GRANT ALL PRIVILEGES ON DATABASE floreria TO petrobox;
