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
      const msg = err instanceof Error ? err.message : "Error interno";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}
