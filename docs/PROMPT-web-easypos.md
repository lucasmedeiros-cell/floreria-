# Prompt: CRM web de easy pos — paridad total con la app móvil + tiempo real

> Copiá todo lo de abajo y pasáselo al equipo/asistente que construye el web.

---

## Objetivo

Llevar el **CRM web de easy pos** a **paridad total** con la **app móvil** (Flutter):
las mismas pantallas, las mismas funciones y el **mismo diseño**. Todo lo que se ve
o se hace en el teléfono debe verse y poder hacerse en el web, y **los cambios deben
reflejarse en tiempo real en ambos sentidos** (web ↔ teléfono).

## Contexto técnico (importante)

- Es un **monorepo Next.js 14 (App Router)** multi-negocio. La app móvil y el CRM web
  **comparten EXACTAMENTE el mismo backend y la misma base de datos**, así que los
  datos ya son los mismos: no hay que duplicar lógica de negocio, solo consumir los
  endpoints que ya existen. El CRM web vive en el mismo repo (`components/admin/*`,
  `app/admin`, `app/n/[slug]`).
- **Multi-negocio:** cada request resuelve el negocio por la URL `/n/<slug>/…`
  (el middleware inyecta el negocio) o por el header `X-Device-Token` (móvil). El web
  trabaja en `/n/<slug>/admin` con la **sesión de empleado** (cookie).
- **No reinventar el backend.** Todos los endpoints ya están hechos (lista abajo);
  el web solo tiene que consumirlos y pintarlos.

## Autenticación (web)

- `POST /api/auth/employee/login { identifier, pass }` → setea cookie de sesión.
- `GET /api/auth/employee/me`, `POST /api/auth/employee/logout`.
- El pareo por QR / device token es **solo para el móvil**; el web entra por login.
- Roles: Administrador, Vendedora, Repartidor (la gestión de usuarios va por **Case**,
  no por el CRM del negocio — no incluir "Usuarios" ni "Clientes" en el web).

## Endpoints compartidos (ya existen — usar tal cual, todos bajo `/n/<slug>`)

- **Negocio:** `GET/POST /api/business` (rubro, nombre, nameLight, logoUrl, whatsapp,
  address, modules).
- **Productos:** `GET /api/products?q=&limit=&offset=&category=&status=&barcode=`
  (búsqueda multi-término que incluye atributos → compatibilidad de vehículo),
  `POST /api/products`, `PATCH /api/products/[id]`,
  `POST /api/products/[id]/adjust { delta, reason }` (ajuste manual de stock),
  `GET /api/products/barcode/[code]`.
- **Ventas:** `GET /api/sales?kind=`, `POST /api/sales` (kind factura|proforma,
  items[], clientName, payMethod, discountPct), `GET /api/sales/[id]` (detalle+ítems),
  `PATCH /api/sales/[id] { void:true }` (anular → devuelve stock si era factura).
- **Pedidos a proveedor:** `GET /api/purchase-orders`, `POST /api/purchase-orders`
  (supplier, notes, items[]), `PATCH /api/purchase-orders/[id] { status }`
  (al pasar a `recibido` sube el stock).
- **Caja (arqueo/corte):** `GET /api/cash` (resumen del turno por método),
  `POST /api/cash { countedCash, notes }` (cierra caja).
- **Reportes:** `GET /api/reports` → { totalVentas, numVentas, ticketPromedio,
  costoVendido, gastos, ganancia, stockBajo, totalProductos, porMetodo[],
  topProductos[], porMes[] }.
- **Gastos:** `GET /api/expenses`, `POST /api/expenses { amount, category, description, spentAt }`.
- **Pagos QR (BCP vía BaaS):** `POST /api/payments/qr { amount, gloss }` → { qrImage(dataURI),
  correlativo, qrId }; `POST /api/payments/status { correlativo, qrId }` → { pagado }.

## Pantallas a implementar (paridad con el móvil)

1. **Inicio (dashboard)** — saludo, tarjetas de vistazo (Productos, Stock bajo),
   tarjeta oscura "Pedidos a proveedor por recibir", botón "Ver productos", accesos
   rápidos (Vender, Productos, Pedir), campana con notificaciones.
2. **Ventas (POS)** — buscador server-side (nombre, SKU, marca, código, **vehículo**),
   botón **escanear código** (webcam/lector USB) que agrega al carrito, carrito con
   cantidades, **descuento total (Bs)**, cliente opcional, **Cobrar** eligiendo método
   **Efectivo** o **QR** (genera el QR del BCP, hace polling a `/payments/status` y
   registra al pagar). **Proforma** (PDF A4) / **Factura** (baja stock, **ticket 58 mm**).
   Accesos a **Historial** y **Corte de caja**.
3. **Historial de ventas** — lista, **reimprimir** (ticket 58 mm o PDF A4) y **anular**
   (la factura devuelve stock; las anuladas no cuentan en Reportes).
4. **Corte de caja** — total del turno por método (Efectivo/QR), arqueo del efectivo
   contado + diferencia, botón cerrar caja.
5. **Pedidos a proveedor** — lista con estados (Solicitado/Recibido/Cancelado), nuevo
   pedido (buscar inventario + agregar un repuesto que no está en el catálogo), botón
   **"Marcar recibido"** (sube stock).
6. **Productos** — lista **paginada** (miles de productos), búsqueda server-side,
   escanear, nuevo/editar (fotos, código de barras, SKU, nombre, categoría, **campos de
   rubro** —repuestos: marca / compatibilidad (marca-modelo-año) / OEM / posición—,
   precio, costo, stock), **ajuste manual de stock** (con motivo).
7. **Reportes** — KPIs (ventas, N.º ventas, ticket promedio, stock bajo), **ganancia
   real** (ventas − costo − gastos), ventas por mes (barras), productos más vendidos,
   ventas por método de pago, **exportar PDF**, acceso a **Gastos**.
8. **Gastos** — lista + total, nuevo gasto (monto, categoría, descripción).
9. **Configuración** — datos del negocio (nombre, WhatsApp, dirección) y **logo**
   (subir; se refleja en la marca). (Biometría es solo del móvil.)
10. **Agenda / Entregas** — solo si el módulo del rubro está activo (delivery).

## Diseño (idéntico a la app móvil)

Paleta easy pos (fija):
- Amarillo **#FEBB03** (accent), amarillo profundo **#E0A100** (accentDeep),
  amarillo claro **#FFC93C** (para gradientes).
- Tinta/negro **#201A17**, oscuro chrome **#17120F**, fondo **#F6F4F1**,
  superficie **#FFFFFF**, líneas **#E7E1DA**, texto secundario **#6B615B**.
- Éxito **#2EA66B**, error/anulado **#E0324E**, dorado **#B8924A**.

Componentes:
- **Header curvo amarillo** en cada pantalla: gradiente `#FFC93C → #FEBB03 → #F5A800`,
  **marca de agua** de llave + engranaje sutil, **borde inferior en onda**, botón
  circular oscuro a la izquierda (menú o atrás), **título** en tipografía serif bold
  oscura, y a la derecha **campana circular oscura con badge** (notificaciones) o una
  acción. La barra de estado va con íconos oscuros sobre el amarillo.
- **Tarjetas**: blancas, redondeadas ~20-22 px, sombra suave; **esquina de color**
  (arriba-izquierda), **ícono en círculo tintado**, número grande (serif), y **chevron
  circular** abajo a la derecha.
- **Tarjeta oscura** (gradiente casi negro) para destacados (ej. pedidos por recibir),
  con ícono en círculo amarillo y chevron con borde amarillo.
- **Botón principal**: gradiente amarillo, redondeado, con ícono + texto centrado +
  chevron, sombra amarilla.
- **Accesos rápidos**: tarjetas blancas con ícono en círculo suave, título, subtítulo y
  chevron circular con borde.
- Tipografía: **serif** para títulos y números; **sans** para el resto. Badges de estado,
  KPIs, y gráfico de barras amarillo para "ventas por mes".

## Sincronización en tiempo real (web ↔ móvil)

Como ambos clientes pegan al mismo backend/DB, los datos ya son compartidos; falta la
**entrega en vivo** de los cambios. Implementar así:

1. **Postgres `LISTEN/NOTIFY`**: en las escrituras (crear/anular venta, alta/edición/
   ajuste de producto, pedido a proveedor, gasto, cierre de caja) emitir
   `NOTIFY easypos_cambios, '<negocio_slug>:<entidad>'` (ej. `pg_notify('easypos_cambios', slug||':sales')`).
   Se puede disparar desde los endpoints (después del commit) o con triggers en las tablas.
2. **Endpoint SSE**: `GET /api/stream` (por negocio) que abre `text/event-stream`, hace
   `LISTEN easypos_cambios`, y reenvía a los clientes de ese negocio los eventos de su
   slug. (Runtime Node.js, no serverless; en Netlify usar un server aparte o un canal
   externo — ver nota.)
3. **Cliente web**: un `EventSource('/n/<slug>/api/stream')` que, al recibir un evento
   de una entidad (`sales`, `products`, `purchase_orders`, `expenses`, `cash`),
   **revalida/re-fetchea** esa vista (o invalida la query si usan React Query/SWR).
4. **La app móvil** hace lo mismo (se suscribe al SSE) para reflejar en el teléfono lo
   que se hace en el web. (Si el SSE no está disponible —serverless—, usar **polling**
   cada 5–10 s como respaldo: es la opción más simple y ya deja "casi en vivo".)

> Nota de deploy: si el backend corre en **Netlify (serverless)**, SSE con conexiones
> persistentes no es viable; en ese caso usar **polling** (5–10 s) o mover el backend a
> un server siempre-encendido (ver `docs/DEPLOY-easypos-bilbo.md`) donde SSE sí corre.

## Reglas / consideraciones

- **No agregar** al CRM web: vinculación de dispositivos (va por Case), Usuarios ni
  Clientes.
- Respetar el **module gating**: mostrar Agenda/Entregas solo si el rubro los tiene
  activos (`business.modules`).
- **Facturas** = comprobante interno simple (sin impuestos SIN). **Proformas** =
  cotización (no tocan stock).
- Formato de moneda: `Bs 0.00`.
- Todo bajo `/n/<slug>/…` para que resuelva el negocio correcto.
