// ============================================================
//  Módulos del CRM — qué secciones usa este negocio.
// ------------------------------------------------------------
//  No todos los negocios necesitan lo mismo: una florería vive de las entregas,
//  una tienda de repuestos vende sobre el mostrador y no reparte nada. Cada
//  negocio prende y apaga sus módulos desde Configuración → Módulos del CRM, y
//  el menú lateral (y lo que cuelga de cada módulo) se arma con eso.
//
//  Un módulo apagado NO borra datos: los pedidos, las entregas y los clientes
//  siguen en la base. Solo deja de mostrarse. Prenderlo de vuelta lo devuelve
//  todo tal cual estaba.
// ============================================================

import type { RubroId } from "./rubros";

/**
 * Módulos que se pueden apagar. Adrede NO están acá: Inicio, Pedidos y
 * Configuración — son el mínimo con el que el CRM sigue siendo usable (y sin
 * Configuración no habría forma de volver a prender lo que se apagó).
 */
export type ModuleId =
  | "agenda"
  | "clientes"
  | "productos"
  | "entregas"
  | "reportes"
  | "usuarios";

export interface ModuleDef {
  id: ModuleId;
  label: string;
  /** Qué se pierde al apagarlo, dicho en criollo. */
  hint: string;
}

export const MODULE_LIST: ModuleDef[] = [
  { id: "agenda", label: "Agenda", hint: "Calendario de pedidos por fecha de entrega." },
  { id: "clientes", label: "Clientes", hint: "Libreta de clientes con su historial de compras." },
  { id: "productos", label: "Productos", hint: "Catálogo: altas, precios y stock." },
  {
    id: "entregas",
    label: "Entregas",
    hint: "Reparto a domicilio. Apagado, el CRM tampoco pide repartidor ni costo de envío al cargar un pedido.",
  },
  { id: "reportes", label: "Reportes", hint: "Ventas, gastos y ganancias." },
  { id: "usuarios", label: "Usuarios", hint: "Empleados que entran al CRM." },
];

export type Modules = Record<ModuleId, boolean>;

const TODOS: Modules = {
  agenda: true,
  clientes: true,
  productos: true,
  entregas: true,
  reportes: true,
  usuarios: true,
};

/**
 * Con qué módulos arranca un negocio según su rubro. Es solo el punto de
 * partida: se cambia desde el CRM cuando quiera.
 *
 * Los rubros que no están acá arrancan con TODO prendido, así que agregar un
 * rubro nuevo a `lib/rubros.ts` no obliga a tocar este archivo.
 */
const POR_RUBRO: Partial<Record<RubroId, Partial<Modules>>> = {
  // Mostrador: se vende y se entrega en el acto, no hay reparto ni agenda.
  ferreteria: { entregas: false, agenda: false },
  repuestos: { entregas: false, agenda: false },
  tecnologia: { entregas: false, agenda: false },
  boutique: { entregas: false, agenda: false },
  minimarket: { entregas: false, agenda: false },
  farmacia: { agenda: false },
  // Florería y restaurante sí reparten (el default ya es todo prendido).
};

export function defaultModules(rubroId: RubroId): Modules {
  return { ...TODOS, ...(POR_RUBRO[rubroId] ?? {}) };
}

/** Completa una config guardada (a la que puede faltarle un módulo nuevo). */
export function normalizeModules(
  raw: Partial<Modules> | null | undefined,
  rubroId: RubroId
): Modules {
  return { ...defaultModules(rubroId), ...(raw ?? {}) };
}
