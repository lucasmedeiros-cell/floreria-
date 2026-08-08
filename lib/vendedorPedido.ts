import { query, queryOne, withTransaction } from "./db";

/**
 * El pedido que cierra el Vendedor 24/7 entra al POS como un pedido de verdad.
 *
 * Antes el bot cotizaba, mandaba el QR y ahí terminaba: la plata podía entrar y
 * en el sistema no quedaba ni el pedido ni la venta, solo el chat. Alguien tenía
 * que mirar WhatsApp y cargarlo a mano.
 *
 * El bot avisa que el cliente confirmó con un marcador al final de su mensaje:
 *
 *   [PEDIDO: 2xHHG-30, 1xHHC-8 | Av. Cristo Redentor 123 | Juan Pérez]
 *
 * Los ítems son `cantidad x SKU` (el SKU sale del catálogo que ve el bot).
 * Dirección y nombre son opcionales. El marcador NO se le muestra al cliente:
 * lo saca el motor antes de enviar.
 */

export interface ItemPedido {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface PedidoCreado {
  code: string;
  items: ItemPedido[];
  total: number;
}

const MARCADOR = /\[PEDIDO:([^\]]*)\]/i;

/** Saca el marcador del texto que ve el cliente. */
export function limpiarMarcadorPedido(texto: string): string {
  return texto.replace(/\[PEDIDO:[^\]]*\]/gi, "").trim();
}

/** Normaliza para comparar nombres: sin acentos, sin dobles espacios, minúsculas. */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Resuelve un ítem escrito por el bot contra el catálogo real.
 *
 * Va por SKU primero, que es lo que se le pide; después por nombre exacto y por
 * último por coincidencia parcial. Se resuelve contra la BD y no contra lo que
 * escribió el bot para que el PRECIO sea siempre el del catálogo: si el modelo
 * se equivoca en un número, el pedido igual entra bien.
 */
type ProductoResuelto = { id: string; name: string; price: number; stock: number };

async function resolverProducto(referencia: string): Promise<ProductoResuelto | null> {
  const ref = referencia.trim();
  if (!ref) return null;

  const exacto = await queryOne<ProductoResuelto>(
    `SELECT id, name, price, coalesce(stock, 0) AS stock FROM products
      WHERE lower(id) = lower($1) OR lower(name) = lower($1)
      LIMIT 1`,
    [ref]
  );
  if (exacto) return exacto;

  const parecido = await queryOne<ProductoResuelto>(
    `SELECT id, name, price, coalesce(stock, 0) AS stock FROM products
      WHERE COALESCE(status, 'activo') = 'activo' AND name ILIKE '%' || $1 || '%'
      ORDER BY length(name) ASC
      LIMIT 1`,
    [ref]
  );
  return parecido ?? null;
}

/**
 * ¿El negocio lleva inventario? Si NINGÚN producto tiene stock, no lo lleva, y
 * entonces no se puede usar el stock para limitar el pedido: se rechazaría todo.
 */
async function llevaStock(): Promise<boolean> {
  const fila = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM products WHERE coalesce(stock, 0) > 0`
  );
  return Number(fila?.n ?? 0) > 0;
}

/** "2xHHG-30" | "2 x HHG-30" | "HHG-30 x2" → { ref, qty } */
function partirItem(crudo: string): { ref: string; qty: number } | null {
  const s = crudo.trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,3})\s*[x*×]\s*(.+)$/i);
  if (m) return { qty: parseInt(m[1], 10), ref: m[2] };
  m = s.match(/^(.+?)\s*[x*×]\s*(\d{1,3})$/i);
  if (m) return { qty: parseInt(m[2], 10), ref: m[1] };
  // Sin cantidad: se asume uno.
  return { qty: 1, ref: s };
}

/**
 * Crea el pedido en el POS a partir del marcador. Devuelve null si no hay
 * marcador, si no se pudo resolver ningún producto, o si ya se creó uno para
 * este teléfono hace poco.
 */
export async function crearPedidoDesdeMarcador(
  textoDelBot: string,
  phone: string,
  nombreContacto: string
): Promise<PedidoCreado | null> {
  const m = textoDelBot.match(MARCADOR);
  if (!m) return null;

  const partes = m[1].split("|").map((p) => p.trim());
  const itemsCrudos = (partes[0] ?? "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const direccion = partes[1] ?? "";
  const nombre = (partes[2] || nombreContacto || "").trim() || "Cliente de WhatsApp";

  const conStock = await llevaStock();
  const items: ItemPedido[] = [];
  for (const crudo of itemsCrudos) {
    const partido = partirItem(crudo);
    if (!partido) continue;
    const prod = await resolverProducto(partido.ref);
    if (!prod) {
      console.warn(`[vendedor] pedido: no encontré "${partido.ref}" en el catálogo, lo salteo`);
      continue;
    }

    let qty = Math.max(1, partido.qty);

    // El pedido no puede llevarse más de lo que hay: si no, la venta deja el
    // inventario en negativo y se prometió algo que no se puede entregar.
    // Solo aplica si el negocio lleva stock (si no, todo estaría en cero).
    if (conStock) {
      if (prod.stock <= 0) {
        console.warn(`[vendedor] pedido: ${prod.id} sin stock, no lo cargo`);
        continue;
      }
      if (qty > prod.stock) {
        console.warn(
          `[vendedor] pedido: pidieron ${qty} de ${prod.id} y hay ${prod.stock}; cargo ${prod.stock}`
        );
        qty = prod.stock;
      }
    }

    // Si el bot repite el mismo producto, se suman las cantidades (sin pasarse
    // del stock disponible).
    const ya = items.find((i) => i.productId === prod.id);
    if (ya) {
      ya.qty = conStock ? Math.min(prod.stock, ya.qty + qty) : ya.qty + qty;
    } else {
      items.push({
        productId: prod.id,
        name: prod.name,
        qty,
        unitPrice: Number(prod.price) || 0,
      });
    }
  }

  if (!items.length) {
    console.warn(`[vendedor] pedido con marcador pero sin ítems reconocibles: "${m[1]}"`);
    return null;
  }

  // El modelo puede repetir el marcador en el mensaje siguiente. Sin esto, un
  // cliente terminaría con tres pedidos iguales por la misma compra.
  const reciente = await queryOne<{ code: string }>(
    `SELECT code FROM orders
      WHERE phone = $1 AND channel = 'whatsapp'
        AND created_at > now() - interval '30 minutes'
      ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (reciente) {
    console.log(`[vendedor] ya había un pedido reciente de ${phone} (${reciente.code}); no duplico`);
    return null;
  }

  const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  const creado = await withTransaction(async (c) => {
    const code = `PED-${(await c.query(`SELECT nextval('order_code_seq') AS n`)).rows[0].n}`;
    const o = (
      await c.query(
        `INSERT INTO orders (code, client_name, phone, address, delivery_date,
              status, pay_method, order_notes, channel, created_by)
         VALUES ($1,$2,$3,$4,current_date,'programado',$5,$6,'whatsapp','Vendedor 24/7')
         RETURNING id, code`,
        [
          code,
          nombre,
          phone,
          direccion,
          "QR / Transferencia",
          "Pedido tomado por el Vendedor 24/7 por WhatsApp. Confirmar el pago antes de despachar.",
        ]
      )
    ).rows[0];

    for (const it of items) {
      await c.query(
        `INSERT INTO order_items (order_id, product_id, name, qty, unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [o.id, it.productId, it.name, it.qty, it.unitPrice]
      );
    }
    return o as { id: string; code: string };
  });

  console.log(
    `[vendedor] pedido ${creado.code} creado desde WhatsApp: ${items
      .map((i) => `${i.qty}x${i.productId}`)
      .join(", ")} · Bs ${total}`
  );
  return { code: creado.code, items, total };
}

/** ¿Este teléfono ya tiene pedidos tomados por el bot? (para el resumen del CRM) */
export async function pedidosDelTelefono(phone: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM orders WHERE phone = $1 AND channel = 'whatsapp'`,
    [phone]
  );
  return Number(rows[0]?.n ?? 0);
}
