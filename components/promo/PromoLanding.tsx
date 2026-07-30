"use client";

import { useLink } from "@/lib/negocioLink";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck, ShoppingCart, Store } from "lucide-react";
import type { PromoConfig } from "@/lib/promo";
import { bs, productPhotos, type Product } from "@/lib/products";
import { onAccent } from "@/lib/business";
import { openWhatsapp, useBusinessWhatsapp } from "@/lib/whatsapp";
import { useBusiness, useProducts } from "@/context/StoreProvider";
import { Icon } from "../Icon";
import { WhatsAppIcon } from "../WhatsAppIcon";

/**
 * Landing promocional (/promo) — ficha de UN producto a pantalla completa, al
 * estilo de los marketplaces: galería a la izquierda, datos y precio al centro
 * y la tarjeta de compra a la derecha.
 *
 * Es UNA sola pantalla y UN solo producto: todo entra en el primer plano, sin
 * secciones que haya que ir a buscar hacia abajo y sin listar el catálogo. El
 * botón de comprar no vende acá: manda al catálogo de la tienda web del
 * negocio, que es donde está el carrito de verdad.
 *
 * Nada está atado a un rubro: color, logo, textos, producto y fotos salen de la
 * config del negocio (Configuración → Rubro del negocio + Landing).
 */
export function PromoLanding({ promo }: { promo: PromoConfig }) {
  const link = useLink();
  const business = useBusiness();
  const waNumber = useBusinessWhatsapp();
  const { products } = useProducts();

  const { colors, rubro, noun } = business;
  const accent = colors.accent;
  const on = onAccent(accent); // texto legible sobre el color de marca

  /**
   * Fotos de la galería, TODAS del mismo producto: las dos de la landing
   * primero y, si la promo está vinculada a un producto del catálogo, las suyas
   * detrás. Sin repetidas.
   */
  const fotos = useMemo(() => {
    const vinculado: Product | undefined = promo.productId
      ? products.find((p) => p.id === promo.productId)
      : undefined;
    const todas = [
      promo.image,
      promo.imageAlt ?? "",
      ...(vinculado ? productPhotos(vinculado) : []),
    ].filter((f) => f.trim() !== "");
    return Array.from(new Set(todas));
  }, [promo.image, promo.imageAlt, promo.productId, products]);

  const [foto, setFoto] = useState(0);
  // Cambió la promo (o llegaron los productos): el índice viejo podría no existir.
  useEffect(() => setFoto(0), [fotos.length]);

  if (!promo.enabled) return <PromoDisabled />;

  const hasDiscount = !!promo.originalPrice && promo.originalPrice > promo.price;
  const discountPct = hasDiscount
    ? Math.round((1 - promo.price / promo.originalPrice!) * 100)
    : 0;

  // Cuenta regresiva solo con una fecha real: una mal escrita pintaría "NaN" en
  // los recuadros, y una ya vencida, un 00:00:00 fijo.
  const deadline =
    promo.validUntil && new Date(promo.validUntil).getTime() > Date.now()
      ? promo.validUntil
      : null;

  const actual = fotos[foto] ?? fotos[0] ?? "";
  const consultar = () => openWhatsapp(promo.whatsappMessage, waNumber);

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F5F3] font-sans text-[#14110F] lg:h-screen lg:overflow-hidden">
      {/* ===================== BARRA ===================== */}
      <header className="shrink-0 border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex h-[62px] max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <Link href={link("/")} className="flex min-w-0 shrink-0 items-center gap-2.5">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px]"
              style={{ background: business.logoUrl ? "transparent" : accent, color: on }}
            >
              {business.logoUrl ? (
                <Image
                  src={business.logoUrl}
                  alt={business.name}
                  width={36}
                  height={36}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Icon name={rubro.icon} size={19} />
              )}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-extrabold uppercase tracking-[-0.3px]">
                {business.name}
              </span>
              <span className="hidden truncate text-[9.5px] font-semibold uppercase tracking-[1.6px] text-black/40 sm:block">
                {business.tagline}
              </span>
            </span>
          </Link>

          <Link
            href={link("/")}
            className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-[10px] px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-wide transition-transform hover:-translate-y-px"
            style={{ background: accent, color: on }}
          >
            <Store size={16} /> Ver la tienda
          </Link>
        </div>
      </header>

      {/* ===================== FICHA (una sola pantalla) ===================== */}
      <main className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 gap-4 p-4 sm:px-6 lg:min-h-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_330px] lg:gap-5 lg:py-5">
        {/* ---- Galería ---- */}
        <section className="flex min-h-0 gap-3 rounded-[16px] border border-black/[0.07] bg-white p-3">
          {fotos.length > 1 && (
            <div className="flex max-h-full shrink-0 flex-col gap-2 overflow-y-auto pr-0.5">
              {fotos.slice(0, 8).map((f, i) => (
                <button
                  key={`${i}-${f.slice(0, 24)}`}
                  onClick={() => setFoto(i)}
                  aria-label={`Foto ${i + 1}`}
                  className="relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[10px] border-2 bg-[#F6F5F3]"
                  style={{ borderColor: i === foto ? accent : "rgba(0,0,0,0.08)" }}
                >
                  <Image src={f} alt="" fill sizes="58px" className="object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-[12px] bg-[#F6F5F3] lg:min-h-0">
            {actual ? (
              <Image
                src={actual}
                alt={promo.productName}
                fill
                priority
                sizes="(max-width:1024px) 92vw, 38vw"
                className="object-contain p-4"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center" style={{ color: accent }}>
                <Icon name={rubro.icon} size={140} />
              </span>
            )}
            {hasDiscount && (
              <span
                className="absolute left-3 top-3 rounded-[8px] px-2.5 py-1 text-[12px] font-extrabold"
                style={{ background: accent, color: on }}
              >
                -{discountPct}%
              </span>
            )}
          </div>
        </section>

        {/* ---- Datos y precio ---- */}
        <section className="flex min-h-0 flex-col gap-3.5 overflow-y-auto rounded-[16px] border border-black/[0.07] bg-white p-5">
          <div>
            <span
              className="text-[11px] font-extrabold uppercase tracking-[2px]"
              style={{ color: accent }}
            >
              {promo.eyebrow}
            </span>
            <h1 className="mt-2 text-[clamp(1.25rem,2.1vw,1.65rem)] font-extrabold leading-[1.25] tracking-[-0.01em]">
              {promo.title}
            </h1>
            <p className="mt-1.5 text-[12.5px] text-black/45">
              {promo.productName}
              {promo.badge && (
                <>
                  {" · "}
                  <span className="font-bold" style={{ color: accent }}>
                    {promo.badge}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Precio: el de oferta grande y, si hay, el anterior y el ahorro */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-y border-black/[0.07] py-4">
            <span>
              <span className="block text-[clamp(1.9rem,3.4vw,2.5rem)] font-black leading-none">
                {bs(promo.price)}
              </span>
              <span className="mt-1.5 block text-[11.5px] text-black/45">
                Precio de la promoción
              </span>
            </span>
            {hasDiscount && (
              <>
                <span>
                  <span className="block text-[20px] font-semibold leading-none text-black/35 line-through">
                    {bs(promo.originalPrice!)}
                  </span>
                  <span className="mt-1.5 block text-[11.5px] text-black/45">Precio normal</span>
                </span>
                <span>
                  <span
                    className="block text-[20px] font-black leading-none"
                    style={{ color: accent }}
                  >
                    {bs(promo.originalPrice! - promo.price)}
                  </span>
                  <span className="mt-1.5 block text-[11.5px] text-black/45">Te ahorras</span>
                </span>
              </>
            )}
          </div>

          {deadline && <Countdown iso={deadline} accent={accent} on={on} />}

          {promo.description.trim() && (
            <p className="text-[13.5px] leading-relaxed text-black/65">{promo.description}</p>
          )}

          {/* Cifras destacadas: la fila de atributos de la ficha */}
          {promo.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {promo.stats.slice(0, 4).map((s, i) => (
                <div
                  key={i}
                  className="rounded-[10px] border border-black/[0.07] bg-[#F6F5F3] px-3 py-2.5"
                >
                  <span className="block text-[15px] font-black leading-none">{s.value}</span>
                  <span className="mt-1 block text-[10.5px] font-semibold uppercase tracking-[1px] text-black/45">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Beneficios: la lista corta de "qué incluye" */}
          {promo.highlights.length > 0 && (
            <ul className="mt-auto grid gap-1.5 pt-1 sm:grid-cols-2">
              {promo.highlights.slice(0, 6).map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-black/70">
                  <span className="mt-[3px] shrink-0" style={{ color: accent }}>
                    <Icon name={h.icon} size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="font-bold text-[#14110F]">{h.title}</span>
                    {h.text && <span className="text-black/55"> — {h.text}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Tarjeta de compra ---- */}
        <aside className="flex min-h-0 flex-col gap-3.5 overflow-y-auto rounded-[16px] border border-black/[0.07] bg-white p-5">
          <h2 className="text-[15px] font-extrabold">Cómo comprar</h2>
          <p className="text-[12.5px] leading-relaxed text-black/60">
            Toca <span className="font-bold text-[#14110F]">{promo.ctaLabel}</span> y te llevamos al
            catálogo de la tienda para elegir tus {noun.many} y hacer el pedido. ¿Dudas? Escríbenos
            por WhatsApp.
          </p>

          <Link
            href={link("/")}
            className="inline-flex items-center justify-center gap-2.5 rounded-[12px] px-5 py-[15px] text-[13px] font-extrabold uppercase tracking-wide transition-transform hover:-translate-y-0.5"
            style={{ background: accent, color: on }}
          >
            <ShoppingCart size={18} /> {promo.ctaLabel}
          </Link>
          <button
            onClick={consultar}
            className="inline-flex items-center justify-center gap-2.5 rounded-[12px] border-2 border-black/10 px-5 py-[13px] text-[13px] font-extrabold uppercase tracking-wide transition-colors hover:border-black/30"
          >
            <WhatsAppIcon size={18} /> Escríbenos
          </button>

          <ul className="grid gap-2.5 border-t border-black/[0.07] pt-4 text-[12.5px] text-black/65">
            <li className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-px shrink-0" style={{ color: accent }} />
              <span>
                <span className="block font-bold text-[#14110F]">Compra directa con nosotros</span>
                Sin intermediarios: el pedido llega a {business.name}.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="mt-px shrink-0" style={{ color: accent }} />
              <span>
                <span className="block font-bold text-[#14110F]">Dónde y cuándo</span>
                📍 {business.address}
                <br />🕐 {business.hours}
              </span>
            </li>
          </ul>

          <Link
            href={link("/")}
            className="mt-auto inline-flex items-center gap-2 pt-2 text-[12px] font-bold uppercase tracking-wide text-black/50 transition-colors hover:text-black"
          >
            Ver todo el catálogo <ArrowRight size={15} />
          </Link>
        </aside>
      </main>
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
    <span className="text-center">
      <span
        className="grid h-[38px] w-[38px] place-items-center rounded-[9px] text-[15px] font-black"
        style={{ background: accent, color: on }}
      >
        {v == null ? "--" : v.toString().padStart(2, "0")}
      </span>
      <span className="mt-1 block text-[9px] font-bold uppercase tracking-[1.2px] text-black/40">
        {l}
      </span>
    </span>
  );

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-black/45">
        Termina en
      </span>
      {box(left == null ? null : Math.floor(left / 86400000), "Días")}
      {box(left == null ? null : Math.floor((left / 3600000) % 24), "Hrs")}
      {box(left == null ? null : Math.floor((left / 60000) % 60), "Min")}
      {box(left == null ? null : Math.floor((left / 1000) % 60), "Seg")}
    </div>
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
