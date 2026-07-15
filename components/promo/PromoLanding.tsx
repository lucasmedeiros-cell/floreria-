"use client";

import { useLink } from "@/lib/negocioLink";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, ShoppingCart, X } from "lucide-react";
import type { PromoConfig } from "@/lib/promo";
import { bs } from "@/lib/products";
import { onAccent } from "@/lib/business";
import { openWhatsapp, useBusinessWhatsapp } from "@/lib/whatsapp";
import { useBusiness } from "@/context/StoreProvider";
import { Icon } from "../Icon";
import { WhatsAppIcon } from "../WhatsAppIcon";

/**
 * Landing promocional (/promo) — estilo "bold": navbar flotante, cuñas
 * diagonales, titular gigante a dos líneas y el producto sobre un círculo.
 *
 * Nada de esto está atado a un rubro: color, logo, textos, producto y foto
 * salen de la config del negocio (Configuración → Rubro del negocio + Landing).
 * Con acentos claros (amarillo) el texto sobre el color se pinta negro; con
 * acentos oscuros, blanco (ver onAccent).
 */
export function PromoLanding({ promo }: { promo: PromoConfig }) {
  const link = useLink();
  const business = useBusiness();
  const waNumber = useBusinessWhatsapp();
  const [menu, setMenu] = useState(false);

  const { colors, rubro, noun } = business;
  const accent = colors.accent;
  const on = onAccent(accent); // texto legible sobre el color de marca

  if (!promo.enabled) return <PromoDisabled />;

  const hasDiscount = !!promo.originalPrice && promo.originalPrice > promo.price;
  const discountPct = hasDiscount
    ? Math.round((1 - promo.price / promo.originalPrice!) * 100)
    : 0;

  // Una imagen recortada (PNG/WebP/SVG, sin fondo) puede "flotar" sobre el
  // círculo como en el diseño. Una foto normal (JPG) llevaría su fondo cuadrado
  // encima, así que se recorta en círculo. Heurística por extensión.
  const cutout = /\.(png|webp|svg)(\?|$)/i.test(promo.image);

  const pedir = () => openWhatsapp(promo.whatsappMessage, waNumber);
  const consultar = () =>
    openWhatsapp(`${business.greeting} Tengo una consulta sobre la promoción.`, waNumber);

  const NAV = [
    { label: "PRODUCTOS", href: "/" },
    { label: "OFERTA", href: "#oferta" },
    { label: "BENEFICIOS", href: "#beneficios" },
    { label: "CONTACTO", href: "#contacto" },
  ];

  /** Isotipo hexagonal: el logo del negocio o, si no hay, el icono del rubro. */
  const BrandHex = () => (
    <span
      className="grid h-[52px] w-[46px] shrink-0 place-items-center"
      style={{
        background: business.logoUrl ? "transparent" : accent,
        clipPath: business.logoUrl
          ? undefined
          : "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
        color: on,
      }}
    >
      {business.logoUrl ? (
        <Image
          src={business.logoUrl}
          alt={business.name}
          width={44}
          height={48}
          className="object-contain"
        />
      ) : (
        <Icon name={rubro.icon} size={24} />
      )}
    </span>
  );

  return (
    <div className="min-h-screen bg-white font-sans text-[#14110F]">
      {/* ===================== HEADER ===================== */}
      <header className="relative z-30 px-4 pt-4 sm:px-6 sm:pt-6">
        {/* Cuña diagonal detrás de la barra */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-[120px]"
          style={{ background: accent, clipPath: "polygon(0 0, 46% 0, 30% 100%, 0 100%)" }}
        />

        <div className="mx-auto flex max-w-[1280px] items-center gap-4 rounded-[18px] bg-white px-5 py-3.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18)] sm:px-7 sm:py-4">
          {/* Marca */}
          <Link href={link("/")} className="flex shrink-0 items-center gap-3">
            <BrandHex />
            <span className="hidden leading-[0.95] sm:block">
              <span className="block text-[19px] font-extrabold uppercase tracking-[-0.5px]">
                {business.name}
              </span>
              <span className="mt-1 block text-[8.5px] font-semibold uppercase tracking-[2px] text-black/45">
                {business.categories.slice(0, 3).join(" • ")}
              </span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="ml-auto hidden items-center gap-7 lg:flex">
            <Link
              href={link("/")}
              className="rounded-[10px] px-5 py-2.5 text-[12.5px] font-bold uppercase tracking-wide transition-transform hover:-translate-y-px"
              style={{ background: accent, color: on }}
            >
              Comprar ahora
            </Link>
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="text-[12.5px] font-bold uppercase tracking-wide transition-opacity hover:opacity-60"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* Botón de menú (móvil) */}
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Menú"
            className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-[10px] lg:ml-0"
            style={{ background: accent, color: on }}
          >
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Menú desplegable (móvil) */}
        {menu && (
          <div className="mx-auto mt-2 flex max-w-[1280px] flex-col gap-1 rounded-[18px] bg-white p-3 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18)]">
            <Link
              href={link("/")}
              className="rounded-[10px] px-4 py-3 text-[13px] font-bold uppercase"
              style={{ background: accent, color: on }}
            >
              Comprar ahora
            </Link>
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                onClick={() => setMenu(false)}
                className="rounded-[10px] px-4 py-3 text-[13px] font-bold uppercase hover:bg-black/5"
              >
                {n.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden">
        {/* Cuñas diagonales y decoraciones */}
        <div
          aria-hidden
          className="absolute left-0 top-0 hidden h-full w-[170px] md:block"
          style={{ background: accent, clipPath: "polygon(0 8%, 100% 24%, 0 60%)" }}
        />
        <div
          aria-hidden
          className="absolute bottom-0 right-0 h-[160px] w-[45%]"
          style={{ background: accent, clipPath: "polygon(100% 0, 100% 100%, 14% 100%)" }}
        />
        <Chevrons className="absolute left-7 top-[66%] hidden md:block" color={accent} />
        <DotGrid className="absolute left-[3%] top-[6%] hidden lg:block" color={accent} />
        <DotGrid className="absolute bottom-[18%] right-[5%] hidden lg:block" color={accent} />
        <CrossGrid className="absolute left-[27%] top-[34%] hidden xl:block" color={accent} />

        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-10 px-6 pb-24 pt-12 lg:grid-cols-2 lg:gap-8 lg:pb-28 lg:pt-16">
          {/* ---- Producto sobre el círculo ---- */}
          <div className="relative order-2 mx-auto w-full max-w-[540px] lg:order-1">
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 aspect-square w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: accent }}
            />
            <div className="relative mx-auto aspect-square w-full">
              {promo.image && cutout && (
                <Image
                  src={promo.image}
                  alt={promo.productName}
                  fill
                  priority
                  sizes="(max-width:1024px) 90vw, 45vw"
                  className="object-contain drop-shadow-[0_28px_38px_rgba(0,0,0,0.28)]"
                />
              )}

              {promo.image && !cutout && (
                <div className="absolute left-1/2 top-1/2 aspect-square w-[72%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-[0_28px_44px_-14px_rgba(0,0,0,0.45)]">
                  <Image
                    src={promo.image}
                    alt={promo.productName}
                    fill
                    priority
                    sizes="(max-width:1024px) 70vw, 34vw"
                    className="object-cover"
                  />
                </div>
              )}

              {!promo.image && (
                <div className="absolute inset-0 grid place-items-center">
                  <span
                    className="drop-shadow-[0_18px_26px_rgba(0,0,0,0.22)]"
                    style={{ color: on }}
                  >
                    <Icon name={rubro.icon} size={180} />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ---- Copy ---- */}
          <div className="order-1 lg:order-2">
            <span
              className="inline-flex items-center gap-2.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-extrabold uppercase tracking-wide"
              style={{ background: accent, color: on }}
            >
              <Icon name={rubro.icon} size={17} />
              {promo.eyebrow}
            </span>

            {/* Titular gigante a dos líneas (el de la portada del negocio) */}
            <h1 className="mt-6 text-[clamp(2.6rem,6.6vw,5rem)] font-black uppercase leading-[0.92] tracking-[-0.02em]">
              <span className="block">{business.hero.title}</span>
              <span className="block" style={{ color: accent }}>
                {business.hero.highlight}
              </span>
            </h1>

            <p className="mt-6 max-w-[480px] text-[15.5px] leading-relaxed text-black/70">
              {promo.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href={link("/")}
                className="inline-flex items-center gap-2.5 rounded-[12px] px-7 py-[18px] text-[13.5px] font-extrabold uppercase tracking-wide transition-transform hover:-translate-y-0.5"
                style={{ background: accent, color: on }}
              >
                <ShoppingCart size={19} /> Comprar ahora
              </Link>
              <button
                onClick={consultar}
                className="inline-flex items-center gap-2.5 rounded-[12px] border-2 border-black/10 bg-white px-7 py-[16px] text-[13.5px] font-extrabold uppercase tracking-wide transition-colors hover:border-black/30"
              >
                <WhatsAppIcon size={19} /> Escríbenos por WhatsApp
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== STATS ===================== */}
      <section className="bg-[#14110F]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-8 px-6 py-10 sm:grid-cols-4">
          {promo.stats.map((s) => (
            <div key={s.label} className="text-center">
              <p
                className="text-[clamp(1.5rem,3vw,2.1rem)] font-black uppercase leading-none"
                style={{ color: accent }}
              >
                {s.value}
              </p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-white/55">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== OFERTA (producto + precio) ===================== */}
      <section id="oferta" className="relative overflow-hidden bg-white py-20">
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2">
          <div>
            <span
              className="text-[12px] font-extrabold uppercase tracking-[2px]"
              style={{ color: accent }}
            >
              {promo.productName}
            </span>
            <h2 className="mt-3 text-[clamp(2rem,4.4vw,3.1rem)] font-black uppercase leading-[0.98] tracking-[-0.01em]">
              {promo.title}
            </h2>
            <div className="mt-5 h-[5px] w-[70px]" style={{ background: accent }} />
            <p className="mt-6 max-w-[520px] text-[15px] leading-relaxed text-black/70">
              {promo.description}
            </p>

            {/* Precio */}
            <div className="mt-8 flex flex-wrap items-end gap-4">
              <span className="text-[clamp(2.2rem,5vw,3.2rem)] font-black leading-none">
                {bs(promo.price)}
              </span>
              {hasDiscount && (
                <>
                  <span className="pb-1 text-[19px] font-semibold text-black/35 line-through">
                    {bs(promo.originalPrice!)}
                  </span>
                  <span
                    className="mb-1 rounded-[8px] px-2.5 py-1 text-[12.5px] font-extrabold"
                    style={{ background: accent, color: on }}
                  >
                    -{discountPct}%
                  </span>
                </>
              )}
            </div>

            {promo.validUntil && (
              <div className="mt-7">
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[2px] text-black/45">
                  La oferta termina en
                </p>
                <Countdown iso={promo.validUntil} accent={accent} on={on} />
              </div>
            )}

            <div className="mt-8">
              <button
                onClick={pedir}
                className="inline-flex items-center gap-2.5 rounded-[12px] px-8 py-[18px] text-[13.5px] font-extrabold uppercase tracking-wide transition-transform hover:-translate-y-0.5"
                style={{ background: accent, color: on }}
              >
                <WhatsAppIcon size={19} /> {promo.ctaLabel}
              </button>
            </div>
          </div>

          {/* Foto del producto (o el icono del rubro si aún no tiene) */}
          <div className="relative mx-auto aspect-square w-full max-w-[460px]">
            <div
              aria-hidden
              className="absolute inset-0 rounded-[28px]"
              style={{
                background: accent,
                clipPath: "polygon(0 12%, 100% 0, 100% 88%, 0 100%)",
              }}
            />
            <div className="absolute inset-[10%]">
              {promo.image ? (
                <div
                  className={
                    cutout ? "relative h-full w-full" : "relative h-full w-full overflow-hidden rounded-[18px]"
                  }
                >
                  <Image
                    src={promo.image}
                    alt={promo.productName}
                    fill
                    sizes="(max-width:1024px) 90vw, 40vw"
                    className={
                      cutout
                        ? "object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.25)]"
                        : "object-cover"
                    }
                  />
                </div>
              ) : (
                <div className="grid h-full place-items-center" style={{ color: on }}>
                  <Icon name={rubro.icon} size={140} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== BENEFICIOS ===================== */}
      <section id="beneficios" className="bg-[#F6F5F3] py-20">
        <div className="mx-auto max-w-[1280px] px-6">
          <span
            className="text-[12px] font-extrabold uppercase tracking-[2px]"
            style={{ color: accent }}
          >
            Por qué comprarnos
          </span>
          <h2 className="mt-3 max-w-[620px] text-[clamp(1.9rem,4vw,2.8rem)] font-black uppercase leading-[1] tracking-[-0.01em]">
            Todo lo que incluye tu {noun.one}
          </h2>
          <div className="mt-5 h-[5px] w-[70px]" style={{ background: accent }} />

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promo.highlights.map((h) => (
              <div
                key={h.title}
                className="rounded-[16px] border-2 border-black/[0.06] bg-white p-6 transition-colors hover:border-black/20"
              >
                <span
                  className="grid h-12 w-12 place-items-center rounded-[12px]"
                  style={{ background: accent, color: on }}
                >
                  <Icon name={h.icon} size={22} />
                </span>
                <h3 className="mt-4 text-[15px] font-extrabold uppercase tracking-wide">
                  {h.title}
                </h3>
                {h.text && (
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-black/60">{h.text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CTA FINAL ===================== */}
      <section id="contacto" className="relative overflow-hidden" style={{ background: accent }}>
        <div
          aria-hidden
          className="absolute right-0 top-0 hidden h-full w-[40%] bg-white/10 lg:block"
          style={{ clipPath: "polygon(38% 0, 100% 0, 100% 100%, 0 100%)" }}
        />
        <div className="relative mx-auto flex max-w-[1280px] flex-col items-start gap-7 px-6 py-16 lg:flex-row lg:items-center lg:justify-between">
          <div style={{ color: on }}>
            <h2 className="max-w-[620px] text-[clamp(1.6rem,3.1vw,2.3rem)] font-black uppercase leading-[1.15] tracking-[-0.01em]">
              {business.hero.subtitle}
            </h2>
            <p className="mt-5 text-[13.5px] font-semibold opacity-70">
              📍 {business.address} · 🕐 {business.hours}
            </p>
          </div>
          <button
            onClick={pedir}
            className="inline-flex shrink-0 items-center gap-2.5 rounded-[12px] bg-[#14110F] px-8 py-[18px] text-[13.5px] font-extrabold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
          >
            <WhatsAppIcon size={19} /> {promo.ctaLabel}
          </button>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="bg-[#14110F] py-10">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-5 px-6">
          <div className="flex items-center gap-3">
            <BrandHex />
            <span className="leading-[0.95]">
              <span className="block text-[17px] font-extrabold uppercase text-white">
                {business.name}
              </span>
              <span className="mt-1 block text-[8.5px] font-semibold uppercase tracking-[2px] text-white/45">
                {business.tagline}
              </span>
            </span>
          </div>
          <Link
            href={link("/")}
            className="inline-flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-white/70 transition-colors hover:text-white"
          >
            Ver toda la tienda <ArrowRight size={16} />
          </Link>
        </div>
      </footer>
    </div>
  );
}

/** Cuenta regresiva real hasta `iso` (SSR-safe: "--" hasta montar en cliente). */
function Countdown({ iso, accent, on }: { iso: string; accent: string; on: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(iso).getTime();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);

  const box = (v: number | null, l: string) => (
    <div className="text-center">
      <span
        className="grid h-[62px] w-[62px] place-items-center rounded-[12px] text-[22px] font-black"
        style={{ background: accent, color: on }}
      >
        {v == null ? "--" : v.toString().padStart(2, "0")}
      </span>
      <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-[1.5px] text-black/45">
        {l}
      </span>
    </div>
  );

  return (
    <div className="flex gap-2.5">
      {box(left == null ? null : Math.floor(left / 86400000), "Días")}
      {box(left == null ? null : Math.floor((left / 3600000) % 24), "Horas")}
      {box(left == null ? null : Math.floor((left / 60000) % 60), "Min")}
      {box(left == null ? null : Math.floor((left / 1000) % 60), "Seg")}
    </div>
  );
}

// ===================== Decoraciones =====================

function DotGrid({ className, color }: { className?: string; color: string }) {
  return (
    <span
      aria-hidden
      className={`${className} h-[86px] w-[86px]`}
      style={{
        backgroundImage: `radial-gradient(${color} 2.2px, transparent 2.2px)`,
        backgroundSize: "17px 17px",
        opacity: 0.55,
      }}
    />
  );
}

function CrossGrid({ className, color }: { className?: string; color: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      width="86"
      height="60"
      viewBox="0 0 86 60"
      fill="none"
      opacity="0.5"
    >
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <g key={`${r}-${c}`} stroke={color} strokeWidth="2.4" strokeLinecap="round">
            <line x1={6 + c * 22} y1={6 + r * 22} x2={14 + c * 22} y2={14 + r * 22} />
            <line x1={14 + c * 22} y1={6 + r * 22} x2={6 + c * 22} y2={14 + r * 22} />
          </g>
        ))
      )}
    </svg>
  );
}

function Chevrons({ className, color }: { className?: string; color: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      width="42"
      height="70"
      viewBox="0 0 42 70"
      fill="none"
      stroke={color}
      strokeWidth="7"
      strokeLinecap="round"
    >
      <polyline points="6,8 24,22 6,36" />
      <polyline points="6,32 24,46 6,60" />
    </svg>
  );
}

/** Aviso cuando la landing está desactivada desde el panel. */
function PromoDisabled() {
  const link = useLink();
  return (
    <div className="grid min-h-screen place-items-center bg-white px-6 text-center">
      <div>
        <h1 className="text-[26px] font-black uppercase">Promoción no disponible</h1>
        <p className="mt-2 text-[14px] text-black/60">
          En este momento no hay una oferta activa.
        </p>
        <Link
          href={link("/")}
          className="mt-6 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide underline"
        >
          Ir a la tienda <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
