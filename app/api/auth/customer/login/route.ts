import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { setSessionCookie, signToken } from "@/lib/auth";

export const runtime = "nodejs";

// Toda ruta de la API resuelve a qué negocio pertenece la request (lee headers
// en `handler()`), así que nunca se puede renderizar estáticamente.
export const dynamic = "force-dynamic";

export const POST = handler(async (req: NextRequest) => {
  const { email, pass } = await req.json();
  if (!email?.trim() || !pass) return bad("Ingresa tu correo y contraseña.");

  const row = await queryOne<{
    id: string;
    name: string;
    email: string;
    phone: string;
  }>(
    `SELECT id, name, email, phone
       FROM customers
      WHERE lower(email) = lower($1)
        AND pass_hash = crypt($2, pass_hash)`,
    [email.trim(), pass]
  );

  if (!row) return unauthorized("Correo o contraseña incorrectos.");

  const token = signToken({
    sub: row.id,
    email: row.email,
    name: row.name,
    kind: "customer",
  });
  setSessionCookie("customer", token);
  return ok({ id: row.id, name: row.name, email: row.email, phone: row.phone, token });
});
