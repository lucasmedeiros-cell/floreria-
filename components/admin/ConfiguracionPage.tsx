"use client";

import { NegocioEditor } from "./NegocioEditor";
import { PromoEditor } from "./PromoEditor";

/**
 * Configuración — lo único que un negocio necesita tocar para que su tienda web
 * y su landing salgan con su cara: nombre, logo, rubro, contacto/pagos y las
 * páginas promocionales.
 *
 * Se sacó a propósito todo lo que no era del negocio sino del sistema:
 *   · Módulos del CRM — el menú ahora es fijo (el mismo de la app de escritorio),
 *     así que no había nada que prender ni apagar.
 *   · Vendedor 24/7 y Animaciones — se administran desde el panel de easy pos.
 *   · Vinculación de dispositivos (QR) — también vive en el panel (/panel).
 */
export function ConfiguracionPage() {
  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div>
        <h1 className="font-serif text-[30px] font-semibold text-ink">Configuración</h1>
        <p className="mt-1 text-[13px] text-ink2">
          Tu negocio (nombre, logo, contacto) y tu página promocional.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {/* Rubro + datos del negocio: nombre, logo, categorías, contacto y pagos.
            El logo que se carga acá es el que sale en la tienda web y en la landing. */}
        <NegocioEditor />

        {/* Landings promocionales (una o varias páginas públicas de oferta) */}
        <PromoEditor />
      </div>
    </div>
  );
}
