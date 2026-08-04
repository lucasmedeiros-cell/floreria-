"use client";

import {
  Award,
  BadgeCheck,
  Brush,
  Car,
  Clock,
  Cpu,
  Droplet,
  Flame,
  Flower2,
  Gift,
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
  Star,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppIcon";

/**
 * Iconos por nombre. Los rubros (lib/rubros.ts) y la landing guardan el icono
 * como string, así que la config es serializable y editable desde el panel.
 */
const ICONS: Record<string, LucideIcon> = {
  Award,
  BadgeCheck,
  Brush,
  Car,
  Clock,
  Cpu,
  Droplet,
  Flame,
  Flower2,
  Gift,
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
  Star,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
  Zap,
};

/**
 * Nombres válidos para un icono, para poder ofrecerlos en un desplegable del
 * CRM (Configuración → Landing) en vez de que haya que escribirlos de memoria.
 */
export const ICON_NAMES: string[] = ["WhatsApp", ...Object.keys(ICONS)].sort();

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
