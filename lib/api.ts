import { NextResponse } from "next/server";

export const ok = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, init);

export const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export const unauthorized = (message = "No autorizado") =>
  NextResponse.json({ error: message }, { status: 401 });

export const notFound = (message = "No encontrado") =>
  NextResponse.json({ error: message }, { status: 404 });

/** Envuelve un handler capturando errores de BD y devolviendo 500 limpio. */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
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
