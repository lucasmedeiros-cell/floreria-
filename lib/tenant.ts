import { AsyncLocalStorage } from "async_hooks";
import { Pool } from "pg";

/**
 * Multi-negocio (multi-tenant) de easy pos.
 *
 * Cada negocio tiene su PROPIA base (`bo_epos_<slug>`), igual que en Case cada
 * comercio tiene su instancia AccountingBox. El registro de quién es quién vive
 * en la base central de Case (`bo_sole_central`): la tabla `negocio` dice qué
 * base le toca a cada slug, y `dispositivo` guarda los tokens de pareo.
 *
 * Este módulo hace tres cosas:
 *   1. Resuelve el negocio (por slug de la URL o por token de pareo).
 *   2. Mantiene un pool de conexiones por base (se reusa entre requests).
 *   3. Deja el negocio activo en un AsyncLocalStorage, para que `lib/db.ts`
 *      sepa contra qué base correr la consulta sin que cada ruta lo pase a mano.
 *
 * Sin `CENTRAL_DATABASE_URL` el sistema corre en modo de un solo negocio (el de
 * `DATABASE_URL`, como antes de existir el pareo): la app sigue funcionando.
 */

export interface Negocio {
  id: string;
  nombre: string;
  slug: string;
  dbName: string;
  /** prueba | activo | suspendido | baja */
  estado: string;
  rubro: string | null;
}

export interface TenantContext {
  negocio: Negocio;
  pool: Pool;
}

/** Metadata que reporta el cliente pareado (app móvil) en cada llamada. */
export interface DeviceMeta {
  plataforma?: string | null;
  modelo?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  deviceName?: string | null;
  ip?: string | null;
}

const store = new AsyncLocalStorage<TenantContext>();

const globalForTenant = globalThis as unknown as {
  centralPool?: Pool;
  tenantPools?: Map<string, Pool>;
  negocioCache?: Map<string, { at: number; negocio: Negocio | null }>;
};

/** Hay central configurada → hay varios negocios. Si no, modo negocio único. */
export function isMultiTenant(): boolean {
  return !!process.env.CENTRAL_DATABASE_URL;
}

function bindPoolErrors(pool: Pool, label: string): Pool {
  // Sin este listener, una conexión inactiva que se cae (Postgres reinicia, la
  // red se corta) emite 'error' sin manejar y puede tumbar el proceso.
  pool.on("error", (err) => {
    console.error(`[tenant] conexión inactiva de ${label} falló:`, err.message);
  });
  return pool;
}

function ssl() {
  return process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined;
}

/** Pool contra la base central de Case (registro de negocios y dispositivos). */
function centralPool(): Pool {
  const url = process.env.CENTRAL_DATABASE_URL;
  if (!url) throw new Error("CENTRAL_DATABASE_URL no está configurada");
  if (!globalForTenant.centralPool) {
    globalForTenant.centralPool = bindPoolErrors(
      new Pool({
        connectionString: url,
        max: Number(process.env.PG_POOL_MAX_CENTRAL ?? 5),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        ssl: ssl(),
      }),
      "la central"
    );
  }
  return globalForTenant.centralPool;
}

/**
 * Cadena de conexión a la base de UN negocio. Las bases de los negocios viven
 * en el mismo Postgres que la central, así que se toma la URL de la central y
 * se le cambia el nombre de la base (mismo truco que `tenantConnString` en el
 * panel de Case). `TENANT_DATABASE_URL_TEMPLATE` permite apuntar a otro
 * servidor: usar `{db}` como marcador.
 */
function tenantConnString(dbName: string): string {
  const tpl = process.env.TENANT_DATABASE_URL_TEMPLATE;
  if (tpl) return tpl.replace("{db}", dbName);
  const url = new URL(
    process.env.CENTRAL_DATABASE_URL ?? process.env.DATABASE_URL ?? ""
  );
  url.pathname = "/" + dbName;
  return url.toString();
}

/**
 * Pool de la base de un negocio. Se cachea por nombre de base: una app sirve a
 * muchos negocios y abrir un pool nuevo por request los agotaría.
 */
export function tenantPool(dbName: string): Pool {
  const pools = (globalForTenant.tenantPools ??= new Map<string, Pool>());
  const cached = pools.get(dbName);
  if (cached) return cached;
  const pool = bindPoolErrors(
    new Pool({
      connectionString: tenantConnString(dbName),
      // Bajo a propósito: el límite del servidor se reparte entre TODOS los
      // negocios activos, no entre las consultas de uno solo.
      max: Number(process.env.PG_POOL_MAX_TENANT ?? 4),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: ssl(),
    }),
    `la base ${dbName}`
  );
  pools.set(dbName, pool);
  return pool;
}

// --- Registro de negocios (contra la central) --------------------------------

const CACHE_MS = 30_000; // suspensiones y bajas tardan a lo sumo esto en aplicar

function cacheGet(key: string): Negocio | null | undefined {
  const cache = (globalForTenant.negocioCache ??= new Map());
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.negocio;
}

function cacheSet(key: string, negocio: Negocio | null): void {
  (globalForTenant.negocioCache ??= new Map()).set(key, {
    at: Date.now(),
    negocio,
  });
}

interface NegocioRow {
  id: string;
  nombre: string;
  slug: string;
  db_name: string;
  estado: string;
  rubro: string | null;
}

const toNegocio = (r: NegocioRow): Negocio => ({
  id: r.id,
  nombre: r.nombre,
  slug: r.slug,
  dbName: r.db_name,
  estado: r.estado,
  rubro: r.rubro,
});

/** Busca un negocio de easy pos por su slug (el de la URL `/n/<slug>`). */
export async function negocioBySlug(slug: string): Promise<Negocio | null> {
  if (!isMultiTenant()) return null;
  const key = `slug:${slug}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const { rows } = await centralPool().query<NegocioRow>(
    `SELECT id, nombre, slug, db_name, estado, rubro
       FROM negocio
      WHERE slug = $1 AND producto = 'easypos'`,
    [slug]
  );
  const negocio = rows[0] ? toNegocio(rows[0]) : null;
  cacheSet(key, negocio);
  return negocio;
}

/**
 * Todos los negocios easy pos que pueden atender (activos o en prueba). Lo usa
 * el pareo por código: la app llega con un código de 6 dígitos pero sin saber a
 * qué negocio pertenece, así que se busca el código en la base de cada uno.
 */
export async function negociosEasyposActivos(): Promise<Negocio[]> {
  if (!isMultiTenant()) return [];
  const { rows } = await centralPool().query<NegocioRow>(
    `SELECT id, nombre, slug, db_name, estado, rubro
       FROM negocio
      WHERE producto = 'easypos' AND estado NOT IN ('suspendido', 'baja')
      ORDER BY fecha_alta DESC`
  );
  return rows.map(toNegocio);
}

/**
 * Resuelve el negocio por el token de pareo del dispositivo (app móvil).
 * Devuelve null si el token no existe o el dispositivo está bloqueado —
 * mismo criterio que `posAuth` en el panel de Case.
 */
export async function negocioByToken(token: string): Promise<Negocio | null> {
  if (!isMultiTenant() || !token) return null;
  const key = `token:${token}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const { rows } = await centralPool().query<NegocioRow & { habilitado: boolean }>(
    `SELECT n.id, n.nombre, n.slug, n.db_name, n.estado, n.rubro, d.habilitado
       FROM dispositivo d
       JOIN negocio n ON n.id = d.negocio_id
      WHERE d.token = $1 AND n.producto = 'easypos'`,
    [token]
  );
  const row = rows[0];
  const negocio = row && row.habilitado ? toNegocio(row) : null;
  cacheSet(key, negocio);
  return negocio;
}

/** Un negocio suspendido o dado de baja no atiende ni web ni app. */
export function estaActivo(negocio: Negocio): boolean {
  return !["suspendido", "baja"].includes(negocio.estado);
}

/**
 * Da de alta en la CENTRAL el token que salió de un canje de código de 6
 * dígitos (que vive en la `device_pairing` del tenant). Sin este registro,
 * `negocioByToken` no encontraría el token y la request siguiente al canje
 * devolvería 401: el pareo por código quedaría muerto en multi-tenant.
 */
export async function registrarTokenCentral(
  negocioId: string,
  token: string,
  label?: string | null
): Promise<void> {
  if (!isMultiTenant() || !token) return;
  await centralPool().query(
    `INSERT INTO dispositivo (id, negocio_id, token, habilitado, fecha_alta, label)
     VALUES (gen_random_uuid()::text, $1, $2, true, now(), $3)
     ON CONFLICT DO NOTHING`,
    [negocioId, token, (label ?? "").trim() || "App móvil"]
  );
}

/**
 * Marca el dispositivo como visto y guarda lo que reportó (plataforma, versión
 * de la app, IP). Es lo que el panel de Case muestra en la ficha del comercio.
 * Nunca tira: si la central falla, la request del negocio igual debe responder.
 */
export async function touchDevice(token: string, meta: DeviceMeta): Promise<void> {
  if (!isMultiTenant() || !token) return;
  try {
    await centralPool().query(
      `UPDATE dispositivo
          SET last_seen = now(),
              plataforma  = COALESCE($2, plataforma),
              modelo      = COALESCE($3, modelo),
              os_version  = COALESCE($4, os_version),
              app_version = COALESCE($5, app_version),
              device_name = COALESCE($6, device_name),
              ultimo_ip   = COALESCE($7, ultimo_ip)
        WHERE token = $1`,
      [
        token,
        meta.plataforma ?? null,
        meta.modelo ?? null,
        meta.osVersion ?? null,
        meta.appVersion ?? null,
        meta.deviceName ?? null,
        meta.ip ?? null,
      ]
    );
  } catch (err) {
    console.warn("[tenant] no se pudo actualizar el dispositivo:", err);
  }
}

// --- Contexto del negocio activo ---------------------------------------------

/** El negocio de la request en curso (undefined = modo negocio único). */
export function currentTenant(): TenantContext | undefined {
  return store.getStore();
}

/** Corre `fn` con `negocio` como negocio activo: todo `query()` va a SU base. */
export function runWithTenant<T>(negocio: Negocio, fn: () => Promise<T>): Promise<T> {
  return store.run({ negocio, pool: tenantPool(negocio.dbName) }, fn);
}

/**
 * Corre `fn` en el contexto del negocio del slug. Si no existe (o el sistema
 * está en modo negocio único) corre igual, contra la base por defecto — así las
 * rutas viejas (`/`, `/admin`) siguen andando como siempre.
 */
export async function runWithSlug<T>(
  slug: string | null | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (!slug) return fn();
  const negocio = await negocioBySlug(slug);
  if (!negocio) return fn();
  return runWithTenant(negocio, fn);
}
