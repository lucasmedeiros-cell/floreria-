"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Brush,
  CheckCircle2,
  Clock,
  Flower2,
  Heart,
  Leaf,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { PromoConfig } from "@/lib/promo";
import { bs } from "@/lib/products";
import { openWhatsapp } from "@/lib/whatsapp";
import { FlowerMark, GoldRule, SectionHeading, Wordmark } from "../Brand";
import { PrimaryButton } from "../ui";
import { WhatsAppIcon } from "../WhatsAppIcon";
import { WhatsAppFab } from "../WhatsAppFab";

const ICONS: Record<string, LucideIcon> = {
  Sparkles, ShieldCheck, Flower2, Brush, Truck, Heart, Leaf, Clock, Star, Award, CheckCircle2,
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Cuenta regresiva real hasta `iso` (SSR-safe: "--" hasta montar en cliente). */
function Countdown({ iso }: { iso: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const target = new Date(iso).getTime();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);

  const d =
    left == null
      ? null
      : {
          days: Math.floor(left / 86400000),
          hours: Math.floor((left % 86400000) / 3600000),
          mins: Math.floor((left % 3600000) / 60000),
          secs: Math.floor((left % 60000) / 1000),
        };
  const cells: [string, number | null][] = [
    ["días", d?.days ?? null],
    ["hrs", d?.hours ?? null],
    ["min", d?.mins ?? null],
    ["seg", d?.secs ?? null],
  ];
  return (
    <div className="flex items-center gap-1.5">
      {cells.map(([label, v], i) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className="flex min-w-[54px] flex-col items-center rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 backdrop-blur">
            <span className="font-serif text-[22px] font-semibold leading-none tabular-nums text-goldSoft">
              {v == null ? "--" : pad(v)}
            </span>
            <span className="mt-1 text-[9.5px] uppercase tracking-wide text-white/60">
              {label}
            </span>
          </div>
          {i < cells.length - 1 && <span className="text-white/30">:</span>}
        </div>
      ))}
    </div>
  );
}

export function PromoLanding({ promo }: { promo: PromoConfig }) {
  // La config llega ya resuelta desde el servidor (SSR desde la base de datos).
  if (!promo.enabled) return <PromoDisabled />;

  const hasDiscount = promo.originalPrice && promo.originalPrice > promo.price;
  const discountPct = hasDiscount
    ? Math.round((1 - promo.price / promo.originalPrice!) * 100)
    : 0;
  const cta = () => openWhatsapp(promo.whatsappMessage);

  return (
    <div className="min-h-screen bg-bg">
      {/* ===================== HEADER ===================== */}
      <header className="sticky top-0 z-40 bg-bg shadow-soft">
        <div className="mx-auto flex max-w-shell items-center gap-4 px-5 py-3.5 md:px-[34px]">
          <Link href="/" className="flex items-center gap-2.5">
            <FlowerMark size={42} />
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="ml-auto text-[12.5px] font-semibold text-ink2 transition-colors hover:text-rose"
          >
            Ver toda la tienda
          </Link>
        </div>
      </header>

      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden bg-dark">
        <Image
          src={promo.image}
          alt={promo.productName}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-dark/70 via-dark/75 to-dark/95" />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 20% 15%,rgba(184,146,74,0.28),transparent 70%)",
          }}
        />

        <div className="relative mx-auto grid max-w-shell grid-cols-1 items-center gap-11 px-5 py-16 md:grid-cols-[6fr_5fr] md:px-[34px] md:py-24">
          {/* Texto */}
          <div className="reveal">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="eyebrow inline-flex items-center gap-1.5 text-[11px] font-semibold text-goldSoft">
                <Sparkles size={14} /> {promo.eyebrow}
              </span>
              {promo.badge && (
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(180deg,#C9305F,#8C153A)" }}
                >
                  {promo.badge}
                </span>
              )}
            </div>

            <h1 className="mt-4 font-serif text-[40px] font-semibold leading-[1.05] text-white md:text-[56px]">
              {promo.title}
            </h1>
            <div className="mt-4">
              <GoldRule width={64} />
            </div>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
              {promo.subtitle}
            </p>

            {/* Precio */}
            <div className="mt-7 flex flex-wrap items-end gap-3">
              <span className="font-serif text-[38px] font-bold leading-none text-white md:text-[46px]">
                {bs(promo.price)}
              </span>
              {hasDiscount && (
                <>
                  <span className="mb-1 text-[18px] text-white/50 line-through">
                    {bs(promo.originalPrice!)}
                  </span>
                  <span className="mb-1 rounded-full bg-success/90 px-2.5 py-1 text-[13px] font-bold text-white">
                    −{discountPct}%
                  </span>
                </>
              )}
            </div>

            {/* CTA + urgencia */}
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
              <PrimaryButton
                label={promo.ctaLabel}
                icon={<WhatsAppIcon size={18} />}
                onClick={cta}
              />
              {promo.validUntil && (
                <div className="flex flex-col gap-1.5">
                  <span className="eyebrow text-[10px] font-semibold text-white/60">
                    Termina en
                  </span>
                  <Countdown iso={promo.validUntil} />
                </div>
              )}
            </div>

            {/* Trust row */}
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/75">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-success" /> Compra segura
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck size={16} className="text-goldSoft" /> Entrega el mismo día
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Leaf size={16} className="text-success" /> Frescura garantizada
              </span>
            </div>
          </div>

          {/* Imagen destacada */}
          <div className="reveal relative mx-auto aspect-square w-full max-w-[420px]">
            <div className="absolute right-0 top-[4%] h-[88%] w-[80%] overflow-hidden rounded-[26px] shadow-card">
              <Image
                src={promo.image}
                alt={promo.productName}
                fill
                sizes="(max-width:768px) 80vw, 40vw"
                className="object-cover"
              />
            </div>
            {promo.imageAlt && (
              <div className="absolute bottom-0 left-0 rounded-[22px] bg-white p-[7px] shadow-card">
                <div className="relative h-[130px] w-[140px] overflow-hidden rounded-[15px] sm:h-[170px] sm:w-[185px]">
                  <Image
                    src={promo.imageAlt}
                    alt={promo.productName}
                    fill
                    sizes="185px"
                    className="object-cover"
                  />
                </div>
              </div>
            )}
            <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 shadow-soft">
              <Star size={15} className="text-gold" fill="#B8924A" />
              <span className="text-[11.5px] font-semibold text-ink">
                El más pedido
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        {promo.stats.length > 0 && (
          <div className="relative mx-auto max-w-shell px-5 pb-14 md:px-[34px]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {promo.stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-[18px] border border-white/12 bg-white/5 p-4 text-center backdrop-blur"
                >
                  <p className="font-serif text-[26px] font-bold text-white">
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-[10.5px] uppercase tracking-wide text-white/55">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ===================== DESCRIPCIÓN + HIGHLIGHTS ===================== */}
      <section className="mx-auto max-w-shell px-5 py-14 md:px-[34px]">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <SectionHeading
              eyebrow={promo.productName}
              title="Todo lo que incluye tu arreglo"
              subtitle={promo.description}
            />
            <div className="mt-7">
              <PrimaryButton
                label={promo.ctaLabel}
                icon={<WhatsAppIcon size={18} />}
                onClick={cta}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {promo.highlights.map((h) => {
              const Icon = ICONS[h.icon] ?? CheckCircle2;
              return (
                <div
                  key={h.title}
                  className="rounded-[18px] border border-line bg-surface p-5 shadow-soft"
                >
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[13px] text-white"
                    style={{
                      background: "linear-gradient(135deg,#C9305F,#8C153A)",
                      boxShadow: "0 5px 10px rgba(140,21,58,0.35)",
                    }}
                  >
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-3 text-[14.5px] font-semibold text-ink">
                    {h.title}
                  </h3>
                  {h.text && (
                    <p className="mt-1 text-[12.5px] text-ink2">{h.text}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== CTA FINAL ===================== */}
      <section className="relative overflow-hidden border-t border-line bg-surface2">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(50% 120% at 50% 0%,rgba(184,146,74,0.18),transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-16 text-center md:px-6">
          <div className="flex flex-col items-center">
            <SectionHeading
              eyebrow="No te quedes sin la tuya"
              title={promo.productName}
              center
            />
          </div>
          <p className="mx-auto mt-3.5 max-w-xl text-[14px] text-ink2">
            Stock limitado
            {promo.validUntil ? " · oferta por tiempo limitado" : ""}. Reserva
            hoy y la entregamos el mismo día en Santa Cruz.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <PrimaryButton
              label={promo.ctaLabel}
              icon={<WhatsAppIcon size={18} />}
              onClick={cta}
            />
            <span className="font-serif text-[26px] font-bold text-ink">
              {bs(promo.price)}
              {hasDiscount && (
                <span className="ml-2 text-[16px] font-normal text-faint line-through">
                  {bs(promo.originalPrice!)}
                </span>
              )}
            </span>
          </div>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose"
          >
            Ver toda la colección <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <WhatsAppFab
        onClick={() =>
          openWhatsapp("Hola FloresOnline 🌷, tengo una consulta sobre la promoción.")
        }
      />
    </div>
  );
}

/** Estado cuando el admin desactiva la landing promocional. */
function PromoDisabled() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <FlowerMark size={54} />
      <h1 className="mt-5 font-serif text-[26px] font-semibold text-ink">
        No hay una promoción activa
      </h1>
      <p className="mt-2 max-w-sm text-[14px] text-ink2">
        En este momento no tenemos una oferta destacada. Explora toda nuestra colección.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-rose"
      >
        Ir a la tienda <ArrowRight size={16} />
      </Link>
    </div>
  );
}
