// ============================================================
//  easy pos — la marca del PRODUCTO (el CRM), no la del negocio.
// ------------------------------------------------------------
//  Ojo con la distinción, que es la que ordena todo el sistema:
//   · easy pos  = el software (splash, login, chrome del panel). Fijo.
//   · el negocio = quien lo usa (florería, ferretería, …). Configurable
//     desde el CRM y define el color y los textos de la tienda (lib/rubros.ts).
//  Por eso la marca de easy pos NO cambia con el rubro.
// ============================================================

export const EASYPOS = {
  name: "easy pos",
  /** Amarillo de la marca (tomado del logo). */
  yellow: "#FEBB03",
  ink: "#000000",
  tagline: "PUNTO DE VENTA Y GESTIÓN",
  /** Logo original, por si se necesita como imagen (favicon, adjuntos, PDFs). */
  logo: "/images/easypos.png",
} as const;
