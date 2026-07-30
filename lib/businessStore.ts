import { query, queryOne } from "./db";
import {
  defaultBusinessConfig,
  normalizeBusiness,
  resolveBusiness,
  waNumber,
  type Business,
  type BusinessConfig,
} from "./business";
import { currentTenant } from "./tenant";

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
    return conTelefonoDelPanel(normalizeBusiness(row?.value));
  } catch (error) {
    console.warn(
      "[business] no se pudo leer la config del negocio; usando el rubro por defecto.",
      error
    );
    return conTelefonoDelPanel(defaultBusinessConfig);
  }
}

/**
 * Si el negocio todavía no cargó su WhatsApp en el CRM, se usa el teléfono que
 * el panel de easy pos guardó al darlo de alta.
 *
 * Sin esto, la tienda y la landing caían a un número de respaldo escrito en el
 * código: el cliente abría WhatsApp y le escribía a un desconocido. El dato ya
 * viaja con el negocio de la request (lib/tenant.ts), así que no cuesta una
 * consulta extra.
 */
function conTelefonoDelPanel(cfg: BusinessConfig): BusinessConfig {
  const delPanel = waNumber(currentTenant()?.negocio.telefono);
  if (!delPanel) return cfg;
  return {
    ...cfg,
    whatsapp: waNumber(cfg.whatsapp) || delPanel,
    phone: cfg.phone?.trim() || delPanel,
  };
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
