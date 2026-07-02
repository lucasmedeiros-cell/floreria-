"use client";

import { Minus, Plus } from "lucide-react";
import React from "react";

/** Botón primario "3D": gradiente vertical, sombra de color. */
export function PrimaryButton({
  label,
  onClick,
  icon,
  expand = false,
  disabled = false,
  colors = ["#C9305F", "#8C153A"],
}: {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  expand?: boolean;
  disabled?: boolean;
  colors?: [string, string];
}) {
  const deep = colors[1];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group inline-flex items-center justify-center gap-2.5 rounded-full border border-white/20 px-[26px] py-[15px] text-[13.5px] font-semibold tracking-wide text-white transition-all duration-100 active:translate-y-[3px] disabled:opacity-50 ${
        expand ? "w-full" : ""
      }`}
      style={{
        background: `linear-gradient(180deg,${colors[0]},${colors[1]})`,
        boxShadow: disabled
          ? "none"
          : `0 11px 20px ${deep}73, 0 3px 6px ${deep}47`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Botón secundario: superficie blanca elevada. */
export function OutlineButton({
  label,
  onClick,
  icon,
  color = "#241A1E",
  full = false,
}: {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  color?: string;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full border bg-surface px-[26px] py-[14px] text-[13px] font-semibold tracking-wide shadow-soft transition-all duration-100 active:translate-y-[2px] ${
        full ? "w-full" : ""
      }`}
      style={{ color, borderColor: `${color}47` }}
    >
      {icon}
      {label}
    </button>
  );
}

export function CategoryChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-[22px] py-[11px] text-[12.5px] font-semibold tracking-wide transition-all duration-200 ${
        selected
          ? "border-ink bg-ink text-white shadow-soft"
          : "border-line bg-transparent text-ink2"
      }`}
    >
      {label}
    </button>
  );
}

export function QtyStepper({
  value,
  onMinus,
  onPlus,
  height = 40,
}: {
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  height?: number;
}) {
  const btn = "flex items-center justify-center text-ink2";
  return (
    <div
      className="inline-flex items-center rounded-xl border border-line bg-surface2"
      style={{ height }}
    >
      <button
        type="button"
        onClick={onMinus}
        className={btn}
        style={{ width: height * 0.9, height }}
      >
        <Minus size={16} />
      </button>
      <span className="w-[26px] text-center text-[13.5px] font-semibold text-ink">
        {value}
      </span>
      <button
        type="button"
        onClick={onPlus}
        className={btn}
        style={{ width: height * 0.9, height }}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
