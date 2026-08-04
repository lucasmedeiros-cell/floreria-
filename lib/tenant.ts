import { AsyncLocalStorage } from "async_hooks";
import { Pool, type QueryResultRow } from "pg";

/**
 * Multi-negocio (multi-tenant) de easy pos.
 *
 * Cada negocio tiene su PROPIA base (`bo_epos_<slug>`). El registro de quién es
 * quién vive en la central PROPIA de easy pos (`bo_epos_central`, db/central.sql):
 * la tabla `negocio` dice qué base le toca a cada slug, y `dispositivo` guarda
 * los tokens de pareo. La administra el panel (`/panel`), no Case.
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
  /**
   * Teléfono que cargó el panel de easy pos al dar de alta el negocio. Es el
   * número del que sale el WhatsApp de la tienda mientras el negocio no cargue
   * uno propio en su CRM (ver lib/businessStore.ts).
   */
  telefono: string | null;
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
  waCache?: Map<string, { at: number; wa: WaNumero | null }>;
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

/** Pool contra la central de easy pos (registro de negocios y dispositivos). */
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
 * Consulta directa contra la central. La usan el login del panel y el registro
 * de actividad. Tira si no hay CENTRAL_DATABASE_URL configurada.
 */
export async function centralQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await centralPool().query<T>(text, params as unknown[] | undefined);
  return rows;
}

/**
 * Cadena de conexión a la base de UN negocio. Las bases de los negocios viven
 * en el mismo Postgres que la central, así que se toma la URL de la central y
 * se le cambia el nombre de la base. `TENANT_DATABASE_URL_TEMPLATE` permite
 * apuntar a otro servidor: usar `{db}` como marcador.
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
  telefono: string | null;
}

const toNegocio = (r: NegocioRow): Negocio => ({
  id: r.id,
  nombre: r.nombre,
  slug: r.slug,
  dbName: r.db_name,
  estado: r.estado,
  rubro: r.rubro,
  telefono: r.telefono ?? null,
});

/** Busca un negocio de easy pos por su slug (el de la URL `/n/<slug>`). */
export async function negocioBySlug(slug: string): Promise<Negocio | null> {
  if (!isMultiTenant()) return null;
  const key = `slug:${slug}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const { rows } = await centralPool().query<NegocioRow>(
    `SELECT id, nombre, slug, db_name, estado, rubro, telefono
       FROM negocio
      WHERE slug = $1`,
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
    `SELECT id, nombre, slug, db_name, estado, rubro, telefono
       FROM negocio
      WHERE estado NOT IN ('suspendido', 'baja')
      ORDER BY fecha_alta DESC`
  );
  return rows.map(toNegocio);
}

/**
 * Resuelve el negocio por el token de pareo del dispositivo (app móvil).
 * Devuelve null si el token no existe o el dispositivo está bloqueado.
 */
export async function negocioByToken(token: string): Promise<Negocio | null> {
  if (!isMultiTenant() || !token) return null;
  const key = `token:${token}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const { rows } = await centralPool().query<NegocioRow & { habilitado: boolean }>(
    `SELECT n.id, n.nombre, n.slug, n.db_name, n.estado, n.rubro, n.telefono, d.habilitado
       FROM dispositivo d
       JOIN negocio n ON n.id = d.negocio_id
      WHERE d.token = $1`,
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
 * Canjea el código corto (4 dígitos) que emitió el panel: busca el dispositivo
 * de la central con ese código vigente, devuelve su token y su negocio, y borra
 * el código (un solo uso). null si el código no existe o venció.
 */
export async function redeemCentralPairCode(
  code: string
): Promise<{ token: string; negocio: { slug: string; nombre: string } } | null> {
  if (!isMultiTenant() || !/^\d{4}$/.test(code)) return null;
  const { rows } = await centralPool().query<{
    token: string;
    slug: string;
    nombre: string;
  }>(
    `UPDATE dispositivo d
        SET pair_code = NULL, pair_code_exp = NULL, last_seen = now()
       FROM negocio n
      WHERE d.negocio_id = n.id
        AND d.pair_code = $1
        AND d.pair_code_exp > now()
        AND d.habilitado
      RETURNING d.token, n.slug, n.nombre`,
    [code]
  );
  const r = rows[0];
  return r ? { token: r.token, negocio: { slug: r.slug, nombre: r.nombre } } : null;
}

/**
 * Marca el dispositivo como visto y guarda lo que reportó (plataforma, versión
 * de la app, IP). Es lo que el panel muestra en la ficha del negocio.
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

// --- Números de WhatsApp (Cloud API) -----------------------------------------

/** Un número de WhatsApp de Meta y el negocio que atiende. */
export interface WaNumero {
  /** ID que Meta le da a NUESTRO número; llega en cada evento del webhook. */
  phoneNumberId: string;
  /** El número visible (+591…), solo informativo. */
  numero: string | null;
  etiqueta: string | null;
  /** Token propio del negocio; null = usar META_WA_TOKEN del entorno. */
  token: string | null;
  /** Pausado desde el panel = no atiende, pero no se pierde el registro. */
  activo: boolean;
  negocio: Negocio;
}

interface WaNumeroRow extends NegocioRow {
  phone_number_id: string;
  numero: string | null;
  etiqueta: string | null;
  token: string | null;
  activo: boolean;
}

const toWaNumero = (r: WaNumeroRow): WaNumero => ({
  phoneNumberId: r.phone_number_id,
  numero: r.numero,
  etiqueta: r.etiqueta,
  token: r.token,
  activo: r.activo,
  negocio: toNegocio(r),
});

/**
 * Resuelve de quién es un mensaje entrante de WhatsApp, por el ID del número que
 * lo recibió. Es el "portero" del webhook: sin esto el motor escribiría en la
 * base por defecto y no en la del negocio dueño del número.
 *
 * Cachea igual que el resto (30 s) porque pega una vez por mensaje y el Postgres
 * de bilbo anda justo de conexiones.
 */
export async function waNumeroByPhoneId(
  phoneNumberId: string
): Promise<WaNumero | null> {
  if (!isMultiTenant() || !phoneNumberId) return null;
  const cache = (globalForTenant.waCache ??= new Map());
  const hit = cache.get(phoneNumberId);
  if (hit && Date.now() - hit.at <= CACHE_MS) return hit.wa;

  const { rows } = await centralPool().query<WaNumeroRow>(
    `SELECT w.phone_number_id, w.numero, w.etiqueta, w.token, w.activo,
            n.id, n.nombre, n.slug, n.db_name, n.estado, n.rubro, n.telefono
       FROM wa_numero w
       JOIN negocio n ON n.id = w.negocio_id
      WHERE w.phone_number_id = $1 AND w.activo = true`,
    [phoneNumberId]
  );
  const wa = rows[0] ? toWaNumero(rows[0]) : null;
  cache.set(phoneNumberId, { at: Date.now(), wa });
  return wa;
}

/**
 * Los números de un negocio (para el panel y para el CRM del negocio).
 *
 * No tira si la tabla todavía no existe: alimenta un cartel de estado, y sin
 * esta tolerancia un deploy que llegue antes de aplicar `db/central.sql` deja
 * la pantalla del Vendedor 24/7 en error.
 */
export async function waNumerosDeNegocio(negocioId: string): Promise<WaNumero[]> {
  if (!isMultiTenant() || !negocioId) return [];
  try {
    const { rows } = await centralPool().query<WaNumeroRow>(
      `SELECT w.phone_number_id, w.numero, w.etiqueta, w.token, w.activo,
              n.id, n.nombre, n.slug, n.db_name, n.estado, n.rubro, n.telefono
         FROM wa_numero w
         JOIN negocio n ON n.id = w.negocio_id
        WHERE w.negocio_id = $1
        ORDER BY w.fecha_alta`,
      [negocioId]
    );
    return rows.map(toWaNumero);
  } catch (err) {
    console.warn("[tenant] no se pudieron leer los números de WhatsApp:", err);
    return [];
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
