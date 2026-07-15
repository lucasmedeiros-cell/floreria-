"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { EASYPOS } from "@/lib/easypos";
import { useBusiness } from "@/context/StoreProvider";

/** Duración total antes de empezar a desvanecer (ms). */
const HOLD = 1900;
const FADE = 500;

/**
 * Splash de inicio del CRM: el logo de easy pos (el producto) y, debajo, el
 * negocio que está usando el panel y su rubro.
 *
 * El logo es el archivo original (/images/easypos.png), no una reconstrucción
 * tipográfica: así no depende de que una fuente se parezca a la de la marca.
 * La animación es una sola entrada suave por elemento (sin rebotes ni escalas
 * encadenadas) y una barra de carga que marca el tiempo del splash.
 *
 * La marca del splash es SIEMPRE easy pos: lo que cambia con el rubro es el
 * negocio nombrado abajo. Se puede apagar en Configuración → Animaciones.
 */
export function EasyPosSplash({ enabled }: { enabled: boolean }) {
  const business = useBusiness();
  const [gone, setGone] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const t1 = setTimeout(() => setGone(true), HOLD);
    const t2 = setTimeout(() => setShow(false), HOLD + FADE + 150);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [enabled]);

  if (!enabled || !show) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] grid place-items-center bg-white transition-opacity ease-out ${
        gone ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE}ms` }}
    >
      <div className="flex flex-col items-center px-6 text-center">
        {/* Logo original de easy pos */}
        <Image
          src={EASYPOS.logo}
          alt={EASYPOS.name}
          width={150}
          height={150}
          priority
          className="rounded-[18px] shadow-[0_18px_45px_-16px_rgba(0,0,0,0.4)]"
          style={{ animation: "splash-logo-in 620ms cubic-bezier(0.22,1,0.36,1) both" }}
        />

        <p
          className="mt-6 text-[0.6rem] font-bold uppercase tracking-[4px] text-black/40"
          style={{ animation: "splash-rise 500ms cubic-bezier(0.22,1,0.36,1) 240ms both" }}
        >
          {EASYPOS.tagline}
        </p>

        {/* El negocio (el inquilino) y su rubro */}
        <p
          className="mt-3.5 text-[1.4rem] font-extrabold leading-none tracking-[-0.4px] text-ink"
          style={{ animation: "splash-rise 500ms cubic-bezier(0.22,1,0.36,1) 360ms both" }}
        >
          {business.name}
        </p>
        <p
          className="mt-2.5 rounded-full bg-black/[0.06] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[1.5px] text-black/55"
          style={{ animation: "splash-rise 500ms cubic-bezier(0.22,1,0.36,1) 460ms both" }}
        >
          {business.rubro.label}
        </p>

        {/* Barra de carga: dura exactamente lo que dura el splash. */}
        <span className="mt-8 h-[3px] w-[132px] overflow-hidden rounded-full bg-black/[0.07]">
          <span
            className="block h-full w-full origin-left rounded-full"
            style={{
              background: EASYPOS.yellow,
              animation: `splash-bar ${HOLD}ms cubic-bezier(0.4,0,0.2,1) both`,
            }}
          />
        </span>
      </div>
    </div>
  );
}
