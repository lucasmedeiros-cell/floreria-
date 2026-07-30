import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { bad, handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { esAdmin } from "@/lib/perms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// PATCH /api/employees/[id] — SOLO ADMINISTRADOR. Activa/desactiva un empleado
// y/o le asigna permisos (`perms`, p. ej. {"products": true} = puede registrar
// productos). Un empleado inactivo no puede iniciar sesión.
export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const s = getSession("employee");
  if (!s) return unauthorized();
  if (!(await esAdmin(s)))
    return bad("Solo el administrador puede gestionar usuarios.", 403);
  const b = await req.json();

  // Un admin no puede desactivarse a sí mismo (se quedaría afuera sin querer).
  if (params.id === s.sub && b.active === false) {
    return bad("No podés desactivar tu propia cuenta.");
  }

  // Guardado parcial: solo se toca lo que viene en el body.
  const setActive = typeof b.active === "boolean";
  const perms =
    b.perms && typeof b.perms === "object" && !Array.isArray(b.perms)
      ? { products: b.perms.products === true }
      : null;
  if (!setActive && !perms) return bad("Nada que actualizar.");

  const row = await queryOne(
    `UPDATE employees
        SET active = CASE WHEN $2::boolean IS NULL THEN active ELSE $2::boolean END,
            perms  = COALESCE($3::jsonb, perms)
      WHERE id = $1
     RETURNING id, name, email, phone, role, active,
               COALESCE(perms, '{}'::jsonb) AS perms`,
    [params.id, setActive ? b.active === true : null, perms ? JSON.stringify(perms) : null]
  );
  return row ? ok(row) : notFound("Empleado no encontrado");
});
