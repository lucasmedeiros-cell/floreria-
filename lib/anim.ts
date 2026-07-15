// ===== Configuración de animaciones de inicio =====
// Interruptores para activar/desactivar las animaciones desde el panel admin.

export interface AnimConfig {
  /** Animación de inicio en la web pública (intro con el logo del rubro). */
  web: boolean;
  /** Splash de inicio del CRM (logo de easy pos + negocio y rubro). */
  admin: boolean;
}

export const defaultAnimConfig: AnimConfig = { web: true, admin: true };
