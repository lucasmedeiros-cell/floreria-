import { handler, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { puedeGestionarProductos } from "@/lib/perms";

export const runtime = "nodejs";

// Toda ruta de la API resuelve a qué negocio pertenece la request (lee headers
// en `handler()`), así que nunca se puede renderizar estáticamente.
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const s = getSession("employee");
  if (!s) return ok({ user: null });
  // `can` = permisos EFECTIVOS (rol + banderas de la base): la app decide con
  // esto qué botones mostrar. El backend igual valida en cada escritura.
  return ok({
    user: {
      id: s.sub,
      name: s.name,
      email: s.email,
      role: s.role,
      can: { products: await puedeGestionarProductos(s) },
    },
  });
});
