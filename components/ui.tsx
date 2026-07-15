"use client";

import { Minus, Plus } from "lucide-react";
import React from "react";
import { useBusiness } from "@/context/StoreProvider";

/** Botón primario plano con el color de marca del rubro, igual que la tienda. */
export function PrimaryButton({
  label,
  onClick,
  icon,
  expand = false,
  disabled = false,
  colors,
  type = "button",
}: {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  expand?: boolean;
  disabled?: boolean;
  colors?: [string, string];
  type?: "button" | "submit";
}) {
  const accent = useBusiness().colors.accent;
  const bg = colors ? colors[0] : accent;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-[14px] text-[13.5px] font-semibold tracking-wide text-white transition-colors hover:opacity-90 disabled:opacity-50 ${
        expand ? "w-full" : ""
      }`}
      style={{ background: bg }}
    >
      {icon}
      {label}
    </button>
  );
}

/** Botón secundario: borde fino, se rellena al pasar el cursor. */
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
      className={`inline-flex items-center justify-center gap-2.5 rounded-full border bg-white px-7 py-[13px] text-[13px] font-semibold tracking-wide transition-colors hover:bg-[color:var(--btn)] hover:text-white ${
        full ? "w-full" : ""
      }`}
      style={
        { color, borderColor: color, "--btn": color } as React.CSSProperties
      }
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
      className={`rounded-full border px-[22px] py-[11px] text-[12.5px] font-semibold tracking-wide transition-colors ${
        selected
          ? "border-pink bg-pink text-white"
          : "border-line bg-transparent text-ink2 hover:border-pink hover:text-pink"
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
