import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { bad, handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// PATCH /api/employees/[id] — activa o desactiva un empleado. Un empleado
// inactivo no puede iniciar sesión (el login filtra por `active`).
export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const s = getSession("employee");
  if (!s) return unauthorized();
  const b = await req.json();

  // Un admin no puede desactivarse a sí mismo (se quedaría afuera sin querer).
  if (params.id === s.sub && b.active === false) {
    return bad("No podés desactivar tu propia cuenta.");
  }

  const row = await queryOne(
    `UPDATE employees SET active = $2 WHERE id = $1
     RETURNING id, name, email, phone, role, active`,
    [params.id, b.active === true]
  );
  return row ? ok(row) : notFound("Empleado no encontrado");
});
