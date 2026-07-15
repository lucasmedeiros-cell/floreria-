-- ============================================================
--  easy pos — Datos iniciales (seed)
--  Instalación NUEVA: solo lo imprescindible para poder entrar al panel.
--  NO siembra negocio, productos, clientes ni pedidos: easy pos arranca vacío
--  y el negocio se configura (o se vincula) desde el CRM.
--  El catálogo de ejemplo de un rubro se carga desde
--  Configuración → Rubro del negocio, o con db/seed-floreria.sql.
--  Idempotente: usa ON CONFLICT para poder re-ejecutar.
-- ============================================================

-- ---------- Usuario inicial del CRM ----------
-- Cambiá la contraseña apenas entres (Usuarios → invitar / editar).
-- Sin target en el ON CONFLICT: el correo dejó de ser una constraint (ahora es
-- un índice único PARCIAL, para permitir cuentas sin correo), y esa forma no
-- sirve para inferir el conflicto. Sin target, cae por cualquier índice único.
INSERT INTO employees (name, email, pass_hash, role) VALUES
  ('Administrador', 'admin@easypos.bo', crypt('easypos1234', gen_salt('bf')), 'Administrador')
ON CONFLICT DO NOTHING;

-- ---------- Repartidores ----------
-- Solo el valor por defecto: los repartidores reales los carga el negocio.
INSERT INTO couriers (name) VALUES ('Sin asignar')
ON CONFLICT (name) DO NOTHING;
