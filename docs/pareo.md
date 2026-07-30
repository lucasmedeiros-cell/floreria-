# Pareo — un negocio, su web y su CRM

Antes, easy pos era **un negocio por instalación**: un deploy, una base, una tienda.
Ahora una sola instalación sirve a **muchos negocios**, cada uno con su web, su CRM y
su base de datos. El **pareo** es lo que conecta un dispositivo (o un navegador) con
*su* negocio: la central emite un
**token** por dispositivo, el token identifica al negocio, y con eso la app sabe a qué
comercio le está hablando.

## Las piezas

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Central | `bo_epos_central` (este repo, `db/central.sql`) | Registro de negocios (`negocio`), tokens (`dispositivo`), usuarios del panel y actividad. Es PROPIA de easy pos. |
| Base del negocio | `bo_epos_<slug>` | Sus productos, pedidos, clientes, empleados y ajustes. Una por comercio. |
| Panel de easy pos | `/panel` (este repo) | Da de alta el comercio, provisiona su base y entrega el **QR de pareo**. Ver `docs/PANEL-easypos.md`. |
| easy pos | este repo | Sirve la tienda (`/n/<slug>`), la landing (`/n/<slug>/promo`) y el CRM (`/n/<slug>/admin`) de cada negocio. |

Nada de esto se activa solo: **sin `CENTRAL_DATABASE_URL`, easy pos sigue funcionando
como antes** (un solo negocio, el de `DATABASE_URL`, en `/`, `/admin` y `/promo`).

## Alta de un comercio (desde el panel `/panel`)

1. *Nuevo negocio* → nombre, rubro, correo y contraseña del dueño.
2. El alta (`/api/provision`) crea la base `bo_epos_<slug>` con el esquema y los grants.
3. Registra el `negocio` en la central y, al vincular, un `dispositivo` con su token.
4. Llama a `POST /api/pair/bootstrap` de easy pos: aplica el rubro (colores, textos,
   categorías, landing), carga el catálogo de ejemplo y crea al dueño.
5. Muestra el **QR** `{url, token, slug, nombre, producto}` y el **link de pareo**
   (`/parear?token=…`), que es el equivalente para el navegador.

Desde ese momento el comercio ya tiene:

- **Tienda:** `https://…/n/<slug>`
- **Landing:** `https://…/n/<slug>/promo`
- **CRM web:** `https://…/n/<slug>/admin` (entra con el correo y la contraseña del dueño)

## Cómo se parea la app móvil (el CRM descargable)

Se escanea el QR y se guardan `url` + `token`.

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

**4. Reportar el dispositivo** (opcional, pero es lo que el panel muestra en la
ficha del negocio: última conexión, versión, plataforma):

```http
X-Device-Platform: android   X-Device-Model: SM-A032M
X-Device-OS: 13              X-App-Version: 1.0.3
X-Device-Name: Caja 1
```

## Pareo desde el navegador

`/parear` hace lo mismo sin cámara: se pega el token (o se abre el link
`/parear?token=…` que da el panel y se parea solo) y lleva al CRM del negocio. El token
queda guardado en ese navegador para volver a entrar.

## Cómo se parea el programa de PC (escritorio)

El programa de escritorio (`desktop/`) apunta por defecto a la nube
(`https://easypos.easypaybo.com`) y en el login tiene **"Vincular al negocio"**:
se pega el **código de 6 dígitos** (se canjea en `POST /api/devices/pair`) o el
**token** que muestra el panel junto al QR (se valida en `GET /api/pair/verify`).
El token queda en la config del programa y viaja como `X-Device-Token` en cada
request: el backend resuelve el negocio y trabaja contra SU base.

- Contra la nube el pareo es **obligatorio** (sin token no se puede entrar: el
  dominio atiende a muchos negocios).
- Contra un servidor local (`localhost` o IP de la red — el setup "todo en uno"
  de Coquito) no hace falta: esa instalación es de un solo negocio.
- "Desvincular" en el login borra el token para parear el equipo a otro negocio.

## La app móvil de producción (APK)

El APK compilado contra la nube se descarga de
**`https://easypos.easypaybo.com/descargas/easypos.apk`** (nginx lo sirve
directo del disco: `~/easypos/public/descargas/` en bilbo — Next no sirve
archivos agregados a `public/` después del build). Para recompilarlo:

```bash
cd mobile/admin_app
flutter build apk --release --dart-define=EASYPOS_API=https://easypos.easypaybo.com
scp -P 2202 build/app/outputs/flutter-apk/app-release.apk petrobox@bilbo:easypos/public/descargas/easypos.apk
```

Instalado el APK: pantalla de pareo → escanear el QR del panel (o tipear el
código de 6 dígitos) y el equipo queda en su negocio.

## Configuración

```bash
# easy pos
CENTRAL_DATABASE_URL=postgresql://…/bo_epos_central   # sin esto: un solo negocio (como antes)
DATABASE_URL=postgresql://…/easypos                   # base del modo un-solo-negocio
# Opcional: si las bases de los negocios están en otro servidor que la central.
# TENANT_DATABASE_URL_TEMPLATE=postgresql://user:pass@host:5432/{db}
```

easy pos abre un pool por negocio, contra `bo_epos_<slug>`. Por eso **necesita alcanzar
el Postgres** donde viven la central y las bases de los comercios.

## Migrar la flota

Con una base por negocio, una migración hay que correrla en **todas**. Después de agregar
un `db/migrations/*.sql`, y **antes** de desplegar el código que lo necesita:

```bash
CENTRAL_DATABASE_URL=… PGHOST=… PGUSER=… PGPASSWORD=… ./db/migrate-tenants.sh
```

Recorre los negocios de la central y les aplica `schema.sql` + las migraciones (son
idempotentes). Los comercios nuevos nacen del `db/schema.sql` de ESTE repo (el
alta del panel lo aplica tal cual), así que no hay ninguna copia externa que
mantener sincronizada.
