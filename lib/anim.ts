// ===== Configuración de animaciones de inicio =====
// Interruptores para activar/desactivar las animaciones desde el panel admin.

export interface AnimConfig {
  /** Animación de inicio en la web pública (rosa que pierde sus pétalos). */
  web: boolean;
  /** Animación de inicio del panel de administración (flor que florece). */
  admin: boolean;
}

export const defaultAnimConfig: AnimConfig = { web: true, admin: true };
