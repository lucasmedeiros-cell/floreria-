"use client";

import { usePathname } from "next/navigation";

/**
 * Links internos que no se salen del negocio.
 *
 * Estando en `/n/floreria-rosa`, un `href="/admin"` te llevaría al CRM de la
 * instalación de un solo negocio, no al de este comercio. `useLink()` antepone
 * la base del negocio cuando la hay: `link("/admin")` → `/n/floreria-rosa/admin`.
 * Fuera de `/n/…` devuelve la ruta tal cual, así que las rutas viejas (`/`,
 * `/promo`, `/admin`) siguen funcionando igual.
 *
 * Va por `usePathname()` (y no por `window.location`) para que el HTML del
 * servidor ya salga con el link correcto y no haya salto en la hidratación.
 */
export function useNegocioBase(): string {
  const pathname = usePathname() ?? "";
  const m = pathname.match(/^\/n\/([a-z0-9][a-z0-9_-]*)/i);
  return m ? `/n/${m[1].toLowerCase()}` : "";
}

export function useLink(): (path: string) => string {
  const base = useNegocioBase();
  return (path: string) => base + path;
}
