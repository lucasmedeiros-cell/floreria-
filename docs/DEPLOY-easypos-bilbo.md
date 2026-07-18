# Desplegar el backend real de easy pos en bilbo

Guía para poner la app **easy pos** (Next.js: app móvil + panel + API) en
producción, en el servidor **bilbo** (el mismo de `easypaybo.com`), bajo el
subdominio **`easypos.easypaybo.com`**, en **modo multi-negocio** conectado a la
central de Case.

> Corré estos pasos **en bilbo** salvo donde se indique. Reemplazá los
> `<PLACEHOLDERS>`. Cada paso dice si es de una sola vez o repetible.

---

## 0. Cómo encaja todo (leer una vez)

- **Case** (`case.easypaybo.com`) — panel central. Ahí se **activan** los
  negocios de easy pos. Guarda el registro en la base **`bo_case_central`**
  (tablas `negocio`, `dispositivo`). **No se toca.**
- **Cada negocio** tiene su propia base: `bo_epos_<slug>`
  (ej. `bo_epos_multipartes`). Ahí viven sus productos, ventas, empleados, etc.
- **Esta app** (lo que desplegamos) corre en **modo multi-negocio**: lee
  `CENTRAL_DATABASE_URL` para resolver a qué negocio pertenece cada pedido (por
  el slug de la URL `/n/<slug>` o por el token del dispositivo) y trabaja contra
  la base de ese negocio.

Resultado: activás un negocio en Case → queda disponible en
`easypos.easypaybo.com`, y la app móvil se vincula por QR/código.

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
# --- Modo multi-negocio: central de Case ---
CENTRAL_DATABASE_URL=postgresql://petrobox:<DBPASS>@localhost:5432/bo_case_central
# Bases de cada negocio (mismo Postgres). {db} se reemplaza por bo_epos_<slug>.
TENANT_DATABASE_URL_TEMPLATE=postgresql://petrobox:<DBPASS>@localhost:5432/{db}

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

> **Rol de base de datos:** la app usa el rol **`petrobox`**. Ya le di los
> permisos (SELECT/INSERT/UPDATE/DELETE + secuencias + default privileges) sobre
> `bo_case_central`, `bo_epos_multipartes` y `bo_epos_prueba_easy`. `<DBPASS>` es
> la contraseña del rol `petrobox` en bilbo.
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
- Para **negocios que actives de ahora en más**: el `db/schema.sql` de este repo
  ya incluye esas tablas, así que si Case aprovisiona la base nueva con
  `schema.sql`, quedan listas. Si Case usa otra plantilla, hay que agregarle las
  migraciones `db/migrations/007_sales.sql` y `008_purchase_orders.sql` (son
  idempotentes).
- **Permisos del rol en negocios nuevos:** cada base `bo_epos_*` nueva necesita
  los grants a `petrobox` (los de las existentes ya están hechos). Corré, como
  superusuario, contra la base nueva:

  ```sql
  GRANT USAGE ON SCHEMA public TO petrobox;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO petrobox;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO petrobox;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO petrobox;
  ```
  (Lo mejor es que Case incluya estos grants en su plantilla de aprovisionamiento.)

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

1. En Case, activá/elegí un negocio de easy pos (o usá `multipartes`).
2. En su panel (`easypos.easypaybo.com/n/multipartes` → Configuración → Vincular
   dispositivo) generá el QR/código.
3. En el teléfono (con internet, **sin** cable): abrí easy pos, escaneá el QR.
4. Entrá con un empleado del negocio, hacé una venta (baja stock) y un pedido a
   proveedor (al recibir, sube stock).

Si todo eso anda, el backend real está funcionando y ya no depende de tu PC.

---

## Checklist rápido

- [ ] DNS `easypos.easypaybo.com` → 173.212.251.72
- [ ] Código en `/opt/easypos` + `npm ci` + `npm run build`
- [ ] `.env.production` con `CENTRAL_DATABASE_URL` y `TENANT_DATABASE_URL_TEMPLATE`
- [ ] `easypos.service` activo
- [ ] nginx vhost + certbot (HTTPS)
- [ ] (hecho) migraciones en las bases `bo_epos_*` existentes
- [ ] app recompilada con `EASYPOS_API=https://easypos.easypaybo.com`
- [ ] prueba de humo OK
