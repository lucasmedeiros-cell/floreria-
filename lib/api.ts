import { NextResponse } from "next/server";
import { runWithTenant } from "./tenant";
import { resolveRequestTenant } from "./tenantRequest";
import { deviceFromRequest, hasDeviceToken } from "./pairing";

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
        case "ninguno": {
          // Modo de un solo negocio: la central no valida el token de pareo, así
          // que se valida acá. Si la request TRAE un token de dispositivo, tiene
          // que ser de uno pareado y no revocado — así revocar un equipo perdido
          // realmente le corta el acceso. La web (cookie, sin este header) no se
          // ve afectada; el propio pareo todavía no manda token, así que pasa.
          if (hasDeviceToken() && !(await deviceFromRequest())) {
            return unauthorized("Dispositivo no autorizado. Volvé a parear.");
          }
          return await fn(...args);
        }
      }
    } catch (err) {
      console.error("[api] error:", err);
      const raw = err instanceof Error ? err.message : "Error interno";
      // Un body que no es JSON válido es culpa del cliente, no un error nuestro.
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "El cuerpo de la request no es JSON válido." }, { status: 400 });
      }
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
      // El mensaje crudo (nombres de tablas, constraints de Postgres…) queda en
      // el log del servidor; al cliente le va un genérico.
      const msg = isDbDown
        ? "No se pudo conectar con la base de datos. Verifica que el servidor esté activo e inténtalo de nuevo."
        : "Error interno del servidor. Intentá de nuevo.";
      return NextResponse.json({ error: msg }, { status: isDbDown ? 503 : 500 });
    }
  };
}
