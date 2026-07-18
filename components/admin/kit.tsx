"use client";

// Kit de diseño del CRM web — réplica del sistema visual de la app móvil
// (mobile/admin_app/lib/widgets.dart + theme.dart): header amarillo curvo,
// tarjetas blancas con esquina de color, tarjeta oscura, accesos rápidos y
// botón grande. Serif (Cormorant) para títulos/números, sans (Poppins) para el
// resto. Así el web y el teléfono se ven iguales.

import type { ReactNode } from "react";
import { Bell, ChevronRight, Menu, Settings, Wrench } from "lucide-react";
import { EASYPOS_COLORS } from "@/lib/business";

/* ============================ Header curvo ============================ */

export function CurvedHeader({
  title,
  onMenu,
  badge = 0,
  onBell,
  action,
}: {
  title: string;
  onMenu?: () => void;
  badge?: number;
  onBell?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="relative">
      <div
        className="relative overflow-hidden px-5 pb-9 pt-5"
        style={{
          background: "linear-gradient(135deg, #FFC93C 0%, #FEBB03 55%, #F5A800 100%)",
        }}
      >
        {/* Marca de agua: llave + engranaje, muy sutil */}
        <Wrench
          size={150}
          className="pointer-events-none absolute -right-6 -top-8 rotate-[-28deg] text-white/[0.14]"
        />
        <Settings
          size={64}
          className="pointer-events-none absolute right-24 top-6 text-white/[0.10]"
        />

        <div className="relative flex items-center gap-3.5">
          {onMenu && (
            <button
              onClick={onMenu}
              aria-label="Menú"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-dark text-white lg:hidden"
            >
              <Menu size={22} />
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate font-serif text-[24px] font-bold leading-none text-ink">
            {title}
          </h1>
          {action ??
            (onBell && (
              <button
                onClick={onBell}
                aria-label="Notificaciones"
                className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-dark text-white"
              >
                <Bell size={20} />
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* Borde inferior en onda (mismo trazo que _WaveClipper de la app). */}
      <svg
        className="absolute inset-x-0 bottom-0 block h-[26px] w-full"
        viewBox="0 0 100 26"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0,26 L0,10 Q22,26 50,16 Q80,2 100,20 L100,26 Z"
          fill="#F6F4F1"
        />
      </svg>
    </div>
  );
}

/* ============================ Tarjeta de dato ============================ */

export function StatCard({
  icon,
  value,
  label,
  color = EASYPOS_COLORS.accent,
  highlight = false,
  onClick,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  /** Color de acento de la tarjeta (esquina + ícono). */
  color?: string;
  /** Resalta (borde) cuando el dato requiere atención (ej. stock bajo > 0). */
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-[20px] border bg-surface p-4 text-left shadow-card transition-transform hover:-translate-y-0.5"
      style={{ borderColor: highlight ? color : "#E7E1DA" }}
    >
      {/* Esquina de color */}
      <span
        className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-[0.12]"
        style={{ background: color }}
      />
      <span
        className="grid h-11 w-11 place-items-center rounded-[13px]"
        style={{ background: `${color}1f`, color }}
      >
        {icon}
      </span>
      <p className="mt-3 font-serif text-[30px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1 text-[12.5px] font-medium text-ink2">{label}</p>
    </button>
  );
}

/* ============================ Tarjeta oscura ============================ */

export function DarkCard({
  icon,
  value,
  label,
  onClick,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[20px] p-4 text-left"
      style={{ background: "linear-gradient(135deg,#2A2320,#1B1613 55%,#0E0B09)" }}
    >
      <span
        className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full text-onAccent"
        style={{ background: `linear-gradient(135deg,${EASYPOS_COLORS.accent},${EASYPOS_COLORS.accentDeep})` }}
      >
        {icon}
      </span>
      <span className="font-serif text-[26px] font-bold leading-none text-white">{value}</span>
      <span className="flex-1 whitespace-pre-line text-[13px] font-semibold leading-tight text-white">
        {label}
      </span>
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-pink/60 text-pink">
        <ChevronRight size={20} />
      </span>
    </button>
  );
}

/* ============================ Botón grande ============================ */

export function BigButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[18px] px-5 py-4 text-onAccent transition-transform hover:-translate-y-0.5"
      style={{ background: `linear-gradient(135deg,${EASYPOS_COLORS.accent},${EASYPOS_COLORS.accentDeep})` }}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-black/10">
        {icon}
      </span>
      <span className="flex-1 text-left">
        <span className="block font-serif text-[18px] font-bold leading-none">{title}</span>
        {subtitle && <span className="mt-1 block text-[12.5px] font-medium opacity-80">{subtitle}</span>}
      </span>
      <ChevronRight size={22} />
    </button>
  );
}

/* ============================ Acceso rápido ============================ */

export function QuickAccess({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-start gap-2.5 rounded-[16px] border border-line bg-surface p-4 text-left shadow-soft transition-transform hover:-translate-y-0.5"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-pinkSoft text-ink">
        {icon}
      </span>
      <span>
        <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[11.5px] text-faint">{subtitle}</span>
      </span>
    </button>
  );
}

/* ============================ Eyebrow ============================ */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-0.5 w-4 rounded-full"
        style={{ background: `linear-gradient(90deg,${EASYPOS_COLORS.accent},${EASYPOS_COLORS.accentDeep})` }}
      />
      <span className="text-[10.5px] font-semibold uppercase tracking-[3px] text-gold">
        {children}
      </span>
    </div>
  );
}
