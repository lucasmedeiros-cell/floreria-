"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import type { PromoConfig, PromoTheme } from "@/lib/promo";
import { useLink } from "@/lib/negocioLink";
import { onAccent } from "@/lib/business";
import { openWhatsapp, useBusinessWhatsapp } from "@/lib/whatsapp";
import { useBusiness } from "@/context/StoreProvider";
import { Icon } from "../Icon";
import { WhatsAppIcon } from "../WhatsAppIcon";

/**
 * Landing "vitrina": UNA pantalla de escaparate para UN producto.
 *
 * A diferencia de la ficha (`PromoLanding`), acá no hay galería ni precios ni
 * tarjeta de compra: hay una imagen de fondo del negocio, el producto en
 * grande y dos botones. Es la maqueta para campañas de un solo producto.
 *
 * TODO lo que se ve sale de la config de la landing (Configuración → Landings):
 * el fondo, los colores, los textos, los botones y la fila de abajo. Nada está
 * cableado a un rubro ni a una marca.
 */
export function PromoVitrina({ promo }: { promo: PromoConfig }) {
  const link = useLink();
  const business = useBusiness();
  const waNumber = useBusinessWhatsapp(promo.whatsappTarget);

  const t = promo.theme;
  const onGold = onAccent(t.accent);

  // Degradado del dorado: el brillo del medio es lo que lo hace ver metálico y
  // no un amarillo plano.
  const goldSurface = `linear-gradient(180deg, ${t.accent} 0%, ${mix(t.accent, "#FFFFFF", 0.55)} 42%, ${t.accent} 58%, ${t.accentDeep} 100%)`;
  const goldText = {
    backgroundImage: goldSurface,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  } as const;

  const brandTitle = promo.brandTitle || business.name;
  const brandSubtitle = promo.brandSubtitle || business.tagline;

  // Botón del catálogo: una URL propia sale del sitio, y si no, va al catálogo
  // de la tienda de este negocio.
  const catalogHref = promo.catalogUrl || link("/");
  const catalogExternal = /^https?:\/\//i.test(promo.catalogUrl);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{ background: t.backgroundColor, color: t.text }}
    >
      {promo.theme.background && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${cssUrl(t.background)}")` }}
        />
      )}
      {/* Velo: sin esto, un fondo claro deja el texto ilegible. */}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${t.overlay / 100})` }} />

      {t.frame && <Marco accent={t.accent} />}

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1420px] flex-col gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:px-16">
        {/* ===================== CABECERA ===================== */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href={link("/")} className="flex items-center gap-4 sm:gap-5">
            {business.logoUrl ? (
              <Image
                src={business.logoUrl}
                alt={brandTitle}
                width={260}
                height={96}
                priority
                className="h-14 w-auto object-contain sm:h-20"
                style={{ maxWidth: 260 }}
              />
            ) : (
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full sm:h-20 sm:w-20"
                style={{ background: goldSurface, color: onGold }}
              >
                <Icon name={business.rubro.icon} size={30} />
              </span>
            )}

            <span
              className="hidden h-12 w-px sm:block"
              style={{ background: alpha(t.accent, 0.45) }}
            />

            <span className="leading-none">
              <span
                className="block text-[22px] font-extrabold uppercase tracking-[3px] sm:text-[34px] sm:tracking-[5px]"
                style={goldText}
              >
                {brandTitle}
              </span>
              {brandSubtitle && (
                <span
                  className="mt-1.5 block text-[11px] font-semibold uppercase tracking-[5px] sm:text-[15px] sm:tracking-[7px]"
                  style={{ color: t.textSoft }}
                >
                  {brandSubtitle}
                </span>
              )}
            </span>
          </Link>

          {promo.catalogLabel &&
            (catalogExternal ? (
              <a
                href={promo.catalogUrl}
                target="_blank"
                rel="noreferrer"
                className={botonCatalogo}
                style={{ backgroundImage: goldSurface, color: onGold }}
              >
                {promo.catalogLabel} <ChevronRight size={17} />
              </a>
            ) : (
              <Link
                href={catalogHref}
                className={botonCatalogo}
                style={{ backgroundImage: goldSurface, color: onGold }}
              >
                {promo.catalogLabel} <ChevronRight size={17} />
              </Link>
            ))}
        </header>

        {/* ===================== CUERPO ===================== */}
        <main className="grid flex-1 items-center gap-10 lg:grid-cols-2 lg:gap-6">
          {/* ---- Texto y llamados a la acción ---- */}
          <section className="order-2 flex flex-col items-start lg:order-1">
            {promo.eyebrow && (
              <span
                className="text-[12px] font-semibold uppercase tracking-[4px] sm:text-[15px]"
                style={{ color: t.textSoft }}
              >
                {promo.eyebrow}
              </span>
            )}

            <h1
              className="mt-4 text-[clamp(2.6rem,6.4vw,5.2rem)] font-black leading-[0.98] tracking-[-0.01em]"
              style={goldText}
            >
              {promo.title}
            </h1>

            {promo.presentation && (
              <span
                className="mt-6 inline-block rounded-full border-2 px-7 py-2.5 text-[clamp(0.95rem,1.6vw,1.35rem)] font-bold italic uppercase tracking-[1px]"
                style={{ borderColor: alpha(t.accent, 0.75), color: t.accent }}
              >
                {promo.presentation}
              </span>
            )}

            {/* Separador con el adorno del medio */}
            <div className="mt-8 flex w-full max-w-[420px] items-center gap-3">
              <span className="h-px flex-1" style={{ background: alpha(t.accent, 0.35) }} />
              <span
                className="grid h-6 w-6 place-items-center rounded-full border text-[11px]"
                style={{ borderColor: alpha(t.accent, 0.6), color: t.accent }}
              >
                ✦
              </span>
              <span className="h-px flex-1" style={{ background: alpha(t.accent, 0.35) }} />
            </div>

            {promo.description.trim() && (
              <p
                className="mt-6 max-w-[520px] text-[15px] leading-relaxed"
                style={{ color: t.textSoft }}
              >
                {promo.description}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <button
                onClick={() => openWhatsapp(promo.whatsappMessage, waNumber)}
                className="inline-flex items-center gap-3 rounded-full px-9 py-4 text-[clamp(1rem,1.7vw,1.35rem)] font-bold transition-transform hover:-translate-y-0.5"
                style={{ backgroundImage: goldSurface, color: onGold }}
              >
                <WhatsAppIcon size={24} /> {promo.ctaLabel}
              </button>

              {promo.secureNote && (
                <span
                  className="inline-flex items-center gap-2 text-[13px] font-medium"
                  style={{ color: t.textSoft }}
                >
                  <ShieldCheck size={18} style={{ color: t.accent }} />
                  {promo.secureNote}
                </span>
              )}
            </div>
          </section>

          {/* ---- Producto ---- */}
          <section className="order-1 lg:order-2">
            <div className="relative mx-auto aspect-square w-full max-w-[540px]">
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${alpha(t.accent, 0.3)} 0%, transparent 62%)`,
                }}
              />
              <span
                className="absolute inset-[9%] rounded-full border-2"
                style={{
                  borderColor: alpha(t.accent, 0.5),
                  boxShadow: `0 0 90px ${alpha(t.accent, 0.28)}, inset 0 0 70px ${alpha(t.accent, 0.14)}`,
                }}
              />
              {promo.image ? (
                <Image
                  src={promo.image}
                  alt={promo.productName || promo.title}
                  fill
                  priority
                  sizes="(max-width:1024px) 90vw, 45vw"
                  className="object-contain p-[14%]"
                />
              ) : (
                <span
                  className="absolute inset-0 grid place-items-center"
                  style={{ color: alpha(t.accent, 0.7) }}
                >
                  <Icon name={business.rubro.icon} size={160} />
                </span>
              )}
            </div>
          </section>
        </main>

        {/* ===================== FRANJA DE ABAJO ===================== */}
        {promo.highlights.length > 0 && (
          <div
            className="rounded-[36px] border px-6 py-6 sm:px-10"
            style={{
              borderColor: alpha(t.accent, 0.4),
              background: `rgba(0,0,0,${Math.min(0.55, t.overlay / 100 + 0.15)})`,
            }}
          >
            <ul className="grid gap-6 sm:grid-cols-3">
              {promo.highlights.slice(0, 3).map((h, i) => (
                <li
                  key={i}
                  // El divisor es vertical entre columnas y horizontal cuando
                  // se apilan: en el teléfono, una raya vertical quedaba suelta.
                  className={`flex items-center justify-center gap-4 sm:px-4 ${
                    i > 0 ? "border-t pt-6 sm:border-l sm:border-t-0 sm:pt-0" : ""
                  }`}
                  style={i > 0 ? { borderColor: alpha(t.accent, 0.3) } : undefined}
                >
                  <span
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full border"
                    style={{ borderColor: alpha(t.accent, 0.55), color: t.accent }}
                  >
                    <Icon name={h.icon} size={26} />
                  </span>
                  <span className="text-[clamp(1rem,1.5vw,1.3rem)] leading-tight">
                    <span className="block font-medium">{h.title}</span>
                    {h.text && (
                      <span className="block" style={{ color: t.textSoft }}>
                        {h.text}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const botonCatalogo =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-6 py-2.5 text-[15px] font-bold transition-transform hover:-translate-y-px sm:px-8 sm:py-3 sm:text-[17px]";

/** Marco ornamental: cuatro escuadras en las esquinas. */
function Marco({ accent }: { accent: string }) {
  const esquina = "pointer-events-none absolute h-14 w-14 sm:h-24 sm:w-24";
  const borde = { borderColor: alpha(accent, 0.55) };
  return (
    <>
      <span className={`${esquina} left-4 top-4 border-l-2 border-t-2 sm:left-6 sm:top-6`} style={borde} />
      <span className={`${esquina} right-4 top-4 border-r-2 border-t-2 sm:right-6 sm:top-6`} style={borde} />
      <span className={`${esquina} bottom-4 left-4 border-b-2 border-l-2 sm:bottom-6 sm:left-6`} style={borde} />
      <span className={`${esquina} bottom-4 right-4 border-b-2 border-r-2 sm:bottom-6 sm:right-6`} style={borde} />
    </>
  );
}

// ------------------------------ Utilidades ----------------------------------

/** `#RRGGBB` + opacidad → `rgba(...)`. Los colores del tema son hex. */
function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Mezcla dos hex (0 = todo `a`, 1 = todo `b`). Para el brillo del dorado. */
function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Corta comillas y saltos de una URL antes de meterla en `url("…")`. */
function cssUrl(v: string): string {
  return v.replace(/["\\\n\r]/g, "");
}
