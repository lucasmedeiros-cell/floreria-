/**
 * A qué API le habla el navegador.
 *
 * La web de un negocio vive en `/n/<slug>`, y su API cuelga de ahí:
 * `/n/<slug>/api/products` (el middleware la reescribe a `/api/products` y le
 * pega el negocio). Un `fetch("/api/products")` pelado, en cambio, no dice de
 * qué negocio es y termina en la base por defecto — que es justo lo que NO
 * queremos desde la tienda o el CRM de un negocio.
 *
 * Por eso todo fetch del cliente pasa por acá: `apiUrl("/api/products")` mira
 * en qué negocio está parado el navegador y le antepone su base. En una
 * instalación de un solo negocio (`/`, `/admin`) devuelve la ruta tal cual.
 */
export function apiBase(): string {
  if (typeof window === "undefined") return "";
  const m = window.location.pathname.match(/^\/n\/([a-z0-9][a-z0-9_-]*)/i);
  return m ? `/n/${m[1].toLowerCase()}` : "";
}

/** `/api/products` → `/n/floreria-rosa/api/products` (si estamos en ese negocio). */
export function apiUrl(path: string): string {
  return apiBase() + path;
}
