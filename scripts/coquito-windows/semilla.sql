-- Semilla inicial de "Auto Piezas Coquito" (idempotente: re-ejecutar no rompe).
-- Se aplica DESPUES de db/schema.sql, sobre la base bo_epos_coquito.

-- Config del negocio: nombre y rubro. El resto (colores, textos, categorias)
-- sale del preset del rubro "repuestos".
INSERT INTO settings (key, value, updated_at) VALUES ('business',
  '{"name":"Auto Piezas Coquito","nameLight":"","rubroId":"repuestos","configured":true}'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now();

-- Usuario administrador inicial (solo si no existe).
INSERT INTO employees (name, email, pass_hash, role)
SELECT 'Administrador', 'admin@coquito.local',
       crypt('Coquito-Wd3sV5A3', gen_salt('bf', 10)), 'Administrador'
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE lower(email) = 'admin@coquito.local'
);
