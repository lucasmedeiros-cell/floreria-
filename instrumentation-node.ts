/**
 * Reconexión del WhatsApp del vendedor al levantar el proceso. Solo corre en
 * Node (lo importa `instrumentation.ts` bajo esa condición).
 *
 * Solo reconecta una sesión YA vinculada: si no hay credenciales guardadas no
 * hace nada, porque generar un QR que nadie va a escanear no sirve de nada.
 */
// Confirmador de pagos del vendedor: el cliente paga el QR en su banco y no
// manda ningún mensaje, así que hay que preguntarle al banco cada tanto.
if (process.env.VENDEDOR_COBRO_AUTO !== "false") {
  import("./lib/vendedorConfirmador")
    .then(({ arrancarConfirmador }) => arrancarConfirmador())
    .catch((e) => console.warn(`[vendedor] confirmador no arrancó: ${e}`));
}

if (process.env.WA_BAILEYS_AUTOSTART === "true") {
  import("./lib/whatsappBaileys")
    .then(async ({ baileys }) => {
      const wa = baileys();
      const numero = wa.getNumber();
      if (!numero) {
        console.log("[wa:baileys] sin sesión vinculada: no se arranca (vinculá desde el CRM)");
        return;
      }
      console.log(`[wa:baileys] reconectando la sesión de +${numero}…`);
      await wa.start();
    })
    // Que el vendedor no arranque no puede impedir que levante el sitio.
    .catch((e) => console.warn(`[wa:baileys] no se pudo arrancar al boot: ${e}`));
}

export {};
