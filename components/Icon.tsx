"use client";

import {
  BadgeCheck,
  Brush,
  Car,
  Cpu,
  Flower2,
  Heart,
  Laptop,
  Leaf,
  Package,
  Percent,
  Pill,
  QrCode,
  Search,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Shirt,
  Sparkles,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppIcon";

/**
 * Iconos por nombre. Los rubros (lib/rubros.ts) y la landing guardan el icono
 * como string, así que la config es serializable y editable desde el panel.
 */
const ICONS: Record<string, LucideIcon> = {
  BadgeCheck,
  Brush,
  Car,
  Cpu,
  Flower2,
  Heart,
  Laptop,
  Leaf,
  Package,
  Percent,
  Pill,
  QrCode,
  Search,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Shirt,
  Sparkles,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
};

export function Icon({
  name,
  size = 22,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  // El logo de WhatsApp no es de lucide (es la marca oficial).
  if (name === "WhatsApp") return <WhatsAppIcon size={size} />;
  const Cmp = ICONS[name] ?? Store;
  return <Cmp size={size} className={className} />;
}
