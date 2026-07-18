"use client";

import { NegocioEditor } from "./NegocioEditor";
import { ModulosEditor } from "./ModulosEditor";
import { PromoEditor } from "./PromoEditor";
import { AnimationEditor } from "./AnimationEditor";
import { VendedorEditor } from "./VendedorEditor";

export function ConfiguracionPage() {
  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div>
        <h1 className="text-[30px] font-semibold text-ink">Configuración</h1>
        <p className="mt-1 text-[13px] text-ink2">
          Rubro, módulos, marca, pagos, entregas y página pública
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {/* Rubro + datos del negocio (marca, colores, textos, categorías, pagos) */}
        <NegocioEditor />

        {/* Qué secciones del CRM usa este negocio */}
        <ModulosEditor />

        {/* La vinculación de dispositivos (QR) se hace desde Case
            (case.easypaybo.com), no desde el CRM del negocio. */}

        {/* Vendedor 24/7 (bot de WhatsApp con IA) */}
        <VendedorEditor />

        {/* Animaciones de inicio */}
        <AnimationEditor />

        {/* Landing promocional (un producto) */}
        <PromoEditor />
      </div>
    </div>
  );
}
