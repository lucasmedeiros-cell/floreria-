-- 012: permisos por empleado (los asigna el Administrador desde la app).
--
-- `perms` es un JSON de banderas. Hoy: {"products": true} = puede registrar y
-- editar productos del inventario. El Administrador siempre puede todo; una
-- Vendedora SIN la bandera solo vende (no toca el catálogo).
ALTER TABLE employees ADD COLUMN IF NOT EXISTS perms jsonb NOT NULL DEFAULT '{}';
