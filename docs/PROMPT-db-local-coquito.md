# PROMPT — Programa de PC para "Auto Piezas Coquito" con base de datos local compartida

Copiá TODO lo de abajo como prompt para el asistente/herramienta que va a generar el programa de PC.

---

Necesito un programa de escritorio para Windows para la tienda de repuestos de vehículos **"Auto Piezas Coquito"**. El programa NO trabaja solo: comparte una base de datos PostgreSQL **local** (instalada en esta misma PC) con un sistema POS existente llamado **easy pos** (backend Next.js + app móvil Android). El teléfono del mostrador se conecta por WiFi al servidor easy pos que corre en esta PC, y ese servidor usa esta misma base. Todo lo que el programa de PC registre lo tiene que ver el teléfono, y viceversa.

## 1. Base de datos (instalar y configurar EXACTAMENTE así)

- Motor: **PostgreSQL 16** (o 15+), puerto **5432**, escuchando en `localhost` (la app móvil nunca toca Postgres directo; pasa por HTTP).
- Crear el rol y la base (UNA sola — el sistema corre en modo "un solo negocio", sin activaciones ni pareo):

```sql
CREATE ROLE easypos LOGIN PASSWORD 'Coquito.2026.local';
CREATE DATABASE bo_epos_coquito OWNER easypos;   -- LOS DATOS DE LA TIENDA (productos, ventas…)
```

- En `bo_epos_coquito` aplicar **entero y sin modificar** el esquema del archivo `db/schema.sql` del repo easy pos (lo paso junto con este prompt). Después:

```sql
INSERT INTO settings (key, value, updated_at) VALUES ('business',
  '{"name":"Auto Piezas Coquito","nameLight":"","rubroId":"repuestos","configured":true}'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now();
```

- Cadena de conexión que usa TANTO el programa de PC como easy pos:
  `postgresql://easypos:Coquito.2026.local@localhost:5432/bo_epos_coquito`

## 2. El servidor easy pos corre en esta misma PC (no lo generes vos, ya existe)

Node 20, puerto **3010**, con este `.env.local`:

```
DATABASE_URL=postgresql://easypos:Coquito.2026.local@localhost:5432/bo_epos_coquito
AUTH_SECRET=<cadena aleatoria larga>
```

El teléfono NO necesita vinculación ni activación: la app viene compilada apuntando al servidor y con abrirla + iniciar sesión ya funciona. Dejá la IP de la PC **fija** (reserva DHCP o IP estática) y abrí el puerto 3010 en el firewall de Windows para la red privada.

Crear el usuario administrador inicial (una sola vez, en `bo_epos_coquito`):

```sql
INSERT INTO employees (name, email, pass_hash, role)
VALUES ('Administrador', 'admin@coquito.local', crypt('coquito2026', gen_salt('bf')), 'Administrador');
```

## 3. Tablas que va a usar el programa de PC (las importantes de `bo_epos_coquito`)

| Tabla | Qué es | Columnas clave |
|---|---|---|
| `products` | catálogo | `id` (SKU, text, PK), `name`, `desc`, `price` (venta), `cost` (costo), `stock` (int, puede ser negativo si hay descuadre), `barcode` (único), `category`, `attributes` (jsonb: marca, modelo de vehículo, etc.), `status` |
| `sales` | ventas | `id` uuid, `code` (FAC-000001…), `kind` ('factura'\|'proforma'), `client_name`, `subtotal`, `discount`, `total` (numeric), `pay_method`, `voided` (anulada), `client_ref` (idempotencia), `created_at` |
| `sale_items` | detalle | `sale_id`, `product_id`, `name`, `qty`, `unit_price`, `discount_pct` |
| `expenses` | gastos | `category`, `description`, `amount`, `spent_at` |
| `cash_closes` | cortes de caja | totales por método, `counted_cash`, `difference` |
| `employees` | usuarios | `name`, `email`, `phone`, `pass_hash` (bcrypt vía `crypt(pass, gen_salt('bf'))`), `role` ('Administrador'\|'Vendedora'), `active` |
| `purchase_orders` / `purchase_order_items` | pedidos a proveedor | — |
| `stock_moves` | ajustes manuales de stock | `product_id`, `delta`, `reason`, `stock_after` |
| `settings` | config (key/value jsonb) | key `business` = nombre/rubro de la tienda |

## 4. REGLAS DE INTEGRACIÓN (obligatorias para no corromper los datos del POS)

**Opción recomendada: usar la API HTTP local (`http://localhost:3010`) en vez de SQL directo para las ESCRITURAS.** Autenticación: `POST /api/auth/employee/login` con `{"identifier": "<correo>", "pass": "<clave>"}` → devuelve `token`; mandarlo como header `Authorization: Bearer <token>`. Endpoints:

- `GET /api/products?q=&limit=&offset=` (lectura pública) · `POST /api/products` (alta) · `PATCH /api/products/{id}` (edición) · `POST /api/products/{id}/adjust` con `{delta, reason}` (ajuste de stock)
- `POST /api/sales` con `{kind:'factura', items:[{productId, name, qty, unitPrice}], payMethod, discountPct, clientRef}` — registra la venta Y descuenta stock en una sola transacción. `clientRef` = un id único tuyo; si reintentás con el mismo, NO se duplica.
- `GET /api/sales` · `GET /api/sales/{id}` · `PATCH /api/sales/{id}` con `{void:true}` (anular: devuelve stock)
- `GET/POST /api/expenses` · `GET/POST /api/cash` (arqueo/corte) · `GET /api/reports?days=N` (ventas, costo, gastos, ganancia)
- `GET/POST /api/employees`

**Si hacés SQL directo (solo si es imprescindible), respetá esto:**
1. Una venta = **una transacción**: insertar `sales` + sus `sale_items` + `UPDATE products SET stock = stock - qty` por ítem, todo o nada.
2. La numeración `code` se serializa con `pg_advisory_xact_lock(hashtext('sale_' || kind))` y `count(*)+1` con formato `FAC-000001` — copiá ese mecanismo o dejá que la venta la haga la API.
3. Montos en `numeric(12,2)`; nunca borres ventas: anulá con `voided = true` (+ devolver stock si era factura).
4. `products.id` es el SKU visible; no lo regeneres. `barcode` es único.
5. No toques `settings` salvo la key `business`, y no borres empleados: `active = false`.

## 5. Qué debe hacer el programa de PC (mínimo)

Pantallas: catálogo de productos con búsqueda e importación masiva (CSV/Excel → `POST /api/products` o INSERT), registro de venta (con descuento y método Efectivo/QR/Transferencia), historial y anulación, gastos, corte de caja, reportes (ventas, ganancia = ventas − costo vendido − gastos), gestión de usuarios. Estética: colores de easy pos — amarillo #FEBB03, tinta #201A17, fondo #F6F4F1 — y el nombre **Auto Piezas Coquito** visible.

---

## Notas para NOSOTROS (no van en el prompt)

- El servidor easy pos que hay que copiar a la PC es el mismo del gateway (`/home/petrobox/easypos`): Node 20 + `.next` compilado + `db/schema.sql`. Pasos completos en `docs/DEPLOY-easypos-bilbo.md` (misma receta, con `DATABASE_URL` a localhost, SIN central).
- Modo actual: **un solo negocio, sin pareo ni activación**. El gateway ya corre así (`DATABASE_URL` → `bo_epos_coquito`); el respaldo multi-tenant quedó en `/home/petrobox/easypos/.env.multitenant.bak` por si se vuelve.
- La app permite HTTP en claro de red local (network_security_config) y trae compilado el servidor (`EASYPOS_API`). Para apuntarla a la PC definitiva: recompilar con `--dart-define=EASYPOS_API=http://<ip-pc>:3010`.
- Login actual de prueba: admin `admin@coquito.local` / `coquito2026` (cambiar la clave).
