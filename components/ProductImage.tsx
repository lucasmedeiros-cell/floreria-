"use client";

import Image from "next/image";
import { useBusiness } from "@/context/StoreProvider";
import { Icon } from "./Icon";

/**
 * Foto de producto con respaldo: si el producto todavía no tiene imagen propia
 * (el caso de los catálogos demo de la mayoría de los rubros), pinta un
 * placeholder con el color y el icono del rubro en vez de un hueco roto.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  /** Icono a mostrar en el placeholder (por defecto, el del rubro). */
  icon,
  className = "object-cover",
  iconSize = 34,
}: {
  src: string;
  alt: string;
  sizes?: string;
  icon?: string;
  className?: string;
  iconSize?: number;
}) {
  const business = useBusiness();

  if (src) {
    return (
      <Image src={src} alt={alt} fill sizes={sizes} className={className} />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-pinkSoft to-pinkHero p-3 text-center"
    >
      <span className="text-pink opacity-80">
        <Icon name={icon ?? business.rubro.icon} size={iconSize} />
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink2">
        {alt}
      </span>
    </div>
  );
}
