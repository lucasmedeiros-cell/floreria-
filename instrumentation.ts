/**
 * Arranque del proceso (Next lo llama una vez, al levantar el servidor).
 *
 * Existe por una sola razón: el WhatsApp por Baileys es un socket, y si nadie
 * lo abre no hay bot. Antes solo se abría cuando una persona entraba al panel y
 * apretaba "Generar QR", así que después de cada deploy o `pm2 restart` el
 * vendedor quedaba mudo —sin avisar— hasta que alguien se acordara de entrar.
 *
 * El trabajo real vive en `instrumentation-node.ts` y se importa SOLO en el
 * runtime de Node: si se importa acá, webpack intenta empaquetar Baileys
 * también para el runtime edge (que no tiene `fs` ni `crypto`) y el build falla.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
