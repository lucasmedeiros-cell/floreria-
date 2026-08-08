/**
 * Arranque del proceso: lo que tiene que quedar andando sin que nadie entre a
 * una pantalla.
 */

// Confirmador de pagos del vendedor: el cliente paga el QR en su banco y no
// manda ningún mensaje, así que hay que preguntarle al banco cada tanto.
if (process.env.VENDEDOR_COBRO_AUTO !== "false") {
  import("./lib/vendedorConfirmador")
    .then(({ arrancarConfirmador }) => arrancarConfirmador())
    .catch((e) => console.warn(`[vendedor] confirmador no arrancó: ${e}`));
}

/**
 * WhatsApp por QR: se reconectan TODAS las sesiones que había en disco, una por
 * negocio. Antes solo se abría cuando alguien entraba al panel y apretaba
 * "Generar QR", así que después de cada deploy el vendedor quedaba mudo —sin
 * avisar— hasta que alguien se acordara de entrar.
 *
 * Solo reconecta sesiones YA vinculadas: generar un QR que nadie va a escanear
 * no sirve de nada.
 */
if (process.env.WA_BAILEYS_AUTOSTART !== "false") {
  import("./lib/whatsappBaileys")
    .then(async ({ baileys, sesionesGuardadas }) => {
      const slugs = sesionesGuardadas();
      if (!slugs.length) {
        console.log("[wa:baileys] no hay sesiones guardadas (vinculá desde el panel)");
        return;
      }
      for (const slug of slugs) {
        const wa = baileys(slug);
        console.log(`[wa:baileys][${slug}] reconectando la sesión de +${wa.getNumber()}…`);
        await wa.start().catch((e) => console.warn(`[wa:baileys][${slug}] ${e}`));
      }
    })
    // Que el vendedor no arranque no puede impedir que levante el sitio.
    .catch((e) => console.warn(`[wa:baileys] no se pudo arrancar al boot: ${e}`));
}

export {};
