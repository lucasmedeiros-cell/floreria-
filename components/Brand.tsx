"use client";

import Image from "next/image";
import { useBusiness } from "@/context/StoreProvider";
import { Icon } from "./Icon";

/**
 * Isotipo del negocio: el logo cargado en Configuración o, si no hay ninguno,
 * el icono del rubro sobre el color de marca.
 */
export function BrandMark({ size = 40 }: { size?: number }) {
  const b = useBusiness();

  if (b.logoUrl) {
    // Sin recuadro ni color detrás: el logo manda. Y el alto es el que fija la
    // medida (el ancho sale solo), para que un logo apaisado no quede diminuto
    // dentro de una caja casi cuadrada.
    return (
      <Image
        src={b.logoUrl}
        alt={b.name}
        width={size * 3}
        height={size}
        loading="eager"
        className="shrink-0 bg-transparent object-contain object-left"
        style={{ height: size, width: "auto", maxWidth: size * 3 }}
      />
    );
  }

  // El negocio sin logo cae al icono del rubro. Se le pone tope: la medida
  // grande es para que luzca un logo de verdad, no para agrandar el recuadro
  // de relleno, que a lo ancho de la cabecera queda pesado.
  const badge = Math.min(size, 46);
  return (
    <span
      aria-label={b.name}
      className="grid shrink-0 place-items-center rounded-[12px] bg-pinkSoft text-ink"
      style={{ width: badge, height: badge }}
    >
      <Icon name={b.rubro.icon} size={Math.round(badge * 0.58)} />
    </span>
  );
}

/** Nombre del negocio + bajada, con la primera parte en tipografía fina. */
export function Wordmark({ light = false }: { light?: boolean }) {
  const b = useBusiness();
  const light1 = b.nameLight && b.name.startsWith(b.nameLight) ? b.nameLight : "";
  const rest = light1 ? b.name.slice(light1.length) : b.name;

  return (
    <span className="flex flex-col leading-none">
      <span
        className={`text-[1.55rem] font-semibold tracking-[-.5px] ${
          light ? "text-white" : "text-ink"
        }`}
      >
        {light1 && <b className="font-light">{light1}</b>}
        {rest}
      </span>
      <span
        className={`mt-[1px] text-[.52rem] font-medium tracking-[3px] ${
          light ? "text-white/60" : "text-faint"
        }`}
      >
        {b.tagline}
      </span>
    </span>
  );
}

export function GoldRule({ width = 54 }: { width?: number }) {
  return <div className="h-[3px] rounded-full bg-pink" style={{ width }} />;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = false,
  light = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
}) {
  return (
    <div className={`flex flex-col ${center ? "items-center text-center" : "items-start"}`}>
      <span className="eyebrow text-[11px] font-semibold text-ink">{eyebrow}</span>
      <h2
        className={`mt-2.5 text-[34px] font-semibold leading-tight ${
          light ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      <div className="mt-3.5">
        <GoldRule />
      </div>
      {subtitle && (
        <p
          className={`mt-3.5 max-w-[520px] text-[14px] ${
            light ? "text-white/70" : "text-ink2"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
