"use client";

import { useEffect, useState, type CSSProperties } from "react";

const PETALS = 10;

/**
 * Animación de inicio del panel: una flor que florece (los pétalos brotan
 * desde el centro) sobre fondo oscuro, luego se desvanece.
 * Se muestra al entrar al panel.
 */
export function AdminIntro({ enabled }: { enabled: boolean }) {
  const [gone, setGone] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const t1 = setTimeout(() => setGone(true), 2100);
    const t2 = setTimeout(() => setShow(false), 2750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [enabled]);

  if (!enabled || !show) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] grid place-items-center bg-dark transition-opacity duration-[600ms] ${
        gone ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center">
        <div className="relative h-[170px] w-[170px]">
          {Array.from({ length: PETALS }).map((_, i) => {
            const a = (360 / PETALS) * i;
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 h-[48px] w-[26px]"
                style={
                  {
                    marginLeft: -13,
                    marginTop: -24,
                    transformOrigin: "center",
                    borderRadius: "50% 50% 50% 50% / 62% 62% 38% 38%",
                    background: "linear-gradient(180deg,#F9A8C4,#E8366B)",
                    "--a": `${a}deg`,
                    animation: `petal-bloom 900ms cubic-bezier(0.34,1.56,0.64,1) ${
                      i * 70
                    }ms both`,
                  } as CSSProperties
                }
              />
            );
          })}
          {/* Corazón */}
          <span
            className="pop-in-center absolute left-1/2 top-1/2 h-[38px] w-[38px] rounded-full"
            style={{
              background: "radial-gradient(circle at 40% 35%,#F4C24A,#CBA869)",
              animationDelay: "350ms",
            }}
          />
        </div>

        <p
          className="mt-4 text-[1.5rem] font-semibold leading-none tracking-[-0.5px] text-white"
          style={{ animation: "pop-in 0.6s ease 600ms both" }}
        >
          <span className="font-light">Flores</span>Online
        </p>
        <p className="mt-1.5 text-[0.62rem] font-medium tracking-[3px] text-white/45">
          PANEL DE ADMINISTRACIÓN
        </p>
      </div>
    </div>
  );
}
