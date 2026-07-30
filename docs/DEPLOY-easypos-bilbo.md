# Desplegar el backend real de easy pos en bilbo

Guía para poner la app **easy pos** (Next.js: app móvil + panel + API) en
producción, en el servidor **bilbo** (el mismo de `easypaybo.com`), bajo el
subdominio **`easypos.easypaybo.com`**, en **modo multi-negocio** con la
**central propia** de easy pos (`bo_epos_central`) y su panel (`/panel`).

> Corré estos pasos **en bilbo** salvo donde se indique. Reemplazá los
> `<PLACEHOLDERS>`. Cada paso dice si es de una sola vez o repetible.

---

## 0. Cómo encaja todo (leer una vez)

- **El panel de easy pos** (`/panel` de esta misma app) — ahí se **crean y
  activan** los negocios. El registro vive en la base PROPIA
  **`bo_epos_central`** (tablas `negocio`, `dispositivo`, `usuario`,
  `actividad`; esquema en `db/central.sql`). Ver `docs/PANEL-easypos.md`.
  Case ya NO participa: `bo_case_central` quedó como registro muerto y no se lee.
- **Cada negocio** tiene su propia base: `bo_epos_<slug>`
  (ej. `bo_epos_multipartes`). Ahí viven sus productos, ventas, empleados, etc.
- **Esta app** (lo que desplegamos) corre en **modo multi-negocio**: lee
  `CENTRAL_DATABASE_URL` para resolver a qué negocio pertenece cada pedido (por
  el slug de la URL `/n/<slug>` o por el token del dispositivo) y trabaja contra
  la base de ese negocio.

Resultado: creás un negocio en `/panel` → queda disponible en
`easypos.easypaybo.com/n/<slug>`, y la app móvil se vincula por QR/código.

---

## 1. DNS — crear el subdominio (una vez, donde administrás el DNS de easypaybo.com)

Agregá un registro **A**:

```
easypos.easypaybo.com.   A   173.212.251.72
```

(`173.212.251.72` es la IP pública de bilbo, la misma de `case.easypaybo.com`.)

Verificá que propagó (desde cualquier máquina):

```bash
getent hosts easypos.easypaybo.com     # debe devolver 173.212.251.72
```

---

## 2. Traer el código a bilbo

El código con todos los cambios (Inicio, Ventas, Pedidos a proveedor, logo,
Usuarios, QR de pareo) tiene que estar en bilbo. Vía git:

```bash
# En tu máquina: commitear y pushear la rama (si aún no está en el remoto).
#   git add -A && git commit -m "easy pos: ventas, pedidos, inicio, config, usuarios"
#   git push origin main

# En bilbo:
sudo mkdir -p /opt/easypos && sudo chown "$USER" /opt/easypos
git clone git@github.com:lucasmedeiros-cell/floreria-.git /opt/easypos   # primera vez
# (o, si ya existe:  cd /opt/easypos && git pull)
cd /opt/easypos
```

Requisito: **Node 18+** (probado con 20). Verificá con `node -v`.

```bash
npm ci          # instala dependencias exactas (usa package-lock.json)
```

---

## 3. Variables de entorno de producción

Creá `/opt/easypos/.env.production` (la app en bilbo llega a Postgres por
`localhost`):

```ini
# --- Modo multi-negocio: central PROPIA de easy pos ---
CENTRAL_DATABASE_URL=postgresql://petrobox:<DBPASS>@localhost:5432/bo_epos_central
# Bases de cada negocio (mismo Postgres). {db} se reemplaza por bo_epos_<slug>.
TENANT_DATABASE_URL_TEMPLATE=postgresql://petrobox:<DBPASS>@localhost:5432/{db}
# Clave opcional para usar /api/provision por script (el panel usa su login):
# PROVISION_KEY=<una-clave-larga>

# Postgres local, sin SSL.
PGSSL=false

# Secreto de sesión: GENERÁ UNO PROPIO y NO lo cambies después
# (cambiarlo desloguea a todos). Generalo con:  openssl rand -hex 32
AUTH_SECRET=<PONER_UN_SECRETO_LARGO_Y_UNICO>

NODE_ENV=production

# --- Opcionales (copiá de tu .env.local si los usás) ---
# Pagos QR (BaaS BCP), bot WhatsApp, Tickets, etc.
# BAAS_BASE_URL=...
# ANTHROPIC_API_KEY=...
```

> **Rol de base de datos:** la app usa el rol **`petrobox`**, que es dueño de
> `bo_epos_central` y necesita `CREATEDB` (el alta de negocios del panel crea
> las bases `bo_epos_<slug>`; en bilbo ya lo tiene desde el 2026-07-22).
> `<DBPASS>` es la contraseña del rol `petrobox` en bilbo.
>
> **Autenticación local:** la app corre en bilbo y conecta por `localhost`, así
> que el `pg_hba.conf` de bilbo tiene que permitir a `petrobox` conectarse local
> (línea `host all petrobox 127.0.0.1/32 md5`, o `local all petrobox md5`).
> Probalo antes de seguir:
> `PGPASSWORD=<DBPASS> psql -h localhost -U petrobox -d bo_case_central -c '\dt'`

---

## 4. Dejar la app corriendo (systemd, se reinicia sola)

Compilá y creá el servicio:

```bash
cd /opt/easypos
npm run build       # build de producción de Next
```

Creá `/etc/systemd/system/easypos.service`:

```ini
[Unit]
Description=easy pos (Next.js) — backend multi-negocio
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/easypos
EnvironmentFile=/opt/easypos/.env.production
# Puerto interno; nginx lo expone en 443. Cambialo si el 3005 está ocupado.
ExecStart=/usr/bin/npm run start -- -p 3005
Restart=always
RestartSec=3
User=<USUARIO_DE_SERVICIO>

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now easypos
sudo systemctl status easypos          # debe quedar "active (running)"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3005/api/business   # 200 (o 401)
```

---

## 5. nginx + HTTPS (exponer el subdominio)

Creá `/etc/nginx/sites-available/easypos.easypaybo.com`:

```nginx
server {
    listen 80;
    server_name easypos.easypaybo.com;

    location / {
        proxy_pass         http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        client_max_body_size 12m;   # subida de fotos/logo
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/easypos.easypaybo.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Certificado HTTPS (Let's Encrypt). Requiere que el DNS del paso 1 ya resuelva.
sudo certbot --nginx -d easypos.easypaybo.com
```

Verificá desde afuera:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://easypos.easypaybo.com/api/business
```

---

## 6. Esquema de las bases de negocio

- Las **2 bases existentes** (`bo_epos_multipartes`, `bo_epos_prueba_easy`) **ya
  quedaron migradas** con las tablas nuevas (`sales`, `sale_items`,
  `purchase_orders`, `purchase_order_items`). Nada que hacer.
- Para **negocios que actives de ahora en más**: el alta del panel (`/panel` →
  Nuevo negocio) crea la base con `db/schema.sql` completo y los grants del rol
  `petrobox` incluidos. No hay nada manual que hacer.

Para re-aplicar las migraciones a TODAS las bases `bo_epos_*` cuando haga falta:

```bash
cd /opt/easypos
for db in $(psql "postgresql://<DBUSER>:<DBPASS>@localhost/postgres" -tAc \
    "SELECT datname FROM pg_database WHERE datname LIKE 'bo_epos_%'"); do
  echo "→ $db"
  psql "postgresql://<DBUSER>:<DBPASS>@localhost/$db" -f db/migrations/007_sales.sql
  psql "postgresql://<DBUSER>:<DBPASS>@localhost/$db" -f db/migrations/008_purchase_orders.sql
done
```

---

## 7. Apuntar la app móvil al dominio

Una vez que `https://easypos.easypaybo.com` responde, hay que recompilar la app
apuntando ahí (esto lo hago yo). Es un solo cambio:

```bash
flutter build apk --release --dart-define=EASYPOS_API=https://easypos.easypaybo.com
```

Con eso:
- El **QR de pareo** que muestra el panel de cada negocio ya lleva el servidor
  correcto → escaneás y la app queda conectada al negocio.
- El **código a mano** también funciona (la API busca el código en todos los
  negocios activos).

---

## 8. Prueba de humo (fin a fin)

1. En `easypos.easypaybo.com/panel`, entrá y elegí un negocio (o usá
   `multipartes`), o creá uno nuevo.
2. Generá el QR de pareo desde la ficha del negocio en el panel (o desde su CRM:
   `…/n/multipartes` → Configuración → Vincular dispositivo).
3. En el teléfono (con internet, **sin** cable): abrí easy pos, escaneá el QR.
4. Entrá con un empleado del negocio, hacé una venta (baja stock) y un pedido a
   proveedor (al recibir, sube stock).

Si todo eso anda, el backend real está funcionando y ya no depende de tu PC.

---

## Checklist rápido

- [ ] DNS `easypos.easypaybo.com` → 173.212.251.72
- [ ] Código en `/opt/easypos` + `npm ci` + `npm run build`
- [ ] Central propia `bo_epos_central` creada y migrada desde Case (hecho el
      2026-07-22; re-correr `db/migrar-central-desde-case.sh` justo antes del
      cambio de env, por si hubo pareos nuevos)
- [ ] `.env.production` con `CENTRAL_DATABASE_URL` → `bo_epos_central` y `TENANT_DATABASE_URL_TEMPLATE`
- [ ] `easypos.service` activo
- [ ] nginx vhost + certbot (HTTPS)
- [ ] (hecho) migraciones en las bases `bo_epos_*` existentes
- [ ] app recompilada con `EASYPOS_API=https://easypos.easypaybo.com`
- [ ] prueba de humo OK
