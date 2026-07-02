import { Pool, type QueryResultRow } from "pg";

/**
 * Pool de conexiones PostgreSQL compartido.
 * Usa DATABASE_URL; en desarrollo se reutiliza entre recargas (HMR).
 */
const globalForPg = globalThis as unknown as { pgPool?: Pool };

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

/** Helper tipado: ejecuta una consulta y devuelve las filas. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
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
  const client = await pool.connect();
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
