# Panel de negocios de easy pos (`/panel`)

El panel propio de easy pos: la herramienta del EQUIPO (PetroBox) para
administrar los negocios. Hace lo que antes se hacía en el panel de Case, pero
**sin Case**: easy pos tiene su registro propio y no comparte nada con otros
productos.

| Pieza | Dónde vive |
|---|---|
| Registro de negocios y dispositivos | Base **`bo_epos_central`** (esquema en `db/central.sql`) |
| Usuarios del panel | Tabla `usuario` de esa base (no confundir con `employees` de cada negocio) |
| Historial de acciones | Tabla `actividad` |
| Interfaz | `/panel` (`components/panel/PanelApp.tsx`) |
| API | `/api/panel/*` (sesión) y `/api/provision` (el motor: altas, estados, dispositivos, empleados, BaaS) |

## Qué se puede hacer desde el panel

- **Alta de negocio**: crea la base `bo_epos_<slug>` con el esquema completo,
  los permisos del rol `petrobox`, el nombre/rubro configurados y el usuario
  Administrador del dueño. Si algo falla a medias, se limpia solo (compensación).
- **Estados**: `activo`, `prueba`, `suspendido`, `baja`. Suspendido o de baja =
  ni la web `/n/<slug>` ni la app del negocio responden (tarda ≤30 s por el
  cache de la central en `lib/tenant.ts`).
- **Dispositivos**: generar el QR de pareo para la app móvil, bloquear/habilitar
  y eliminar pareos, ver metadata reportada (modelo, versión, último uso, IP).
- **Usuarios del negocio**: listar, crear y cambiar el rol de sus empleados.
- **Cobros QR (BaaS BCP)**: cargar las credenciales del comercio (la clave
  nunca vuelve al navegador).
- **Datos del negocio**: nombre, rubro, NIT, teléfono, correo, dirección, ciudad.
- **Actividad**: todo lo anterior queda registrado (quién, qué, cuándo).

## Autenticación

- **Producción: solo Google, solo `@petroboxinc.com`.** Con `GOOGLE_CLIENT_ID`
  + `GOOGLE_CLIENT_SECRET` en el `.env`, el login del panel muestra únicamente
  «Ingresar con Google» (mismo patrón y diseño que case.easypaybo.com) y el
  login por contraseña queda apagado (403). El callback verifica emisor,
  audiencia, correo verificado y dominio (`PANEL_ALLOWED_DOMAIN`, por defecto
  `petroboxinc.com`); cualquier cuenta del dominio entra y se crea sola en
  `usuario` la primera vez (con una clave aleatoria inusable). Para vetar a
  alguien: `UPDATE usuario SET activo = false WHERE lower(email) = '…'`.
- En la consola de Google (APIs y servicios → Credenciales) el cliente OAuth
  debe tener registrada la redirect URI:
  `https://easypos.easypaybo.com/api/panel/auth/google/callback`. Sirve el
  mismo cliente del panel Case agregándole esta URI.
- Rutas: `/api/panel/auth/google/start` (redirige a Google),
  `/api/panel/auth/google/callback` (canje del code y cookie),
  `/api/panel/auth/config` (le dice al login qué modo está activo).
- El panel usa su PROPIA sesión: cookie `panel_session` firmada con
  `AUTH_SECRET` (`lib/panelAuth.ts`), contra la tabla `usuario` de la central.
  Es independiente de las sesiones de empleados/clientes de los negocios.
- `/api/provision` acepta esa sesión **o** la clave `PROVISION_KEY` (header
  `x-provision-key`) para scripts. Sin `PROVISION_KEY` configurada, la clave
  queda apagada y solo entra el panel.

### Usuario por contraseña (solo desarrollo, sin Google configurado)

```sql
-- En bo_epos_central:
INSERT INTO usuario (nombre, email, pass_hash)
VALUES ('Nombre', 'correo@petroboxinc.com', crypt('LA-CLAVE', gen_salt('bf', 10)));
-- Resetear una clave:
UPDATE usuario SET pass_hash = crypt('CLAVE-NUEVA', gen_salt('bf', 10))
 WHERE lower(email) = lower('correo@petroboxinc.com');
```

## La central propia y la migración desde Case

- Esquema: `db/central.sql` (idempotente). Crear la base:
  `CREATE DATABASE bo_epos_central OWNER petrobox;` y aplicar el archivo.
- El rol `petrobox` necesita `CREATEDB` (el alta de negocios crea bases):
  `ALTER ROLE petrobox CREATEDB;`
- Migrar lo que había en Case (solo LEE de Case, idempotente):
  `CASE_URL=… CENTRAL_URL=… ./db/migrar-central-desde-case.sh`
  Conviene re-correrlo justo antes de apuntar `CENTRAL_DATABASE_URL` a la
  central nueva, para arrastrar pareos hechos entre medio.
- Hecho en bilbo el 2026-07-22: 4 negocios (multipartes, multipartesscz,
  prueba_easy, coquito) y 9 dispositivos. En `bo_case_central` no se tocó nada;
  simplemente ya no se lee.

## Variables de entorno

```ini
CENTRAL_DATABASE_URL=postgresql://petrobox:<clave>@localhost:5432/bo_epos_central
# Opcional, si las bases bo_epos_* viven en otro servidor ({db} = nombre):
# TENANT_DATABASE_URL_TEMPLATE=postgresql://petrobox:<clave>@otrohost:5432/{db}
# Opcional, para usar /api/provision por script:
# PROVISION_KEY=una-clave-larga
```

Sin `CENTRAL_DATABASE_URL` la app corre en modo de UN solo negocio (como el
programa de Coquito) y el panel responde 501.
