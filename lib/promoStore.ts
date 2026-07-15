import { query, queryOne } from "./db";
import { promoFromRubro, type PromoConfig } from "./promo";
import { readBusinessConfig } from "./businessStore";

const KEY = "promo";

/** Promo por defecto del negocio actual (rubro activo + nombre comercial). */
export async function defaultPromoForBusiness(): Promise<PromoConfig> {
  const b = await readBusinessConfig();
  return promoFromRubro(b.rubroId, b.name);
}

/**
 * Lee la config de la landing promocional desde `settings`.
 * Si no hay fila guardada devuelve la promo por defecto DEL RUBRO ACTIVO, así
 * que la landing funciona (y habla del rubro correcto) desde el minuto cero.
 */
export async function readPromoConfig(): Promise<PromoConfig> {
  const base = await defaultPromoForBusiness();
  try {
    const row = await queryOne<{ value: PromoConfig }>(
      `SELECT value FROM settings WHERE key = $1`,
      [KEY]
    );
    if (!row) return base;
    // Merge sobre los defaults para tolerar configs viejas sin algún campo.
    return { ...base, ...row.value };
  } catch (error) {
    console.warn(
      "No se pudo leer la configuración de la landing promocional; usando valores por defecto.",
      error
    );
    return base;
  }
}

/** Guarda (upsert) la config de la landing promocional. */
export async function writePromoConfig(
  cfg: Partial<PromoConfig>
): Promise<PromoConfig> {
  const base = await defaultPromoForBusiness();
  const merged: PromoConfig = { ...base, ...cfg };
  await query(
    `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify(merged)]
  );
  return merged;
}

/** Borra la promo guardada: la landing vuelve a la promo por defecto del rubro. */
export async function resetPromoConfig(): Promise<void> {
  await query(`DELETE FROM settings WHERE key = $1`, [KEY]);
}
