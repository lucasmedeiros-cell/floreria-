import { NextRequest } from "next/server";
import { withTransaction } from "@/lib/db";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { setSessionCookie, signToken } from "@/lib/auth";
import { deviceFromRequest, normalizePhone } from "@/lib/pairing";
import { currentTenant, isMultiTenant } from "@/lib/tenant";
import { deviceToken } from "@/lib/tenantRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alta de cuenta desde la app: teléfono + contraseña, correo opcional.
 *
 * EXIGE que el dispositivo esté pareado (token válido). Sin esto, en el modo de
 * un solo negocio cualquiera en internet podría crear una cuenta —y la primera
 * se lleva rol Administrador—: el pareo es la autorización, y el código de pareo
 * solo lo da alguien con sesión en el CRM.
 *
 * El primer empleado del negocio es Administrador; el resto entra como Vendedora.
 */
export const POST = handler(async (req: NextRequest) => {
  // Pareo válido = token en la `device_pairing` del tenant (modo un-negocio /
  // código de 6 dígitos) O token de la central que YA resolvió este tenant
  // (multi-tenant: si el token fuera inválido, `handler()` habría cortado con
  // 401 antes de llegar acá — que haya tenant + token es la prueba del pareo).
  const pareadoCentral = isMultiTenant() && !!currentTenant() && !!deviceToken();
  if (!pareadoCentral && !(await deviceFromRequest())) {
    return unauthorized("Vinculá el dispositivo antes de crear una cuenta.");
  }

  const body = await req.json();
  const name: string = (body.name ?? "").trim();
  const phoneRaw: string = (body.phone ?? "").trim();
  const email: string | null = body.email?.trim() || null;
  const pass: string = body.pass ?? "";

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
    const row = await withTransaction(async (client) => {
      // Serializa las altas entre sí: sin esto, dos altas simultáneas en un
      // negocio nuevo podrían leer "0 empleados" a la vez y quedar las dos como
      // Administrador. El lock se libera al terminar la transacción.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('employee_register'))");
      const res = await client.query<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        role: string;
      }>(
        `INSERT INTO employees (name, phone, email, pass_hash, role)
         SELECT $1, $2, $3, crypt($4, gen_salt('bf')),
                CASE WHEN NOT EXISTS (SELECT 1 FROM employees WHERE active)
                     THEN 'Administrador' ELSE 'Vendedora' END
         RETURNING id, name, email, phone, role`,
        [name, phone, email, pass]
      );
      return res.rows[0];
    });

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
  } catch (err) {
    // 23505 = violación de índice único (teléfono o correo ya usados). Se
    // traduce a un mensaje claro en vez del 500 genérico. La comprobación va
    // sobre el índice, que es atómico: no hay carrera con un SELECT previo.
    if ((err as { code?: string } | null)?.code === "23505") {
      return bad("Ya existe una cuenta con ese teléfono o correo.");
    }
    throw err;
  }
});
