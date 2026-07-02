import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { bad, handler, ok } from "@/lib/api";
import { setSessionCookie, signToken } from "@/lib/auth";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = handler(async (req: NextRequest) => {
  const { name, email, phone, pass, confirm } = await req.json();
  const nm = (name ?? "").trim();
  const em = (email ?? "").trim();

  if (!nm) return bad("Ingresa tu nombre completo.");
  if (!EMAIL_RE.test(em)) return bad("Ingresa un correo válido.");
  if (!pass || pass.length < 6)
    return bad("La contraseña debe tener al menos 6 caracteres.");
  if (confirm !== undefined && pass !== confirm)
    return bad("Las contraseñas no coinciden.");

  const exists = await queryOne(
    `SELECT 1 FROM customers WHERE lower(email) = lower($1)`,
    [em]
  );
  if (exists) return bad("Ese correo ya está registrado.");

  const row = await queryOne<{ id: string; name: string; email: string }>(
    `INSERT INTO customers (name, email, phone, pass_hash)
     VALUES ($1, $2, $3, crypt($4, gen_salt('bf')))
     RETURNING id, name, email`,
    [nm, em, (phone ?? "").trim(), pass]
  );

  const token = signToken({
    sub: row!.id,
    email: row!.email,
    name: row!.name,
    kind: "customer",
  });
  setSessionCookie("customer", token);
  return ok({ id: row!.id, name: row!.name, email: row!.email, token }, { status: 201 });
});
