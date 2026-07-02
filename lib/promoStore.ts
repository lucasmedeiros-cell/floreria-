import { query, queryOne } from "./db";
import { defaultPromoConfig, type PromoConfig } from "./promo";

const KEY = "promo";

/**
 * Lee la config de la landing promocional desde `settings`.
 * Si no hay fila guardada devuelve los valores por defecto, así que la
 * landing funciona incluso antes de que el admin la edite por primera vez.
 */
export async function readPromoConfig(): Promise<PromoConfig> {
  try {
    const row = await queryOne<{ value: PromoConfig }>(
      `SELECT value FROM settings WHERE key = $1`,
      [KEY]
    );
    if (!row) return defaultPromoConfig;
    // Merge sobre los defaults para tolerar configs viejas sin algún campo.
    return { ...defaultPromoConfig, ...row.value };
  } catch (error) {
    console.warn(
      "No se pudo leer la configuración de la landing promocional; usando valores por defecto.",
      error
    );
    return defaultPromoConfig;
  }
}

/** Guarda (upsert) la config de la landing promocional. */
export async function writePromoConfig(
  cfg: Partial<PromoConfig>
): Promise<PromoConfig> {
  const merged: PromoConfig = { ...defaultPromoConfig, ...cfg };
  await query(
    `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify(merged)]
  );
  return merged;
}
