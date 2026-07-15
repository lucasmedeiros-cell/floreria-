-- ============================================================
--  Bootstrap de easy pos: crea el rol y la base de datos.
--  Ejecutar UNA vez como SUPERUSUARIO del servidor Postgres:
--    psql -h <host> -p <port> -U postgres -d postgres -f db/bootstrap.sql
--  (Local: sudo -u postgres psql -f db/bootstrap.sql)
--
--  Deja la base `easypos` con dueño `petrobox`, que es el usuario con el que
--  se conecta la app. Que sea el DUEÑO importa: si las tablas quedan de otro
--  rol, las migraciones (ALTER TABLE) fallan con "must be owner of table".
-- ============================================================

-- Rol de la aplicación
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'petrobox') THEN
    CREATE ROLE petrobox LOGIN PASSWORD 'petrobox';
  END IF;
END $$;

-- Base de datos (CREATE DATABASE no admite IF NOT EXISTS; se ignora si ya existe)
SELECT 'CREATE DATABASE easypos OWNER petrobox'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'easypos')\gexec

GRANT ALL PRIVILEGES ON DATABASE easypos TO petrobox;
