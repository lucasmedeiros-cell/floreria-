import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { bad, handler, ok } from "@/lib/api";
import { setSessionCookie, signToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alta de cuenta desde la app: teléfono + contraseña, correo opcional. El
 * negocio ya quedó resuelto por el token de pareo del dispositivo (`handler()`),
 * así que la cuenta se crea en la base de ESE negocio.
 *
 * El primer usuario de un negocio es Administrador; el resto entra como
 * Vendedora (un admin puede subir el rol después desde Usuarios).
 */
export const POST = handler(async (req: NextRequest) => {
  const body = await req.json();
  const name: string = (body.name ?? "").trim();
  const phone: string = (body.phone ?? "").trim();
  const email: string | null = body.email?.trim() || null;
  const pass: string = body.pass ?? "";

  if (!name || !phone || !pass) {
    return bad("Completá nombre, teléfono y contraseña.");
  }
  if (!/^\+?[\d\s-]{6,20}$/.test(phone)) {
    return bad("El teléfono no parece válido.");
  }
  if (pass.length < 6) {
    return bad("La contraseña necesita al menos 6 caracteres.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad("El correo no es válido.");
  }

  // El teléfono (y el correo, si se da) tienen que estar libres.
  const dup = await queryOne<{ id: string }>(
    `SELECT id FROM employees
      WHERE phone = $1 OR ($2::text IS NOT NULL AND lower(email) = lower($2))`,
    [phone, email]
  );
  if (dup) return bad("Ya existe una cuenta con ese teléfono o correo.");

  // Primer empleado del negocio → Administrador.
  const count = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM employees`
  );
  const role = Number(count?.n ?? "0") === 0 ? "Administrador" : "Vendedora";

  const row = await queryOne<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
  }>(
    `INSERT INTO employees (name, phone, email, pass_hash, role)
     VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), $5)
     RETURNING id, name, email, phone, role`,
    [name, phone, email, pass, role]
  );

  const token = signToken({
    sub: row!.id,
    email: row!.email ?? "",
    name: row!.name,
    role: row!.role,
    kind: "employee",
  });
  setSessionCookie("employee", token);
  return ok({
    id: row!.id,
    name: row!.name,
    email: row!.email,
    phone: row!.phone,
    role: row!.role,
    token,
  });
});
