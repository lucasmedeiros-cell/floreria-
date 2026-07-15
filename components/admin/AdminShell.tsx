"use client";

import { useState } from "react";
import {
  Bike,
  CalendarClock,
  Flower2,
  Home,
  IdCard,
  LineChart,
  ListOrdered,
  LogOut,
  Menu,
  Plus,
  PlusSquare,
  Settings,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useAuth, useBusiness } from "@/context/StoreProvider";
import { BrandMark, Wordmark } from "@/components/Brand";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { EASYPOS } from "@/lib/easypos";
import type { ModuleId } from "@/lib/modules";
import { PrimaryButton } from "@/components/ui";
import { NewOrderPage } from "./NewOrderPage";
import { OrdersPage } from "./OrdersPage";
import { ClientsPage } from "./ClientsPage";
import { ProductsPage } from "./ProductsPage";
import { AgendaPage } from "./AgendaPage";
import { EntregasPage } from "./EntregasPage";
import { ReportesPage } from "./ReportesPage";
import { ConfiguracionPage } from "./ConfiguracionPage";
import { UsuariosPage } from "./UsuariosPage";
import { DashboardPage } from "./DashboardPage";
import { EasyPosSplash } from "./EasyPosSplash";
import { DebugReporter } from "../DebugReporter";

type Section =
  | "inicio"
  | "nuevoPedido"
  | "pedidos"
  | "agenda"
  | "clientes"
  | "productos"
  | "entregas"
  | "reportes"
  | "configuracion"
  | "usuarios";

interface NavDef {
  s: Section;
  icon: React.ReactNode;
  label: string;
  /**
   * Módulo que hay que tener prendido para ver esta sección. Sin `mod`, la
   * sección es del núcleo del CRM y se ve siempre (Pedidos, Configuración).
   */
  mod?: ModuleId;
}

const NAV: NavDef[] = [
  { s: "pedidos", icon: <ListOrdered size={19} />, label: "Pedidos" },
  { s: "agenda", icon: <CalendarClock size={19} />, label: "Agenda", mod: "agenda" },
  { s: "clientes", icon: <Users size={19} />, label: "Clientes", mod: "clientes" },
  { s: "productos", icon: <Flower2 size={19} />, label: "Productos", mod: "productos" },
  { s: "entregas", icon: <Truck size={19} />, label: "Entregas", mod: "entregas" },
  { s: "reportes", icon: <LineChart size={19} />, label: "Reportes", mod: "reportes" },
  { s: "configuracion", icon: <Settings size={19} />, label: "Configuración" },
  { s: "usuarios", icon: <IdCard size={19} />, label: "Usuarios", mod: "usuarios" },
];

export function AdminShell({ adminIntro = true }: { adminIntro?: boolean }) {
  const [section, setSection] = useState<Section>("inicio");
  const [drawer, setDrawer] = useState(false);
  // Qué secciones usa este negocio (Configuración → Módulos del CRM).
  const modules = useBusiness().modules;

  const go = (s: Section) => {
    setSection(s);
    setDrawer(false);
  };

  // Si se apaga el módulo de la sección que estás mirando, el CRM te devuelve a
  // Inicio en vez de dejarte en una pantalla que ya no debería existir.
  const nav = NAV.filter((n) => !n.mod || modules[n.mod]);
  const visible = NAV.find((n) => n.s === section);
  const seccion: Section =
    visible && visible.mod && !modules[visible.mod] ? "inicio" : section;

  const page = () => {
    switch (seccion) {
      case "inicio":
        return <DashboardPage />;
      case "nuevoPedido":
        return <NewOrderPage onDone={() => go("pedidos")} />;
      case "pedidos":
        return <OrdersPage onNew={() => go("nuevoPedido")} />;
      case "clientes":
        return <ClientsPage onNew={() => go("nuevoPedido")} />;
      case "agenda":
        return <AgendaPage />;
      case "productos":
        return <ProductsPage />;
      case "entregas":
        return <EntregasPage />;
      case "reportes":
        return <ReportesPage />;
      case "configuracion":
        return <ConfiguracionPage />;
      case "usuarios":
        return <UsuariosPage />;
    }
  };

  return (
    <div className="flex h-screen bg-bg">
      <EasyPosSplash enabled={adminIntro} />

      {/* Sidebar (lg) */}
      <div className="hidden lg:block">
        <Sidebar current={seccion} nav={nav} onSelect={go} />
      </div>

      {/* Drawer (mobile) */}
      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar current={seccion} nav={nav} onSelect={go} onClose={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* App bar (mobile) */}
        <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setDrawer(true)} className="text-ink">
            <Menu size={24} />
          </button>
          <BrandMark size={28} />
          <Wordmark />
        </div>
        <div className="flex-1 overflow-hidden">{page()}</div>
      </div>

      <DebugReporter surface="crm" />
    </div>
  );
}

function Sidebar({
  current,
  nav,
  onSelect,
  onClose,
}: {
  current: Section;
  /** Menú ya filtrado por los módulos que usa el negocio. */
  nav: NavDef[];
  onSelect: (s: Section) => void;
  onClose?: () => void;
}) {
  const auth = useAuth();
  const business = useBusiness();
  const initials = auth.name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  const item = (n: NavDef) => {
    const active = current === n.s;
    return (
      <button
        key={n.s}
        onClick={() => onSelect(n.s)}
        className={`flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left transition-colors ${
          active ? "bg-pinkSoft" : "hover:bg-surface2"
        }`}
      >
        <span className={active ? "text-pink" : "text-faint"}>{n.icon}</span>
        <span
          className={`text-[13.5px] ${
            active ? "font-semibold text-pink" : "font-medium text-ink2"
          }`}
        >
          {n.label}
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-line bg-white">
      <div className="flex items-center gap-2.5 px-5 pb-2 pt-5">
        <BrandMark size={38} />
        <Wordmark />
        {onClose && (
          <button onClick={onClose} className="ml-auto text-ink2">
            <X size={20} />
          </button>
        )}
      </div>
      {/* Rubro activo: se cambia en Configuración → Rubro del negocio. */}
      <div className="px-5 pb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pinkSoft px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[1px] text-pink">
          <Icon name={business.rubro.icon} size={12} />
          {business.rubro.label}
        </span>
      </div>
      <div className="px-4">
        <PrimaryButton
          label="Nuevo Pedido"
          icon={<Plus size={18} />}
          expand
          onClick={() => onSelect("nuevoPedido")}
        />
      </div>
      <div className="mt-4 flex-1 overflow-y-auto px-3">
        <div className="flex flex-col gap-0.5">
          {item({ s: "inicio", icon: <Home size={19} />, label: "Inicio" })}
          {item({ s: "nuevoPedido", icon: <PlusSquare size={19} />, label: "Nuevo Pedido" })}
          {nav.map((n) => item(n))}
        </div>
      </div>
      <div className="h-px bg-line" />
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-pink text-[13px] font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{auth.name}</p>
          <p className="text-[11px] text-faint">{auth.role}</p>
        </div>
        <button onClick={auth.logout} title="Cerrar sesión" className="text-ink2 hover:text-pink">
          <LogOut size={19} />
        </button>
      </div>
      {/* Marca del producto: el CRM es easy pos (el negocio es el inquilino). */}
      <div className="flex items-center justify-center gap-2 border-t border-line py-3">
        <Image src={EASYPOS.logo} alt="" width={22} height={22} className="rounded-[4px]" />
        <span className="text-[10.5px] font-bold uppercase tracking-[2px] text-faint">
          {EASYPOS.name}
        </span>
      </div>
    </div>
  );
}
