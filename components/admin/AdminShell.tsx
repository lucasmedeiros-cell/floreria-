"use client";

import { useState } from "react";
import {
  Boxes,
  Coins,
  Home,
  LineChart,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { useAuth, useBusiness } from "@/context/StoreProvider";
import { BrandMark, Wordmark } from "@/components/Brand";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { EASYPOS } from "@/lib/easypos";
import { DEFAULT_RUBRO_ID } from "@/lib/rubros";
import { PrimaryButton } from "@/components/ui";
import { InicioScreen } from "./InicioScreen";
import { CurvedHeader } from "./kit";
import { VentasScreen } from "./VentasScreen";
import { HistorialPage } from "./HistorialPage";
import { ProveedorPage } from "./ProveedorPage";
import { ProductsPage } from "./ProductsPage";
import { GastosPage } from "./GastosPage";
import { CajaPage } from "./CajaPage";
import { ReportesPage } from "./ReportesPage";
import { ConfiguracionPage } from "./ConfiguracionPage";
import { UsuariosPage } from "./UsuariosPage";
import { EasyPosSplash } from "./EasyPosSplash";
import { DebugReporter } from "../DebugReporter";

/**
 * Las secciones del CRM web son EXACTAMENTE las de la app de escritorio
 * (desktop/renderer/app.js → NAV), más Configuración, que en el escritorio no
 * existe porque la tienda y la landing se configuran desde acá.
 *
 * El flujo de reparto (Nuevo Pedido, Pedidos, Agenda, Entregas, Clientes) quedó
 * fuera del menú: sus pantallas siguen en `components/admin/` por si un negocio
 * de delivery vuelve a necesitarlas, pero hoy no se muestran en ningún lado.
 */
export type Section =
  | "inicio"
  | "venta"
  | "catalogo"
  | "historial"
  | "proveedor"
  | "gastos"
  | "caja"
  | "reportes"
  | "usuarios"
  | "configuracion";

interface NavDef {
  s: Section;
  icon: React.ReactNode;
  label: string;
  /** Solo para el administrador (el backend lo vuelve a exigir igual). */
  soloAdmin?: boolean;
}

const NAV: NavDef[] = [
  { s: "inicio", icon: <Home size={19} />, label: "Inicio" },
  { s: "venta", icon: <ShoppingCart size={19} />, label: "Venta" },
  { s: "catalogo", icon: <Boxes size={19} />, label: "Catálogo" },
  { s: "historial", icon: <Receipt size={19} />, label: "Historial" },
  { s: "proveedor", icon: <Warehouse size={19} />, label: "Proveedor" },
  { s: "gastos", icon: <Wallet size={19} />, label: "Gastos" },
  { s: "caja", icon: <Coins size={19} />, label: "Corte de caja" },
  { s: "reportes", icon: <LineChart size={19} />, label: "Reportes" },
  { s: "usuarios", icon: <Users size={19} />, label: "Usuarios", soloAdmin: true },
  { s: "configuracion", icon: <Settings size={19} />, label: "Configuración" },
];

// Secciones ya convertidas al diseño de la app (header curvo + kit). Se van
// sumando a medida que se rehace cada pantalla para la paridad web ↔ móvil.
const KIT_SECTIONS = new Set<Section>(["inicio"]);
const SECTION_TITLE: Record<Section, string> = {
  inicio: "Inicio",
  venta: "Venta",
  catalogo: "Catálogo",
  historial: "Historial",
  proveedor: "Pedidos a proveedor",
  gastos: "Gastos",
  caja: "Corte de caja",
  reportes: "Reportes",
  usuarios: "Usuarios",
  configuracion: "Configuración",
};

export function AdminShell({ adminIntro = true }: { adminIntro?: boolean }) {
  const [drawer, setDrawer] = useState(false);
  const auth = useAuth();
  // Igual que la app de escritorio: el CRM abre en Inicio.
  const [section, setSection] = useState<Section>("inicio");

  const go = (s: Section) => {
    setSection(s);
    setDrawer(false);
  };

  const esAdmin = auth.role === "Administrador";
  const nav = NAV.filter((n) => !n.soloAdmin || esAdmin);
  // Si a alguien le cambian el rol mientras mira Usuarios, el CRM lo devuelve a
  // Inicio en vez de dejarlo en una pantalla que ya no le corresponde.
  const seccion: Section = nav.some((n) => n.s === section) ? section : "inicio";

  const page = () => {
    switch (seccion) {
      case "inicio":
        return <InicioScreen onGo={go} />;
      case "venta":
        return <VentasScreen />;
      case "catalogo":
        return <ProductsPage />;
      case "historial":
        return <HistorialPage />;
      case "proveedor":
        return <ProveedorPage />;
      case "gastos":
        return <GastosPage />;
      case "caja":
        return <CajaPage />;
      case "reportes":
        return <ReportesPage />;
      case "usuarios":
        return <UsuariosPage />;
      case "configuracion":
        return <ConfiguracionPage />;
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
        {KIT_SECTIONS.has(seccion) ? (
          // Pantallas con el diseño de la app: header amarillo curvo + contenido.
          <div className="flex h-full flex-col">
            <CurvedHeader
              title={SECTION_TITLE[seccion]}
              onMenu={() => setDrawer(true)}
              onBell={() => {}}
            />
            <div className="-mt-3 flex-1 overflow-y-auto">{page()}</div>
          </div>
        ) : (
          <>
            {/* App bar (mobile) — pantallas aún no convertidas al kit. */}
            <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
              <button onClick={() => setDrawer(true)} className="text-ink">
                <Menu size={24} />
              </button>
              <BrandMark size={28} />
              <Wordmark />
            </div>
            <div className="flex-1 overflow-hidden">{page()}</div>
          </>
        )}
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
  /** Menú ya filtrado por el rol de quien inició sesión. */
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
        <span className={active ? "text-ink" : "text-faint"}>{n.icon}</span>
        <span
          className={`text-[13.5px] ${
            active ? "font-semibold text-ink" : "font-medium text-ink2"
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
      {/* Rubro activo. Si todavía no se definió no mostramos la etiqueta: un
          "SIN DEFINIR" no le dice nada al negocio. */}
      {business.rubro.id === DEFAULT_RUBRO_ID ? (
        <div className="pb-3" />
      ) : (
        <div className="px-5 pb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-pinkSoft px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[1px] text-ink">
            <Icon name={business.rubro.icon} size={12} />
            {business.rubro.label}
          </span>
        </div>
      )}
      <div className="px-4">
        <PrimaryButton
          label="Nueva venta"
          icon={<ShoppingCart size={18} />}
          expand
          onClick={() => onSelect("venta")}
        />
      </div>
      <div className="mt-4 flex-1 overflow-y-auto px-3">
        <div className="flex flex-col gap-0.5">{nav.map((n) => item(n))}</div>
      </div>
      <div className="h-px bg-line" />
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-pink text-[13px] font-bold text-onAccent">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{auth.name}</p>
          <p className="text-[11px] text-faint">{auth.role}</p>
        </div>
        <button onClick={auth.logout} title="Cerrar sesión" className="text-ink2 hover:text-ink">
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
