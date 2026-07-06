"use client";

import Image from "next/image";

/** Marca (flor) — logo real de FloresOnline. */
export function FlowerMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/images/logo-mark.png"
      alt="FloresOnline"
      width={Math.round(size * 0.94)}
      height={size}
      loading="eager"
      className="shrink-0 object-contain"
    />
  );
}

/** Logo completo (marca + texto) para usos donde luce el lockup horizontal. */
export function LogoLockup({ height = 40 }: { height?: number }) {
  return (
    <Image
      src="/images/logo.png"
      alt="FloresOnline"
      width={Math.round(height * (942 / 225))}
      height={height}
      loading="eager"
      className="object-contain"
    />
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span
        className={`text-[1.55rem] font-semibold tracking-[-.5px] ${
          light ? "text-white" : "text-ink"
        }`}
      >
        <b className="font-light">Flores</b>Online
      </span>
      <span
        className={`mt-[1px] text-[.52rem] font-medium tracking-[3px] ${
          light ? "text-white/60" : "text-faint"
        }`}
      >
        ARTE FLORAL EN CADA DETALLE
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
      <span className="eyebrow text-[11px] font-semibold text-pink">{eyebrow}</span>
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
