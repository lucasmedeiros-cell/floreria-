// ============================================================
//  Datos legales de easy pos (el PRODUCTO, no el negocio que lo usa).
// ------------------------------------------------------------
//  Los consumen /privacidad y /eliminar-cuenta, que son las dos URLs que hay que
//  pegar en la ficha de Google Play y de App Store. Las tiendas verifican que la
//  política de privacidad esté publicada y sea accesible sin iniciar sesión.
// ============================================================

export const LEGAL = {
  /** Razón social que publica la app en las tiendas. */
  empresa: "Petrobox Inc.",

  // TODO(lucas): confirmar estas tres antes de mandar la app a revisión.
  // Las tiendas rebotan una política con datos de contacto que no responden.
  /** Casilla a la que escribe un usuario por sus datos. Tiene que existir. */
  email: "privacidad@petroboxinc.com",
  /** País cuya ley rige el tratamiento. */
  jurisdiccion: "Bolivia",
  /** Última revisión del texto. Actualizar al cambiarlo. */
  actualizado: "14 de julio de 2026",
} as const;
