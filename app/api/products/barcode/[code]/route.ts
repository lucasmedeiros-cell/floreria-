import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/products/barcode/<código>
 *
 * Búsqueda por el código de barras FÍSICO del producto (EAN/UPC/Code128), que
 * es lo que devuelve el escáner de la app. Es una ruta aparte de
 * /api/products/[id] a propósito: ese busca por SKU (el código interno), y no
 * son lo mismo.
 *
 * 404 = ese código no está en el catálogo → la app abre el alta con el código
 * ya cargado.
 *
 * Solo empleados: es una consulta de inventario, no del catálogo público.
 */
export const GET = handler(async (_req: NextRequest, { params }: { params: { code: string } }) => {
  if (!getSession("employee")) return unauthorized();

  const code = decodeURIComponent(params.code ?? "").trim();
  if (!code) return notFound("Código vacío");

  const row = await queryOne(
    `SELECT id, name, description AS desc, price, cost, barcode, image, category,
            featured, stock, status
       FROM products
      WHERE barcode = $1`,
    [code]
  );

  return row ? ok(row) : notFound("No hay ningún producto con ese código de barras");
});
