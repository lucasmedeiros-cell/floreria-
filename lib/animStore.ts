import { query, queryOne } from "./db";
import { defaultAnimConfig, type AnimConfig } from "./anim";

const KEY = "anim";

/**
 * Lee la config de animaciones desde `settings`. Si no hay fila o la base de
 * datos no está disponible, devuelve los valores por defecto para que la web
 * nunca falle por esto.
 */
export async function readAnimConfig(): Promise<AnimConfig> {
  try {
    const row = await queryOne<{ value: AnimConfig }>(
      `SELECT value FROM settings WHERE key = $1`,
      [KEY]
    );
    if (!row) return defaultAnimConfig;
    return { ...defaultAnimConfig, ...row.value };
  } catch {
    return defaultAnimConfig;
  }
}

/** Guarda (upsert) la config de animaciones. */
export async function writeAnimConfig(
  cfg: Partial<AnimConfig>
): Promise<AnimConfig> {
  const merged: AnimConfig = {
    web: cfg.web ?? defaultAnimConfig.web,
    admin: cfg.admin ?? defaultAnimConfig.admin,
  };
  await query(
    `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify(merged)]
  );
  return merged;
}
