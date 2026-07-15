-- ============================================================
--  Datos de EJEMPLO de la florería (catálogo, clientes y pedidos).
--  NO se aplica por defecto: easy pos arranca vacío (ver db/seed.sql).
--  Úsalo solo para tener una demo cargada:
--    psql ... -f db/seed-floreria.sql
--  Recuerda poner el rubro "Florería" en Configuración → Rubro del negocio.
-- ============================================================

-- ---------- Productos ----------
INSERT INTO products (id, name, description, price, image, category, featured, stock) VALUES
  ('R208','Jardinera Premium','Peonías, rosas y eucalipto en jardinera de autor.',1850,'/images/r208.jpg','Ramos',true,18),
  ('R211','Peonías de Lujo','Peonías magenta de tallo largo, frescura premium.',1200,'/images/r211.jpg','Ramos',false,25),
  ('R209','Tulipanes Holandeses','Tulipanes de temporada, color vibrante y frescos.',540,'/images/r209.jpg','Ramos',false,32),
  ('R206','Rosas Rojas Premium','Rosas rojas y protea en composición editorial.',950,'/images/r206.jpg','Rosas',true,15),
  ('R204','Mensaje de Amor','Rosa roja de tallo largo para decir te amo.',600,'/images/r204.jpg','Rosas',false,40),
  ('R210','Rosa Eterna','Rosa rosada en florero de cristal soplado.',520,'/images/r210.jpg','Rosas',false,22),
  ('R207','Jardín Exótico Mix','Rosas multicolor, una explosión de color única.',1100,'/images/r207.jpg','Exóticas',true,12),
  ('R205','Calas Naturalistas','Calas rosadas de líneas puras y elegantes.',850,'/images/r205.jpg','Exóticas',false,20),
  ('R201','Lirio Estelar','Lirio rosado de pétalos amplios y perfumados.',465,'/images/r201.jpg','Exóticas',false,28),
  ('R212','Girasoles Radiantes','Girasol gigante que ilumina cualquier espacio.',480,'/images/r212.jpg','Girasoles',false,35),
  ('R203','Campo de Girasoles','Brazada de girasoles frescos recién cortados.',420,'/images/r203.jpg','Girasoles',false,30),
  ('R202','Flores de Campo','Flores silvestres amarillas, estilo campestre.',400,'/images/r202.jpg','Girasoles',false,26)
ON CONFLICT (id) DO NOTHING;

-- ---------- Clientes (libreta del CRM) ----------
INSERT INTO clients (name, phone, address, reference, location, notes) VALUES
  ('María Fernández','777 123 456','Av. Las Palmas #123, Zona Norte, Santa Cruz','Frente a la plaza principal','-17.7833, -63.1821','Cliente prefiere entregas en la tarde.'),
  ('Carlos Rojas','712 000 111','Calle Beni #45, Equipetrol','Edificio azul, piso 3','-17.7690, -63.1920',''),
  ('Lucía Vargas','700 222 333','Av. Alemana #900','Timbre no funciona, llamar al llegar','-17.7745, -63.1780','Suele pedir para cumpleaños.')
ON CONFLICT DO NOTHING;

-- ---------- Pedidos demo (con ítems) ----------
DO $$
DECLARE
  ana   text := 'Ana Gómez';
  o_id  uuid;
  c_id  uuid;
BEGIN
  -- Solo sembrar si no hay pedidos aún.
  IF (SELECT count(*) FROM orders) > 0 THEN RETURN; END IF;

  -- PED-1043 · María Fernández · programado
  SELECT id INTO c_id FROM clients WHERE name = 'María Fernández' LIMIT 1;
  INSERT INTO orders (code, client_id, client_name, phone, address, reference, location,
                      delivery_date, delivery_time, priority, courier, status, pay_method,
                      needs_receipt, delivery_cost, delivery_obs, order_notes, created_by, created_at)
  VALUES ('PED-1043', c_id, 'María Fernández', '777 123 456', 'Av. Las Palmas #123, Zona Norte',
          'Frente a la plaza principal', '-17.7833, -63.1821', DATE '2026-07-01', '15:00', 'Media',
          'Luis Rodríguez', 'programado', 'Efectivo', true, 20, 'Tocar timbre y esperar confirmación.',
          'Llamar antes de entregar.', ana, TIMESTAMPTZ '2026-06-30 10:30')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, name, detail, qty, unit_price, discount_pct, image) VALUES
    (o_id, 'R206', 'Rosas Rojas Premium', 'Docena', 1, 150, 0, '/images/r206.jpg'),
    (o_id, NULL,   'Tarjeta personalizada', 'Con dedicatoria', 1, 15, 0, NULL);

  -- PED-1042 · Lucía Vargas · en camino
  SELECT id INTO c_id FROM clients WHERE name = 'Lucía Vargas' LIMIT 1;
  INSERT INTO orders (code, client_id, client_name, phone, address, reference,
                      delivery_date, delivery_time, priority, courier, status, pay_method,
                      delivery_cost, created_by, created_at)
  VALUES ('PED-1042', c_id, 'Lucía Vargas', '700 222 333', 'Av. Alemana #900',
          'Timbre no funciona, llamar', DATE '2026-07-02', '11:30', 'Alta', 'Pedro Gutiérrez',
          'enCamino', 'QR / Transferencia', 25, ana, TIMESTAMPTZ '2026-06-29 09:15')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, name, detail, qty, unit_price, discount_pct, image) VALUES
    (o_id, 'R208', 'Jardinera Premium', 'Peonías y rosas', 1, 1850, 0, '/images/r208.jpg');

  -- PED-1041 · Carlos Rojas · entregado
  SELECT id INTO c_id FROM clients WHERE name = 'Carlos Rojas' LIMIT 1;
  INSERT INTO orders (code, client_id, client_name, phone, address,
                      delivery_date, delivery_time, priority, courier, status, pay_method,
                      delivery_cost, created_by, created_at)
  VALUES ('PED-1041', c_id, 'Carlos Rojas', '712 000 111', 'Calle Beni #45, Equipetrol',
          DATE '2026-06-28', '17:00', 'Baja', 'Carla Méndez', 'entregado', 'Tarjeta',
          20, ana, TIMESTAMPTZ '2026-06-27 16:40')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, name, detail, qty, unit_price, discount_pct, image) VALUES
    (o_id, 'R212', 'Girasoles Radiantes', 'Brazada', 2, 240, 10, '/images/r212.jpg');
END $$;
