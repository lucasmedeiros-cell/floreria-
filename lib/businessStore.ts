import { query, queryOne } from "./db";
import {
  defaultBusinessConfig,
  normalizeBusiness,
  resolveBusiness,
  type Business,
  type BusinessConfig,
} from "./business";

const KEY = "business";

/**
 * Lee la config del negocio (rubro + marca + contacto) desde `settings`.
 * Si no hay fila guardada devuelve el rubro por defecto, así que la web y el
 * panel funcionan aunque nunca se haya entrado a Configuración.
 */
export async function readBusinessConfig(): Promise<BusinessConfig> {
  try {
    const row = await queryOne<{ value: Partial<BusinessConfig> }>(
      `SELECT value FROM settings WHERE key = $1`,
      [KEY]
    );
    return normalizeBusiness(row?.value);
  } catch (error) {
    console.warn(
      "[business] no se pudo leer la config del negocio; usando el rubro por defecto.",
      error
    );
    return defaultBusinessConfig;
  }
}

/** Igual que readBusinessConfig, pero ya resuelto contra el preset del rubro. */
export async function readBusiness(): Promise<Business> {
  return resolveBusiness(await readBusinessConfig());
}

/**
 * Guarda (upsert) la config del negocio.
 *
 * Es un guardado PARCIAL: lo que no venga en `cfg` se mantiene como estaba. Sin
 * esto, un editor que solo manda su pedazo (los módulos, por ejemplo) le
 * borraría al negocio todo lo demás —nombre, WhatsApp, colores— porque los
 * campos ausentes volverían al default del rubro.
 */
export async function writeBusinessConfig(
  cfg: Partial<BusinessConfig>
): Promise<BusinessConfig> {
  const prev = await readBusinessConfig();
  const merged = normalizeBusiness({ ...prev, ...cfg });
  await query(
    `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify(merged)]
  );
  return merged;
}
