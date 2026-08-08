import { confirmarPagos } from "./vendedorCobro";
import { senderDelNegocio } from "./vendedorTransporte";
import {
  isMultiTenant,
  negociosEasyposActivos,
  runWithTenant,
  type Negocio,
} from "./tenant";

/**
 * Confirmador de pagos en segundo plano.
 *
 * El cliente paga el QR en su app del banco: no manda ningún mensaje, así que
 * nadie se enteraría del pago hasta que una persona revise. Por eso hay que
 * preguntarle al banco cada tanto.
 *
 * Corre en el proceso del sitio (lo arranca instrumentation.ts). Es un solo
 * proceso por despliegue, así que no hay dos confirmadores compitiendo; y aun si
 * los hubiera, la venta se crea con el código del pedido como clave única y no
 * se duplicaría.
 */

const CADA_MS = Number(process.env.VENDEDOR_COBRO_INTERVALO_MS ?? 30_000);

const g = globalThis as unknown as { __vendedorConfirmador?: NodeJS.Timeout };

/** Una pasada: revisa los cobros de cada negocio y avisa a los que pagaron. */
export async function unaPasada(): Promise<number> {
  const negocios: (Negocio | null)[] = isMultiTenant()
    ? await negociosEasyposActivos()
    : [null];

  let cobrados = 0;
  for (const negocio of negocios) {
    const trabajo = async () => {
      const pagados = await confirmarPagos();
      if (!pagados.length) return;
      cobrados += pagados.length;

      const sender = await senderDelNegocio();
      for (const p of pagados) {
        if (!sender) {
          console.warn(
            `[vendedor] pedido ${p.code} cobrado pero sin transporte para avisarle al cliente`
          );
          continue;
        }
        const aviso =
          `¡Pago confirmado! Tu pedido ${p.code} por Bs ${p.total} ya está pagado y lo estamos preparando. ` +
          `Tu comprobante es ${p.saleCode}.`;
        await sender.sendText(p.phone, aviso).catch((e) =>
          console.warn(`[vendedor] no pude avisar el pago de ${p.code}: ${e}`)
        );
      }
    };

    try {
      await (negocio ? runWithTenant(negocio, trabajo) : trabajo());
    } catch (e) {
      // Un negocio con la base caída no puede frenar a los demás.
      console.warn(`[vendedor] confirmador falló en ${negocio?.slug ?? "el negocio único"}: ${e}`);
    }
  }
  return cobrados;
}

/** Arranca el ciclo. Idempotente: dos llamadas no dejan dos temporizadores. */
export function arrancarConfirmador(): void {
  if (g.__vendedorConfirmador) return;
  console.log(`[vendedor] confirmador de pagos cada ${Math.round(CADA_MS / 1000)}s`);
  g.__vendedorConfirmador = setInterval(() => {
    unaPasada().catch((e) => console.warn(`[vendedor] confirmador: ${e}`));
  }, CADA_MS);
  // `unref` para que el temporizador no impida que el proceso termine cuando
  // pm2 lo reinicia.
  g.__vendedorConfirmador.unref?.();
}
