import { query, queryOne, withTransaction } from "./db";
import { consultarEstado } from "./baas";

/**
 * Cierre del cobro del Vendedor 24/7: del QR a la venta.
 *
 * El bot manda el QR del banco y ahí terminaba todo. Ahora el pedido guarda su
 * correlativo, y este módulo le pregunta al banco si ya pagaron; cuando está
 * pagado crea la VENTA (factura), descuenta el stock y deja el pedido cerrado.
 *
 * Nada de esto confía en la palabra del cliente: la única fuente de verdad es la
 * respuesta del BaaS. El aviso "ya pagué" por WhatsApp no cierra nada.
 */

/** Guarda en el pedido el QR que se le mandó, para poder consultarlo después. */
export async function registrarCobro(
  orderCode: string,
  correlativo: string | undefined,
  qrId: number | string | undefined,
  amount: number
): Promise<void> {
  if (!correlativo && qrId == null) return;
  await query(
    `UPDATE orders
        SET qr_correlativo = $2, qr_id = $3, qr_amount = $4, qr_sent_at = now()
      WHERE code = $1`,
    [orderCode, correlativo ?? null, qrId != null ? String(qrId) : null, amount]
  );
}

export interface PedidoCobrado {
  code: string;
  phone: string;
  clientName: string;
  total: number;
  saleCode: string;
  /** Productos que quedaron en negativo al descontar (señal de descuadre). */
  stockEnNegativo: string[];
}

interface PendienteRow {
  id: string;
  code: string;
  phone: string;
  client_name: string;
  qr_correlativo: string;
  qr_id: string | null;
  qr_amount: string | null;
}

/**
 * Pedidos con QR mandado y todavía sin pagar. Se limita a las últimas 48 h: un
 * QR viejo ya venció y seguir consultándolo es pegarle al banco de gusto.
 */
async function pendientes(): Promise<PendienteRow[]> {
  return query<PendienteRow>(
    `SELECT id, code, phone, client_name, qr_correlativo, qr_id, qr_amount::text
       FROM orders
      WHERE qr_correlativo IS NOT NULL
        AND paid_at IS NULL
        AND status <> 'cancelado'
        AND qr_sent_at > now() - interval '48 hours'
      ORDER BY qr_sent_at
      LIMIT 40`
  );
}

/**
 * Crea la venta del pedido y descuenta stock, en una sola transacción.
 *
 * `client_ref` va con el código del pedido, que tiene índice único: si el
 * confirmador corre dos veces sobre el mismo pedido, la segunda no duplica la
 * venta — devuelve la que ya estaba.
 */
export async function liquidarPedido(
  pedido: PendienteRow,
  referencia: string | null
): Promise<{ code: string; stockEnNegativo: string[] }> {
  return withTransaction(async (c) => {
    const yaEsta = await c.query<{ code: string }>(
      `SELECT code FROM sales WHERE client_ref = $1`,
      [pedido.code]
    );
    if (yaEsta.rows[0]) return { code: yaEsta.rows[0].code, stockEnNegativo: [] };

    const items = (
      await c.query<{ product_id: string | null; name: string; qty: number; unit_price: string }>(
        `SELECT product_id, name, qty, unit_price::text FROM order_items WHERE order_id = $1`,
        [pedido.id]
      )
    ).rows;

    const total = items.reduce((s, i) => s + i.qty * Number(i.unit_price), 0);

    // Misma numeración que el POS: el lock evita que dos ventas simultáneas
    // tomen el mismo número.
    await c.query("SELECT pg_advisory_xact_lock(hashtext('sale_factura'))");
    const cnt = await c.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sales WHERE kind = 'factura'::sale_kind`
    );
    const code = `FAC-${(Number(cnt.rows[0].n) + 1).toString().padStart(6, "0")}`;

    const venta = (
      await c.query<{ id: string; code: string }>(
        `INSERT INTO sales (code, kind, client_name, client_phone, client_nit,
                            subtotal, discount, total, pay_method, notes, created_by, client_ref)
         VALUES ($1,'factura'::sale_kind,$2,$3,'',$4,0,$4,'QR / Transferencia',$5,'Vendedor 24/7',$6)
         RETURNING id, code`,
        [
          code,
          pedido.client_name || "Cliente de WhatsApp",
          pedido.phone,
          total.toFixed(2),
          `Cobro por QR del pedido ${pedido.code}.${referencia ? ` Operación ${referencia}.` : ""}`,
          pedido.code,
        ]
      )
    ).rows[0];

    const stockEnNegativo: string[] = [];
    for (const it of items) {
      await c.query(
        `INSERT INTO sale_items (sale_id, product_id, sku, name, qty, unit_price, discount_pct)
         VALUES ($1,$2,$3,$4,$5,$6,0)`,
        [venta.id, it.product_id, it.product_id ?? "", it.name, it.qty, it.unit_price]
      );
      if (it.product_id) {
        // Igual que el POS: se resta sin clampear. Si queda negativo es que el
        // conteo estaba mal, y anular la venta devuelve el inventario exacto.
        const r = await c.query<{ stock: number }>(
          `UPDATE products SET stock = stock - $2, updated_at = now()
            WHERE id = $1 RETURNING stock`,
          [it.product_id, it.qty]
        );
        if (r.rows[0] && r.rows[0].stock < 0) stockEnNegativo.push(it.product_id);
      }
    }

    await c.query(
      `UPDATE orders
          SET paid_at = now(), paid_reference = $2, sale_id = $3, status = 'entregado'
        WHERE id = $1`,
      [pedido.id, referencia, venta.id]
    );

    return { code: venta.code, stockEnNegativo };
  });
}

/**
 * Revisa los cobros pendientes del negocio activo y cierra los que ya pagaron.
 *
 * Devuelve los pedidos cobrados para que quien llama avise al cliente por
 * WhatsApp. No manda mensajes: así se puede llamar desde el confirmador de
 * fondo o desde una ruta sin arrastrar el transporte.
 */
export async function confirmarPagos(): Promise<PedidoCobrado[]> {
  const lista = await pendientes();
  if (!lista.length) return [];

  const cobrados: PedidoCobrado[] = [];
  for (const p of lista) {
    try {
      const estado = await consultarEstado(p.qr_correlativo, p.qr_id);
      if (!estado.pagado) continue;

      const venta = await liquidarPedido(p, estado.operationNumber ?? null);
      const total = Number(p.qr_amount ?? 0) || estado.amount || 0;
      cobrados.push({
        code: p.code,
        phone: p.phone,
        clientName: p.client_name,
        total,
        saleCode: venta.code,
        stockEnNegativo: venta.stockEnNegativo,
      });
      console.log(
        `[vendedor] pago confirmado del pedido ${p.code} → venta ${venta.code} por Bs ${total}` +
          (venta.stockEnNegativo.length
            ? ` · OJO: stock negativo en ${venta.stockEnNegativo.join(", ")}`
            : "")
      );
    } catch (e) {
      // Un pedido que falla no puede frenar a los demás.
      console.warn(`[vendedor] no pude confirmar el pedido ${p.code}: ${e}`);
    }
  }
  return cobrados;
}

/**
 * Un pedido listo para liquidar, buscado por su código. Lo usa el cobro manual:
 * el cliente pagó por transferencia y mandó el comprobante, así que el negocio
 * lo marca a mano y la venta se genera igual que con el QR.
 */
export async function pedidoParaLiquidar(code: string): Promise<PendienteRow | null> {
  return queryOne<PendienteRow>(
    `SELECT id, code, phone, client_name, coalesce(qr_correlativo,'') AS qr_correlativo,
            qr_id, qr_amount::text
       FROM orders WHERE code = $1 AND paid_at IS NULL`,
    [code]
  );
}

/**
 * El pedido abierto de este teléfono: el último de WhatsApp sin pagar.
 *
 * Hace falta porque el QR no siempre se manda en el mismo mensaje en que se toma
 * el pedido: el cliente puede pedirlo después. Sin esto, el QR salía SIN quedar
 * ligado a ningún pedido y el confirmador no tenía qué consultarle al banco —
 * el cobro no se cerraba nunca.
 */
export async function pedidoAbiertoDelTelefono(
  phone: string
): Promise<{ code: string; total: number } | null> {
  const fila = await queryOne<{ code: string; total: string | null }>(
    `SELECT o.code,
            (SELECT sum(qty * unit_price)::text FROM order_items i WHERE i.order_id = o.id) AS total
       FROM orders o
      WHERE o.phone = $1 AND o.channel = 'whatsapp'
        AND o.paid_at IS NULL AND o.status <> 'cancelado'
      ORDER BY o.created_at DESC
      LIMIT 1`,
    [phone]
  );
  return fila ? { code: fila.code, total: Number(fila.total ?? 0) } : null;
}

/**
 * Resumen del cobro para que el BOT no invente. Sin esto, el cliente escribía
 * "ya pagué" y el bot le contestaba "pago confirmado" sin que el banco hubiera
 * acreditado nada.
 */
export async function contextoDeCobro(phone: string): Promise<string> {
  const fila = await queryOne<{ code: string; pagado: boolean; conQr: boolean; total: string | null }>(
    `SELECT code, (paid_at IS NOT NULL) AS pagado, (qr_correlativo IS NOT NULL) AS "conQr",
            (SELECT sum(qty * unit_price)::text FROM order_items i WHERE i.order_id = o.id) AS total
       FROM orders o
      WHERE o.phone = $1 AND o.channel = 'whatsapp' AND o.status <> 'cancelado'
      ORDER BY o.created_at DESC LIMIT 1`,
    [phone]
  );
  if (!fila) return "";
  if (fila.pagado) {
    return `Estado del cobro: el pedido ${fila.code} está PAGADO y verificado por el banco. Podés confirmar la entrega.`;
  }
  return [
    `Estado del cobro: el pedido ${fila.code} por Bs ${Number(fila.total ?? 0)} está PENDIENTE DE PAGO`,
    fila.conQr ? "(ya se le mandó el QR)" : "(todavía no se le mandó el QR)",
    "— el banco NO lo acreditó.",
    "Si el cliente dice que ya pagó, NO se lo confirmes: decile que estás verificando y que en cuanto se acredite le avisás.",
    "El sistema le manda la confirmación solo cuando el banco la acredita.",
  ].join(" ");
}

/** ¿Este pedido ya está cobrado? Lo usa la bandeja para mostrarlo. */
export async function estadoCobro(orderCode: string) {
  return queryOne<{ code: string; paid_at: Date | null; sale_id: string | null }>(
    `SELECT code, paid_at, sale_id FROM orders WHERE code = $1`,
    [orderCode]
  );
}
