/**
 * Nombres de los headers del pareo. Módulo aparte y SIN dependencias a
 * propósito: lo importa `middleware.ts`, que corre en el edge runtime y no
 * puede cargar `pg` (ni nada que use `crypto` de Node). Si esto viviera en
 * `lib/tenantRequest.ts`, el middleware se traería media base de datos encima y
 * reventaría al arrancar.
 */

/** Slug del negocio (`/n/<slug>`). Lo escribe el middleware, nunca el cliente. */
export const NEGOCIO_HEADER = "x-negocio";

/** Token de pareo del dispositivo (app móvil). */
export const DEVICE_HEADER = "x-device-token";
