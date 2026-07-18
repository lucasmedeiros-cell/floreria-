import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/pairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["Administrador", "Vendedora", "Repartidor"];

// GET /api/employees — equipo del negocio (para la sección Usuarios del CRM/app).
export const GET = handler(async () => {
  if (!getSession("employee")) return unauthorized();
  const rows = await query(
    `SELECT id, name, email, phone, role, active
       FROM employees
      ORDER BY active DESC, created_at`
  );
  return ok(rows);
});

/**
 * POST /api/employees — invita (crea) un empleado. Distinto de /register: NO
 * toca la sesión de quien invita (register logueaba al nuevo usuario). Requiere
 * sesión de empleado: solo alguien de adentro suma gente al equipo.
 */
export const POST = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const b = await req.json();
  const name: string = String(b.name ?? "").trim();
  const phoneRaw: string = String(b.phone ?? "").trim();
  const email: string | null = String(b.email ?? "").trim() || null;
  const role: string = ROLES.includes(b.role) ? b.role : "Vendedora";
  const pass: string = String(b.pass ?? "");

  if (!name || !phoneRaw || !pass) {
    return bad("Completá nombre, teléfono y contraseña.");
  }
  if (!/^\+?[\d\s-]{6,20}$/.test(phoneRaw)) {
    return bad("El teléfono no parece válido.");
  }
  if (pass.length < 6) {
    return bad("La contraseña necesita al menos 6 caracteres.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad("El correo no es válido.");
  }
  const phone = normalizePhone(phoneRaw);

  try {
    const row = await queryOne(
      `INSERT INTO employees (name, phone, email, pass_hash, role)
       VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), $5)
       RETURNING id, name, email, phone, role, active`,
      [name, phone, email, pass, role]
    );
    return ok(row, { status: 201 });
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "23505") {
      return bad("Ya existe una cuenta con ese teléfono o correo.");
    }
    throw err;
  }
});
