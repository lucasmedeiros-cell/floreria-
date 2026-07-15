import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { setSessionCookie, signToken } from "@/lib/auth";

export const runtime = "nodejs";

// Toda ruta de la API resuelve a qué negocio pertenece la request (lee headers
// en `handler()`), así que nunca se puede renderizar estáticamente.
export const dynamic = "force-dynamic";

export const POST = handler(async (req: NextRequest) => {
  const body = await req.json();
  // La app manda `identifier` (teléfono o correo); el CRM web manda `email`.
  // Se aceptan los dos para no romper el login viejo.
  const identifier: string = (body.identifier ?? body.email ?? "").trim();
  const pass: string = body.pass ?? "";
  if (!identifier || !pass) {
    return bad("Ingresá tu teléfono (o correo) y contraseña.");
  }

  // Coincide por teléfono O por correo (ambos únicos), sin distinguir mayúsculas
  // en el correo. La contraseña se verifica con crypt contra el hash guardado.
  const row = await queryOne<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
  }>(
    `SELECT id, name, email, phone, role
       FROM employees
      WHERE active
        AND (phone = $1 OR lower(email) = lower($1))
        AND pass_hash = crypt($2, pass_hash)`,
    [identifier, pass]
  );

  if (!row) return unauthorized("Datos incorrectos. Revisá e intentá de nuevo.");

  const token = signToken({
    sub: row.id,
    email: row.email ?? "",
    name: row.name,
    role: row.role,
    kind: "employee",
  });
  setSessionCookie("employee", token);
  return ok({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    token,
  });
});
