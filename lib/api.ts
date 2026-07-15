import { NextResponse } from "next/server";
import { runWithTenant } from "./tenant";
import { resolveRequestTenant } from "./tenantRequest";

export const ok = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, init);

export const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export const unauthorized = (message = "No autorizado") =>
  NextResponse.json({ error: message }, { status: 401 });

export const notFound = (message = "No encontrado") =>
  NextResponse.json({ error: message }, { status: 404 });

/**
 * Envuelve un handler: resuelve a QUÉ NEGOCIO pertenece la request y la corre
 * contra la base de ese negocio, capturando errores de BD y devolviendo 500
 * limpio.
 *
 * Que el negocio se resuelva acá (y no ruta por ruta) es lo que permite que
 * `/api/products`, `/api/orders`, etc. sigan escritas como si hubiera una sola
 * base: `query()` ya sale contra la que corresponde. Ver `lib/tenant.ts`.
 */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      const t = await resolveRequestTenant();
      switch (t.kind) {
        case "token-invalido":
          return unauthorized("Dispositivo no autorizado. Volvé a parear.");
        case "slug-desconocido":
          return notFound(`No existe el negocio "${t.slug}".`);
        case "suspendido":
          return NextResponse.json(
            { error: `El comercio "${t.negocio.nombre}" está suspendido.` },
            { status: 403 }
          );
        case "negocio":
          return await runWithTenant(t.negocio, () => fn(...args));
        case "ninguno":
          return await fn(...args);
      }
    } catch (err) {
      console.error("[api] error:", err);
      const raw = err instanceof Error ? err.message : "Error interno";
      // Errores de conexión a la base de datos → mensaje claro para el usuario.
      const code = (err as { code?: string } | null)?.code;
      const isDbDown =
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "ENOTFOUND" ||
        code === "57P01" || // admin_shutdown
        /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|terminating connection|connection terminated/i.test(
          raw
        );
      const msg = isDbDown
        ? "No se pudo conectar con la base de datos. Verifica que el servidor esté activo e inténtalo de nuevo."
        : raw;
      return NextResponse.json({ error: msg }, { status: isDbDown ? 503 : 500 });
    }
  };
}
