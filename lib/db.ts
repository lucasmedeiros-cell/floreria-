import { Pool, type QueryResultRow } from "pg";
import { currentTenant } from "./tenant";

/**
 * Pool de conexiones PostgreSQL por defecto.
 *
 * Usa DATABASE_URL; en desarrollo se reutiliza entre recargas (HMR). Es la base
 * del modo de un solo negocio (y la de las rutas viejas `/`, `/admin`).
 * Cuando la request pertenece a un negocio pareado (`/n/<slug>` o token de
 * dispositivo), `activePool()` devuelve el pool de LA BASE DE ESE NEGOCIO y
 * esta queda sin usar. Ver `lib/tenant.ts`.
 */
const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
  pgPoolErrorBound?: boolean;
};

function makePool(): Pool {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://petrobox:petrobox@localhost:5432/floreria";
  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl:
      process.env.PGSSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

export const pool: Pool = globalForPg.pgPool ?? makePool();
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

// Sin este listener, si una conexión inactiva del pool se cae (Postgres se
// reinicia, la máquina se suspende, etc.) el evento 'error' del pool queda sin
// manejar y puede tumbar el proceso. Con el listener, el pool simplemente
// descarta la conexión rota y abre una nueva en la próxima consulta.
if (!globalForPg.pgPoolErrorBound) {
  pool.on("error", (err) => {
    console.error("[db] conexión inactiva del pool falló:", err.message);
  });
  globalForPg.pgPoolErrorBound = true;
}

/**
 * La base contra la que corre la consulta: la del negocio de esta request si
 * hay uno resuelto, o la de `DATABASE_URL` si no. Por esto las rutas de la API
 * no tienen que pasar el negocio a mano en cada consulta.
 */
export function activePool(): Pool {
  return currentTenant()?.pool ?? pool;
}

/** Helper tipado: ejecuta una consulta y devuelve las filas. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await activePool().query<T>(text, params as never[]);
  return res.rows;
}

/** Devuelve la primera fila o null. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Ejecuta una función dentro de una transacción. */
export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const client = await activePool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
