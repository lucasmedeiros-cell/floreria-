import { query, queryOne } from "./db";
import {
  MAX_PROMO_PAGES,
  promoFromRubro,
  promoSlugify,
  sanitizePromoPage,
  uniquePromoSlug,
  type PromoConfig,
  type PromoPage,
} from "./promo";
import { readBusinessConfig } from "./businessStore";

/**
 * Landings promocionales del negocio.
 *
 * Un negocio puede tener VARIAS (una por campaña, sucursal o producto
 * estrella). Se guardan todas juntas en `settings` bajo la clave `promos`, como
 * una LISTA ORDENADA: la primera es la principal y es la que se sirve en
 * `/promo`; el resto vive en `/promo/<slug>`.
 *
 * `PROMO_KEY` (singular) es la clave vieja, de cuando había una sola landing.
 * Se sigue leyendo para migrar sin perder nada lo que ya tenían los negocios en
 * producción: la primera lectura la convierte en la landing principal, y el
 * primer guardado ya escribe la lista nueva.
 */
const KEY = "promos";
const LEGACY_KEY = "promo";

/** Id de la landing migrada desde la config vieja (una sola landing). */
const PRINCIPAL_ID = "principal";

function newId(): string {
  return `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Promo por defecto del negocio actual (rubro activo + nombre comercial). */
export async function defaultPromoForBusiness(): Promise<PromoConfig> {
  const b = await readBusinessConfig();
  return promoFromRubro(b.rubroId, b.name);
}

/**
 * Completa una landing guardada con los valores por defecto del rubro.
 * El merge tolera configs viejas a las que les falte algún campo, y le pone
 * id/nombre/slug a las que vienen de la época de la landing única.
 */
function hydrate(
  stored: Partial<PromoPage>,
  base: PromoConfig,
  index: number
): PromoPage {
  const merged = { ...base, ...stored } as PromoPage;
  const name =
    typeof stored.name === "string" && stored.name.trim() !== ""
      ? stored.name.trim()
      : index === 0
        ? "Landing principal"
        : `Landing ${index + 1}`;
  return {
    ...merged,
    id: stored.id || (index === 0 ? PRINCIPAL_ID : newId()),
    name,
    slug: promoSlugify(stored.slug) || promoSlugify(name) || `landing-${index + 1}`,
  };
}

/** Dos landings con el mismo slug harían inalcanzable a la segunda. */
function dedupeSlugs(pages: PromoPage[]): PromoPage[] {
  const taken: string[] = [];
  return pages.map((p) => {
    const slug = uniquePromoSlug(p.slug, taken);
    taken.push(slug);
    return p.slug === slug ? p : { ...p, slug };
  });
}

/**
 * Lee TODAS las landings del negocio, ya completadas con los defaults del rubro
 * activo. Siempre devuelve al menos una: un negocio recién creado ve la promo
 * por defecto de su rubro, como antes de que existieran las landings múltiples.
 */
export async function readPromoPages(): Promise<PromoPage[]> {
  const base = await defaultPromoForBusiness();
  try {
    const row = await queryOne<{ value: { pages?: Partial<PromoPage>[] } }>(
      `SELECT value FROM settings WHERE key = $1`,
      [KEY]
    );
    const stored = Array.isArray(row?.value?.pages) ? row!.value.pages! : null;
    if (stored && stored.length > 0) {
      return dedupeSlugs(stored.slice(0, MAX_PROMO_PAGES).map((p, i) => hydrate(p, base, i)));
    }

    // Migración de la landing única: se conserva tal cual como principal.
    const legacy = await queryOne<{ value: Partial<PromoConfig> }>(
      `SELECT value FROM settings WHERE key = $1`,
      [LEGACY_KEY]
    );
    if (legacy) return [hydrate({ ...legacy.value, id: PRINCIPAL_ID }, base, 0)];

    return [hydrate({ id: PRINCIPAL_ID }, base, 0)];
  } catch (error) {
    console.warn(
      "No se pudo leer la configuración de las landings; usando valores por defecto.",
      error
    );
    return [hydrate({ id: PRINCIPAL_ID }, base, 0)];
  }
}

/** Guarda (upsert) la lista completa de landings. */
async function writePromoPages(pages: PromoPage[]): Promise<PromoPage[]> {
  const clean = dedupeSlugs(pages.slice(0, MAX_PROMO_PAGES));
  await query(
    `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [KEY, JSON.stringify({ pages: clean })]
  );
  return clean;
}

/** La landing principal: la que sirve `/promo` (y la que ve la API vieja). */
export async function readPromoConfig(): Promise<PromoConfig> {
  const [principal] = await readPromoPages();
  return principal;
}

/** Landing por su slug de URL. `null` si no existe (la página responde 404). */
export async function readPromoPageBySlug(
  slug: string
): Promise<PromoPage | null> {
  const wanted = promoSlugify(slug);
  if (!wanted) return null;
  const pages = await readPromoPages();
  return pages.find((p) => p.slug === wanted) ?? null;
}

/**
 * Guarda una landing de la lista. Devuelve `null` si el id no existe (la
 * borraron desde otra pestaña mientras se editaba).
 */
export async function savePromoPage(
  id: string,
  input: Partial<PromoPage>
): Promise<PromoPage | null> {
  const base = await defaultPromoForBusiness();
  const pages = await readPromoPages();
  const i = pages.findIndex((p) => p.id === id);
  if (i < 0) return null;

  const saved = sanitizePromoPage(input, base, {
    id,
    takenSlugs: pages.filter((_, k) => k !== i).map((p) => p.slug),
  });
  const next = pages.map((p, k) => (k === i ? saved : p));
  const written = await writePromoPages(next);
  return written[i];
}

/**
 * Crea una landing nueva. Sin `copyFromId` sale de la promo por defecto del
 * rubro; con él, se duplica una existente (lo que uno espera al lanzar una
 * campaña parecida a la anterior).
 */
export async function createPromoPage(input: {
  name?: string;
  slug?: string;
  copyFromId?: string;
}): Promise<{ page: PromoPage; pages: PromoPage[] } | { error: string }> {
  const base = await defaultPromoForBusiness();
  const pages = await readPromoPages();
  if (pages.length >= MAX_PROMO_PAGES) {
    return { error: `Solo se pueden tener ${MAX_PROMO_PAGES} landings por negocio.` };
  }

  const source = input.copyFromId
    ? pages.find((p) => p.id === input.copyFromId)
    : undefined;
  const name =
    (input.name ?? "").trim() ||
    (source ? `${source.name} (copia)` : `Landing ${pages.length + 1}`);

  const page = sanitizePromoPage(
    {
      ...(source ?? base),
      name,
      slug: input.slug ?? "",
      // Una landing que alguien crea a mano nace PUBLICADA. El default del
      // rubro "generico" es despublicada (instalación recién montada), y sin
      // esto la landing nueva abría en "Promoción no disponible" — el usuario
      // acababa de crearla y parecía rota. Duplicar conserva el estado del
      // original, que es lo que uno espera de una copia.
      enabled: source ? source.enabled : true,
    },
    base,
    { id: newId(), takenSlugs: pages.map((p) => p.slug) }
  );
  const written = await writePromoPages([...pages, page]);
  return { page: written[written.length - 1], pages: written };
}

/**
 * Borra una landing. No se puede borrar la última: un negocio siempre tiene su
 * landing principal (para despublicarla está el interruptor "activa").
 */
export async function deletePromoPage(
  id: string
): Promise<{ pages: PromoPage[] } | { error: string }> {
  const pages = await readPromoPages();
  if (!pages.some((p) => p.id === id)) return { error: "Esa landing ya no existe." };
  if (pages.length <= 1) {
    return {
      error:
        "Es la única landing del negocio: no se puede borrar. Desactívala si no quieres publicarla.",
    };
  }
  return { pages: await writePromoPages(pages.filter((p) => p.id !== id)) };
}

/** Manda una landing al frente de la lista: pasa a ser la que sirve `/promo`. */
export async function setPrincipalPromoPage(
  id: string
): Promise<{ pages: PromoPage[] } | { error: string }> {
  const pages = await readPromoPages();
  const page = pages.find((p) => p.id === id);
  if (!page) return { error: "Esa landing ya no existe." };
  return {
    pages: await writePromoPages([page, ...pages.filter((p) => p.id !== id)]),
  };
}

/**
 * Guarda la landing PRINCIPAL (compatibilidad: `POST /api/promo`, que existía
 * cuando había una sola). Conserva su id, nombre y slug.
 */
export async function writePromoConfig(
  cfg: Partial<PromoConfig>
): Promise<PromoConfig> {
  const [principal] = await readPromoPages();
  const saved = await savePromoPage(principal.id, { ...principal, ...cfg });
  return saved ?? principal;
}

/**
 * Borra TODAS las landings guardadas: el negocio vuelve a tener solo la promo
 * por defecto de su rubro. Lo usan el cambio de rubro y el alta por pareo.
 */
export async function resetPromoConfig(): Promise<void> {
  await query(`DELETE FROM settings WHERE key = ANY($1::text[])`, [
    [KEY, LEGACY_KEY],
  ]);
}
