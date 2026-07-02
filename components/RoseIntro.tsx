"use client";

import { useEffect, useState, type CSSProperties } from "react";

const PETALS = 8;

/**
 * Animación de inicio de la web: una rosa cuyos pétalos se van cayendo mientras
 * el overlay se desvanece. Es 100% CSS (keyframes con fill-mode), así que nunca
 * se queda colgada aunque el JS no llegue a ejecutarse; el timer solo la
 * desmonta del DOM al terminar.
 */
export function RoseIntro({ enabled }: { enabled: boolean }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setShow(false), 1900);
    return () => clearTimeout(t);
  }, [enabled]);

  if (!enabled || !show) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[200] grid place-items-center bg-pinkHero"
      style={{ animation: "web-intro-out 1750ms ease forwards" }}
    >
      <div className="pop-in flex flex-col items-center">
        <div className="relative h-[210px] w-[210px]">
          {/* Tallo */}
          <span className="absolute left-1/2 top-[100px] h-[96px] w-[3px] -translate-x-1/2 rounded-full bg-[#3E9B5F]" />
          {/* Hoja */}
          <span
            className="absolute left-[calc(50%+3px)] top-[150px] h-[16px] w-[32px] rounded-full bg-[#4FB06E]"
            style={{ transform: "rotate(26deg)", transformOrigin: "left center" }}
          />

          {/* Pétalos que brotan y forman la rosa */}
          {Array.from({ length: PETALS }).map((_, i) => {
            const a = (360 / PETALS) * i;
            return (
              <span
                key={i}
                className="absolute left-1/2 top-[72px] h-[56px] w-[32px]"
                style={
                  {
                    marginLeft: -16,
                    marginTop: -28,
                    transformOrigin: "center",
                    borderRadius: "50% 50% 50% 50% / 62% 62% 38% 38%",
                    background: "linear-gradient(180deg,#F76F9C,#E8366B)",
                    boxShadow: "inset 0 -6px 10px rgba(0,0,0,0.10)",
                    "--a": `${a}deg`,
                    animation: `petal-form 650ms cubic-bezier(0.34,1.56,0.64,1) ${
                      i * 55
                    }ms both`,
                  } as CSSProperties
                }
              />
            );
          })}

          {/* Corazón de la flor */}
          <span
            className="absolute left-1/2 top-[72px] z-10 h-[30px] w-[30px] rounded-full"
            style={{
              marginLeft: -15,
              marginTop: -15,
              background: "radial-gradient(circle at 40% 35%,#F4C24A,#CBA869)",
              animation: "pop-in 500ms ease 250ms both",
            }}
          />
        </div>

        <div className="-mt-1 text-center">
          <p className="text-[1.7rem] font-semibold leading-none tracking-[-0.5px] text-ink">
            <span className="font-light">Flores</span>Online
          </p>
          <p className="mt-1 text-[0.6rem] font-medium tracking-[3px] text-faint">
            ARTE FLORAL EN CADA DETALLE
          </p>
        </div>
      </div>
    </div>
  );
}
