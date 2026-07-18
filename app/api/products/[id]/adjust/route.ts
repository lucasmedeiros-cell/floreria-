import { NextRequest } from "next/server";
import { withTransaction } from "@/lib/db";
import { bad, handler, notFound, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

/**
 * POST /api/products/[id]/adjust  { delta, reason }
 * Ajuste manual de stock (merma, conteo físico, corrección). `delta` puede ser
 * negativo. Actualiza el stock y deja el movimiento registrado con su motivo.
 */
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const s = getSession("employee");
  if (!s) return unauthorized();
  const b = await req.json();
  const delta = Math.round(Number(b.delta));
  if (!Number.isFinite(delta) || delta === 0) return bad("El ajuste no puede ser 0.");
  const reason = (b.reason ?? "").toString().trim();

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query<{ stock: number }>(
      `SELECT stock FROM products WHERE id = $1 FOR UPDATE`,
      [params.id]
    );
    if (rows.length === 0) return null;
    const nuevo = Math.max(0, rows[0].stock + delta);
    await client.query(
      `UPDATE products SET stock = $2, updated_at = now() WHERE id = $1`,
      [params.id, nuevo]
    );
    await client.query(
      `INSERT INTO stock_moves (product_id, delta, reason, stock_after, created_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [params.id, delta, reason, nuevo, s.name ?? ""]
    );
    return { stock: nuevo };
  });

  return result ? ok(result) : notFound("Producto no encontrado");
});
