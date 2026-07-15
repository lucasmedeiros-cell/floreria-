# Pareo — un negocio, su web y su CRM

Antes, easy pos era **un negocio por instalación**: un deploy, una base, una tienda.
Ahora una sola instalación sirve a **muchos negocios**, cada uno con su web, su CRM y
su base de datos. El **pareo** es lo que conecta un dispositivo (o un navegador) con
*su* negocio, y es la misma idea que ya usa Case con el POS: la central emite un
**token** por dispositivo, el token identifica al negocio, y con eso la app sabe a qué
comercio le está hablando.

## Las piezas

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Central | `bo_sole_central` (repo `case`) | Registro de negocios (`negocio`) y de tokens (`dispositivo`). Es de Case; easy pos solo la lee. |
| Base del negocio | `bo_epos_<slug>` | Sus productos, pedidos, clientes, empleados y ajustes. Una por comercio. |
| Panel de Case | `case.easypaybo.com` | Da de alta el comercio, provisiona su base y entrega el **QR de pareo**. |
| easy pos | este repo | Sirve la tienda (`/n/<slug>`), la landing (`/n/<slug>/promo`) y el CRM (`/n/<slug>/admin`) de cada negocio. |

Nada de esto se activa solo: **sin `CENTRAL_DATABASE_URL`, easy pos sigue funcionando
como antes** (un solo negocio, el de `DATABASE_URL`, en `/`, `/admin` y `/promo`).

## Alta de un comercio (desde el panel de Case)

1. *Activar comercio* → producto **easy pos**, nombre, rubro, correo y contraseña del dueño.
2. El panel corre `provision_easypos.sh`, que crea la base `bo_epos_<slug>` con el esquema.
3. Registra el `negocio` (con `producto='easypos'`) y un `dispositivo` con su token.
4. Llama a `POST /api/pair/bootstrap` de easy pos: aplica el rubro (colores, textos,
   categorías, landing), carga el catálogo de ejemplo y crea al dueño.
5. Muestra el **QR** `{url, token, slug, nombre, producto}` y el **link de pareo**
   (`/parear?token=…`), que es el equivalente para el navegador.

Desde ese momento el comercio ya tiene:

- **Tienda:** `https://…/n/<slug>`
- **Landing:** `https://…/n/<slug>/promo`
- **CRM web:** `https://…/n/<slug>/admin` (entra con el correo y la contraseña del dueño)

## Cómo se parea la app móvil (el CRM descargable)

Igual que la app de Case: se escanea el QR y se guardan `url` + `token`.

```jsonc
// Contenido del QR
{
  "url": "https://easypos.easypaybo.com/n/floreria_rosa",  // base de ESTE negocio
  "token": "e52dedba…",                                     // token del dispositivo
  "slug": "floreria_rosa",
  "nombre": "Florería Rosa",
  "producto": "easypos"
}
```

**1. Verificar el pareo** (confirmar que el token sirve y que la URL está viva; si esto
falla, deshacer el pareo y no quedar pegado a un comercio que no existe):

```http
GET {url}/api/pair/verify
X-Device-Token: {token}
```

```jsonc
// 200
{
  "negocio": { "id": "…", "nombre": "Florería Rosa", "slug": "floreria_rosa", "rubro": "floreria", "estado": "activo" },
  "marca":   { "nombre": "Florería Rosa", "rubro": "floreria", "colores": { "accent": "#E8366B", … }, "whatsapp": "…" },
  "api": "https://…/n/floreria_rosa/api",
  "web": "https://…/n/floreria_rosa",
  "crm": "https://…/n/floreria_rosa/admin"
}
```

| Código | Qué pasó | Qué hacer en la app |
|---|---|---|
| `401` | Token desconocido, borrado o dispositivo bloqueado | Borrar el pareo y volver a la pantalla de escaneo |
| `403` | El comercio está suspendido | Avisar; no borrar el pareo |
| `404` | Ese negocio no existe | Borrar el pareo |

**2. Hablar con la API del negocio.** Todas las rutas cuelgan de `{url}/api/…` y llevan
el token en cada llamada:

```http
GET  {url}/api/products
POST {url}/api/orders
X-Device-Token: {token}
```

El token dice **de qué negocio** es la request; el servidor resuelve su base y responde
solo con datos de ese comercio. (También se acepta `Authorization: Bearer <token>` si el
token es el de pareo, pero conviene usar `X-Device-Token` y dejar `Authorization` para la
sesión del empleado.)

**3. Login del empleado.** El pareo conecta el equipo con el negocio; **no** es una
credencial de acceso. Para entrar al CRM hace falta iniciar sesión:

```http
POST {url}/api/auth/employee/login   →   { "token": "<sesión>", "name": …, "role": … }
X-Device-Token: {token}
{ "email": "rosa@floreria.bo", "pass": "…" }
```

Después, cada llamada del CRM lleva **las dos cosas**:

```http
X-Device-Token: {token del pareo}      ← qué negocio
Authorization: Bearer {token de sesión} ← quién es
```

La sesión queda atada al negocio donde se hizo el login: usarla contra otro comercio no
funciona (devuelve 401), aunque la firma sea válida.

**4. Reportar el dispositivo** (opcional, pero es lo que el panel de Case muestra en la
ficha del comercio: última conexión, versión, plataforma):

```http
X-Device-Platform: android   X-Device-Model: SM-A032M
X-Device-OS: 13              X-App-Version: 1.0.3
X-Device-Name: Caja 1
```

## Pareo desde el navegador

`/parear` hace lo mismo sin cámara: se pega el token (o se abre el link
`/parear?token=…` que da el panel y se parea solo) y lleva al CRM del negocio. El token
queda guardado en ese navegador para volver a entrar.

## Configuración

```bash
# easy pos
CENTRAL_DATABASE_URL=postgresql://…/bo_sole_central   # sin esto: un solo negocio (como antes)
DATABASE_URL=postgresql://…/easypos                   # base del modo un-solo-negocio
# Opcional: si las bases de los negocios están en otro servidor que la central.
# TENANT_DATABASE_URL_TEMPLATE=postgresql://user:pass@host:5432/{db}
```

easy pos abre un pool por negocio, contra `bo_epos_<slug>`. Por eso **necesita alcanzar
el Postgres** donde viven la central y las bases de los comercios: no alcanza con que
llegue al panel de Case.

## Migrar la flota

Con una base por negocio, una migración hay que correrla en **todas**. Después de agregar
un `db/migrations/*.sql`, y **antes** de desplegar el código que lo necesita:

```bash
CENTRAL_DATABASE_URL=… PGHOST=… PGUSER=… PGPASSWORD=… ./db/migrate-tenants.sh
```

Recorre los negocios de la central y les aplica `schema.sql` + las migraciones (son
idempotentes). El esquema con el que nacen los comercios nuevos es
`provision/sql/easypos_v1.sql` **en el repo de Case**: si cambia el esquema de easy pos,
hay que actualizar esa copia también, o los comercios nuevos nacen viejos.
