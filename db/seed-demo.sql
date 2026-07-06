-- ============================================================
--  Datos DEMO para poblar el dashboard (CRM + COMANDER).
--  Genera pedidos repartidos en hoy / semana / mes / año y gastos,
--  para que ventas, gastos, ganancias y ranking de ramos muestren
--  números realistas.
--
--  Idempotente: borra los datos demo previos (created_by = 'Demo')
--  antes de reinsertar, así se puede re-ejecutar sin duplicar.
--
--  Uso:  psql "$DATABASE_URL" -f db/seed-demo.sql
-- ============================================================

DO $$
DECLARE
  v   record;
  oid uuid;
  i   int := 0;
BEGIN
  -- Limpieza de datos demo previos (order_items cae por CASCADE)
  DELETE FROM orders   WHERE created_by = 'Demo';
  DELETE FROM expenses WHERE created_by = 'Demo';

  FOR v IN
    SELECT * FROM (VALUES
      -- days_ago, cliente, canal, método pago, estado
      (0,   'Ana Torres',       'web', 'QR / Transferencia', 'entregado'),
      (0,   'Luis Vaca',        'crm', 'Efectivo',           'entregado'),
      (0,   'Sofía Áñez',       'web', 'QR / Transferencia', 'programado'),
      (1,   'Marta Gil',        'web', 'Tarjeta',            'entregado'),
      (2,   'Jorge Suárez',     'crm', 'Efectivo',           'entregado'),
      (3,   'Elena Rojas',      'web', 'QR / Transferencia', 'entregado'),
      (4,   'Pedro Camacho',    'crm', 'Efectivo',           'entregado'),
      (5,   'Lucía Méndez',     'web', 'QR / Transferencia', 'entregado'),
      (9,   'Diego Ferrufino',  'web', 'Tarjeta',            'entregado'),
      (14,  'Carla Justiniano', 'crm', 'Efectivo',           'entregado'),
      (20,  'Raúl Peña',        'web', 'QR / Transferencia', 'entregado'),
      (33,  'Nadia Vargas',     'web', 'Efectivo',           'entregado'),
      (55,  'Iván Rivero',      'crm', 'Tarjeta',            'entregado'),
      (80,  'Gabriela Soliz',   'web', 'QR / Transferencia', 'entregado'),
      (110, 'Mario Áñez',       'web', 'Efectivo',           'entregado'),
      (140, 'Valeria Cuéllar',  'crm', 'QR / Transferencia', 'entregado'),
      (165, 'Rodrigo Landívar', 'web', 'Tarjeta',            'entregado')
    ) AS t(days_ago, cname, chan, pay, st)
  LOOP
    i := i + 1;
    INSERT INTO orders (code, client_name, phone, address, location,
                        delivery_date, delivery_time, status, pay_method,
                        channel, created_by, created_at)
    VALUES ('PED-' || nextval('order_code_seq'), v.cname, '700' || (10000 + i),
            'Av. Demo #' || i, 'Santa Cruz',
            current_date - v.days_ago, '15:00', v.st::order_status, v.pay,
            v.chan, 'Demo', now() - (v.days_ago || ' days')::interval)
    RETURNING id INTO oid;

    -- 1 producto aleatorio del catálogo
    INSERT INTO order_items (order_id, product_id, name, qty, unit_price)
    SELECT oid, p.id, p.name, 1 + (random() * 2)::int, p.price
    FROM products p ORDER BY random() LIMIT 1;

    -- producto "estrella" (Rosas Rojas Premium) en ~80% de los pedidos,
    -- para que el ranking de ramos tenga un claro más vendido
    IF i % 5 <> 0 THEN
      INSERT INTO order_items (order_id, product_id, name, qty, unit_price)
      SELECT oid, p.id, p.name, 1, p.price
      FROM products p WHERE p.id = 'R206';
    END IF;
  END LOOP;

  -- Gastos / egresos demo (para que "ganancia = ventas - gastos")
  INSERT INTO expenses (category, description, amount, spent_at, created_by) VALUES
    ('Flores',     'Compra de rosas y follaje',  1200, current_date,        'Demo'),
    ('Insumos',    'Papel, cintas y bases',       350, current_date - 1,    'Demo'),
    ('Transporte', 'Combustible reparto',         180, current_date - 2,    'Demo'),
    ('Flores',     'Peonías importadas',         1500, current_date - 4,    'Demo'),
    ('Sueldos',    'Adelanto a vendedora',       1000, current_date - 6,    'Demo'),
    ('Flores',     'Girasoles y tulipanes',       600, current_date - 12,   'Demo'),
    ('Marketing',  'Publicidad en redes',         400, current_date - 25,   'Demo'),
    ('Insumos',    'Floreros de cristal',         800, current_date - 50,   'Demo'),
    ('Alquiler',   'Local (mensual)',            2500, current_date - 90,   'Demo'),
    ('Flores',     'Compra mayorista',           1800, current_date - 130,  'Demo');
END $$;
