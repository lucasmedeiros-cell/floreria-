import { NextRequest } from "next/server";
import { bad, handler, ok, unauthorized } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { senderDelNegocio } from "@/lib/vendedorTransporte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bandeja del Vendedor 24/7: ver las charlas y poder meterse.
 *
 * Hasta ahora el bot atendía solo y no había forma de intervenir: si una venta
 * se trababa, la única salida era editar la base a mano. La columna
 * `bot_active` ya existía y el motor la respeta; lo que faltaba era manejarla.
 *
 * GET  ?phone=…  → los mensajes de esa charla
 * GET            → la lista de charlas
 * POST { phone, action: "tomar" | "devolver" }  → control humano
 * POST { phone, text }                          → responder como persona
 */

interface FilaCharla {
  phone: string;
  name: string;
  botActive: boolean;
  campaign: string | null;
  lastMessageAt: string;
  ultimo: string | null;
  mensajes: number;
  pedidos: number;
}

export const GET = handler(async (req: NextRequest) => {
  if (!getSession("employee")) return unauthorized();
  const phone = req.nextUrl.searchParams.get("phone");

  if (phone) {
    const mensajes = await query(
      `SELECT direction, body, from_bot AS "fromBot", created_at AS "createdAt"
         FROM wa_messages WHERE phone = $1
        ORDER BY created_at ASC LIMIT 200`,
      [phone]
    );
    const charla = await queryOne(
      `SELECT phone, name, bot_active AS "botActive", campaign,
              last_message_at AS "lastMessageAt"
         FROM wa_conversations WHERE phone = $1`,
      [phone]
    );
    // Los pedidos de este teléfono, para no tener que ir a buscarlos a Pedidos.
    const pedidos = await query(
      `SELECT code, status::text AS status, paid_at AS "paidAt",
              (SELECT sum(qty * unit_price)::float FROM order_items i WHERE i.order_id = o.id) AS total
         FROM orders o WHERE phone = $1 ORDER BY created_at DESC LIMIT 5`,
      [phone]
    );
    return ok({ charla, mensajes, pedidos });
  }

  const charlas = await query<FilaCharla>(
    `SELECT c.phone, c.name, c.bot_active AS "botActive", c.campaign,
            c.last_message_at AS "lastMessageAt",
            (SELECT body FROM wa_messages m WHERE m.phone = c.phone
              ORDER BY m.created_at DESC LIMIT 1) AS ultimo,
            (SELECT count(*) FROM wa_messages m WHERE m.phone = c.phone) AS mensajes,
            (SELECT count(*) FROM orders o WHERE o.phone = c.phone) AS pedidos
       FROM wa_conversations c
      ORDER BY c.last_message_at DESC NULLS LAST
      LIMIT 100`
  );
  return ok({ charlas });
});

export const POST = handler(async (req: NextRequest) => {
  const sesion = getSession("employee");
  if (!sesion) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as {
    phone?: string;
    action?: string;
    text?: string;
  };
  const phone = (b.phone ?? "").trim();
  if (!phone) return bad("Falta el teléfono de la charla.");

  if (b.action === "tomar" || b.action === "devolver") {
    const activo = b.action === "devolver";
    const fila = await queryOne<{ bot_active: boolean }>(
      `UPDATE wa_conversations SET bot_active = $2 WHERE phone = $1
       RETURNING bot_active`,
      [phone, activo]
    );
    if (!fila) return bad("Esa charla no existe.");
    // Queda en el historial de la charla, así se ve quién y cuándo intervino.
    await query(
      `INSERT INTO wa_messages (phone, direction, body, from_bot)
         VALUES ($1, 'out', $2, false)`,
      [
        phone,
        activo
          ? `— ${sesion.name} le devolvió la charla al bot —`
          : `— ${sesion.name} tomó el control de la charla —`,
      ]
    );
    return ok({ botActive: fila.bot_active });
  }

  const text = (b.text ?? "").trim();
  if (!text) return bad("Escribí un mensaje.");

  const sender = await senderDelNegocio();
  if (!sender) {
    return bad(
      "No hay WhatsApp conectado para este negocio: no puedo enviar el mensaje."
    );
  }

  await sender.sendText(phone, text);
  // `from_bot: false` — lo escribió una persona, y así se distingue en la
  // bandeja y en el historial que ve el modelo.
  await query(
    `INSERT INTO wa_messages (phone, direction, body, from_bot)
       VALUES ($1, 'out', $2, false)`,
    [phone, text]
  );
  await query(
    `UPDATE wa_conversations SET last_message_at = now() WHERE phone = $1`,
    [phone]
  );
  return ok({ enviado: true });
});
