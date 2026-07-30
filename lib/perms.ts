import { queryOne } from "./db";

/**
 * Permisos por empleado (columna `employees.perms`, migración 012).
 *
 * Siempre se consulta la BASE, no el rol estampado en el token de sesión: si el
 * administrador le quita un permiso (o lo desactiva) a alguien con sesión
 * abierta, el cambio aplica en la request siguiente, no cuando venza el token.
 */

interface EmployeeRow {
  role: string;
  active: boolean;
  perms: Record<string, unknown> | null;
}

async function empleado(id: string): Promise<EmployeeRow | null> {
  return queryOne<EmployeeRow>(
    `SELECT role, active, COALESCE(perms, '{}'::jsonb) AS perms
       FROM employees WHERE id = $1`,
    [id]
  );
}

/** ¿La sesión pertenece a un Administrador activo? */
export async function esAdmin(session: { sub: string }): Promise<boolean> {
  const e = await empleado(session.sub);
  return !!e && e.active && e.role === "Administrador";
}

/**
 * ¿Puede registrar/editar productos del inventario?
 * Administrador → siempre. Resto → solo con la bandera `products` que le
 * asigna el administrador (por defecto NO: una vendedora vende, no cataloga).
 */
export async function puedeGestionarProductos(session: { sub: string }): Promise<boolean> {
  const e = await empleado(session.sub);
  if (!e || !e.active) return false;
  if (e.role === "Administrador") return true;
  return e.perms?.["products"] === true;
}
