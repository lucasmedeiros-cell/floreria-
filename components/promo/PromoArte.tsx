"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { PromoConfig, PromoZona } from "@/lib/promo";
import { useLink } from "@/lib/negocioLink";
import { onAccent } from "@/lib/business";
import { openWhatsapp, useBusinessWhatsapp } from "@/lib/whatsapp";
import { WhatsAppIcon } from "../WhatsAppIcon";

/**
 * Landing "arte": la pieza de diseño tal cual, con los botones de verdad
 * encima de los dibujados.
 *
 * Es para las campañas que llegan ya diseñadas (un JPG/PNG que hizo el
 * diseñador). En vez de volver a maquetarlas —y que queden parecidas pero no
 * iguales—, se publica la imagen completa y se le ponen zonas clicables sobre
 * el botón de WhatsApp y el de catálogo.
 *
 * Las zonas van en PORCENTAJES sobre la imagen, así que caen sobre el botón
 * dibujado en cualquier ancho de pantalla: la imagen y las zonas escalan juntas.
 *
 * En el teléfono la pieza se ve entera pero chica, y el botón dibujado queda de
 * pocos milímetros. Por eso abajo aparece una barra con los botones de verdad,
 * a tamaño usable: es donde llega la gente desde WhatsApp o Instagram.
 */
export function PromoArte({ promo }: { promo: PromoConfig }) {
  const link = useLink();
  const waNumber = useBusinessWhatsapp(promo.whatsappTarget);

  const t = promo.theme;
  const onGold = onAccent(t.accent);
  const goldSurface = `linear-gradient(180deg, ${t.accent} 0%, ${t.accentDeep} 100%)`;

  const catalogHref = promo.catalogUrl || link("/");
  const catalogExternal = /^https?:\/\//i.test(promo.catalogUrl);
  const pedir = () => openWhatsapp(promo.whatsappMessage, waNumber);

  return (
    <div
      className="flex h-[100dvh] w-full flex-col items-center justify-center gap-4 overflow-hidden"
      style={{ background: t.backgroundColor, color: t.text }}
    >
      {/*
        El contenedor es `inline-block`, así que se encoge EXACTO al tamaño con
        el que se dibujó la imagen. De eso depende todo lo demás: las zonas van
        en % de este contenedor, o sea en % de la imagen, y siguen cayendo sobre
        el botón dibujado sea cual sea el tamaño de la pantalla.

        La pieza se limita a la altura de la ventana (y en el teléfono deja
        lugar para la barra de botones), para que entre entera de un vistazo sin
        tener que bajar.
      */}
      <div className="relative inline-block leading-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={t.background}
          alt={promo.title || promo.productName}
          className="block max-h-[58dvh] w-auto max-w-full select-none sm:max-h-[100dvh]"
        />

        <Zona
          zona={promo.artZonaWhatsapp}
          label={promo.ctaLabel}
          onClick={pedir}
        />

        {catalogExternal ? (
          <ZonaEnlace
            zona={promo.artZonaCatalogo}
            label={promo.catalogLabel}
            href={promo.catalogUrl}
            externa
          />
        ) : (
          <ZonaEnlace
            zona={promo.artZonaCatalogo}
            label={promo.catalogLabel}
            href={catalogHref}
          />
        )}
      </div>

      {/* Botones de verdad para el teléfono, donde el dibujado queda diminuto. */}
      <div className="flex w-full max-w-[560px] shrink-0 flex-col gap-3 px-5 sm:hidden">
        <button
          onClick={pedir}
          className="inline-flex items-center justify-center gap-3 rounded-full px-7 py-4 text-[17px] font-bold"
          style={{ backgroundImage: goldSurface, color: onGold }}
        >
          <WhatsAppIcon size={22} /> {promo.ctaLabel}
        </button>

        {promo.catalogLabel &&
          (catalogExternal ? (
            <a href={promo.catalogUrl} target="_blank" rel="noreferrer" className={enlaceMovil} style={{ color: t.accent, borderColor: t.accent }}>
              {promo.catalogLabel} <ChevronRight size={16} />
            </a>
          ) : (
            <Link href={catalogHref} className={enlaceMovil} style={{ color: t.accent, borderColor: t.accent }}>
              {promo.catalogLabel} <ChevronRight size={16} />
            </Link>
          ))}
      </div>
    </div>
  );
}

const enlaceMovil =
  "inline-flex items-center justify-center gap-1.5 rounded-full border px-7 py-3 text-[15px] font-bold";

const estilo = (z: PromoZona): React.CSSProperties => ({
  position: "absolute",
  left: `${z.x}%`,
  top: `${z.y}%`,
  width: `${z.w}%`,
  height: `${z.h}%`,
});

/** Zona clicable transparente: el botón se ve en el arte, no acá. */
function Zona({
  zona,
  label,
  onClick,
}: {
  zona: PromoZona;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={estilo(zona)}
      className="cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    />
  );
}

function ZonaEnlace({
  zona,
  label,
  href,
  externa,
}: {
  zona: PromoZona;
  label: string;
  href: string;
  externa?: boolean;
}) {
  const cls =
    "block cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
  return externa ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} style={estilo(zona)} className={cls} />
  ) : (
    <Link href={href} aria-label={label} title={label} style={estilo(zona)} className={cls} />
  );
}
