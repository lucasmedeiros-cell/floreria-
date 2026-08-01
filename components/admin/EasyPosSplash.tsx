"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { EASYPOS } from "@/lib/easypos";
import { useBusiness } from "@/context/StoreProvider";
import { DEFAULT_RUBRO_ID } from "@/lib/rubros";

/** Cuánto dura el splash antes de empezar a irse (ms). */
const HOLD = 2300;
const FADE = 560;
/** Lado del logo. La animación de escáner se calcula sobre esta medida. */
const LOGO = 156;

/**
 * Splash de inicio del CRM: el logo de easy pos (el producto) y, debajo, el
 * negocio que está usando el panel.
 *
 * Es lo primero que ve el cliente cada mañana, así que la animación cuenta algo
 * en vez de solo aparecer: el logo lleva las marcas de un lector de código, y
 * sobre eso está armada — un halo que respira, dos pulsos de lectura que salen
 * del logo, una línea que lo barre como un escáner y un destello que lo cruza.
 * El nombre del negocio emerge detrás de una máscara y la barra marca el tiempo
 * real que falta. Al final el conjunto se va hacia adelante, como si entraras.
 *
 * El logo es el archivo original (/images/easypos.png), no una reconstrucción
 * tipográfica: así no depende de que una fuente se parezca a la de la marca.
 *
 * La marca del splash es SIEMPRE easy pos: lo que cambia con el rubro es el
 * negocio nombrado abajo. Se puede apagar en Configuración → Animaciones, y
 * quien tenga activado "reducir movimiento" en su sistema ve una entrada simple
 * (ver `prefers-reduced-motion` en globals.css).
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

  const ease = "cubic-bezier(0.22,1,0.36,1)";

  return (
    <div
      aria-hidden
      className="splash-motion fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-white"
      style={
        gone
          ? { animation: `splash-out ${FADE}ms ${ease} both`, pointerEvents: "none" }
          : undefined
      }
    >
      {/* Resplandor de fondo: le saca lo plano al blanco sin ensuciarlo. */}
      <span
        className="pointer-events-none absolute h-[520px] w-[520px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${EASYPOS.yellow}2E 0%, ${EASYPOS.yellow}00 68%)`,
          animation: "splash-halo 2600ms ease-in-out infinite",
        }}
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* ---------- Logo con la animación de lectura ---------- */}
        <div
          className="relative"
          style={{
            width: LOGO,
            height: LOGO,
            animation: `splash-logo-pop 760ms ${ease} both`,
          }}
        >
          {/* Pulsos de lectura: dos anillos, el segundo atrasado. */}
          {[0, 1].map((i) => (
            <span
              key={i}
              className="pointer-events-none absolute inset-0 rounded-[26px] border-2"
              style={{
                borderColor: EASYPOS.yellow,
                animation: `splash-ring 1700ms ${ease} ${520 + i * 850}ms both`,
              }}
            />
          ))}

          {/* El logo, recortado para que la línea y el destello queden adentro. */}
          <div className="relative h-full w-full overflow-hidden rounded-[18px] shadow-[0_22px_50px_-18px_rgba(0,0,0,0.45)]">
            <Image
              src={EASYPOS.logo}
              alt={EASYPOS.name}
              width={LOGO}
              height={LOGO}
              priority
              className="h-full w-full object-cover"
            />

            {/* Línea del escáner: baja dos veces, como leyendo el código. */}
            <span
              className="pointer-events-none absolute inset-x-0 h-[38%]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 100%)",
                animation: "splash-scan 1150ms ease-in-out 620ms 2 both",
              }}
            />

            {/* Destello diagonal: una sola pasada, al final de la lectura. */}
            <span
              className="pointer-events-none absolute -inset-y-8 w-[45%]"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
                animation: `splash-shine 900ms ${ease} 1500ms both`,
              }}
            />
          </div>
        </div>

        {/* ---------- Textos ---------- */}
        <p
          className="mt-7 text-[0.6rem] font-bold uppercase text-black/40"
          style={{ animation: `splash-focus 700ms ${ease} 520ms both` }}
        >
          {EASYPOS.tagline}
        </p>

        {/* El negocio emerge desde abajo, detrás de una máscara. */}
        <span className="mt-3.5 block overflow-hidden pb-1">
          <span
            className="block text-[1.45rem] font-extrabold leading-none tracking-[-0.4px] text-ink"
            style={{ animation: `splash-mask-up 640ms ${ease} 700ms both` }}
          >
            {business.name}
          </span>
        </span>

        {/* Sin rubro elegido no mostramos la píldora: "Sin definir" no informa. */}
        {business.rubro.id !== DEFAULT_RUBRO_ID && (
          <span className="mt-2.5 block overflow-hidden">
            <span
              className="block rounded-full bg-black/[0.06] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[1.5px] text-black/55"
              style={{ animation: `splash-mask-up 560ms ${ease} 860ms both` }}
            >
              {business.rubro.label}
            </span>
          </span>
        )}

        {/* Barra de carga: dura exactamente lo que dura el splash, con un
            brillo que la recorre para que no se vea muerta. */}
        <span className="relative mt-8 block h-[3px] w-[150px] overflow-hidden rounded-full bg-black/[0.07]">
          <span
            className="absolute inset-0 origin-left rounded-full"
            style={{
              background: `linear-gradient(90deg, ${EASYPOS.yellow}, #F0A400)`,
              animation: `splash-bar ${HOLD}ms cubic-bezier(0.4,0,0.2,1) both`,
            }}
          />
          <span
            className="absolute inset-y-0 w-[30%]"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 100%)",
              animation: "splash-bar-shine 1200ms ease-in-out 700ms infinite",
            }}
          />
        </span>
      </div>
    </div>
  );
}
