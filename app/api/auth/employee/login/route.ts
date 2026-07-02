import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { setSessionCookie, signToken } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = handler(async (req: NextRequest) => {
  const { email, pass } = await req.json();
  if (!email?.trim() || !pass) return bad("Ingresa tu correo y contraseña.");

  const row = await queryOne<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>(
    `SELECT id, name, email, role
       FROM employees
      WHERE lower(email) = lower($1)
        AND active
        AND pass_hash = crypt($2, pass_hash)`,
    [email.trim(), pass]
  );

  if (!row) return unauthorized("Correo o contraseña incorrectos.");

  const token = signToken({
    sub: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    kind: "employee",
  });
  setSessionCookie("employee", token);
  return ok({ id: row.id, name: row.name, email: row.email, role: row.role, token });
});
