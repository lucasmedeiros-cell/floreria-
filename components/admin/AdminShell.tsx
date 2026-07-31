"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  LayoutGrid,
  LineChart,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Sun,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { useAuth, useBusiness } from "@/context/StoreProvider";
import Image from "next/image";
import { EASYPOS } from "@/lib/easypos";
import { InicioScreen } from "./InicioScreen";
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
  /**
   * Sección válida pero fuera del menú: se llega a ella desde otra pantalla.
   * Proveedor vive dentro de Inventario ("Proveedores"), como en el diseño.
   */
  oculto?: boolean;
}

const NAV: NavDef[] = [
  { s: "inicio", icon: <LayoutGrid size={19} />, label: "Resumen" },
  { s: "venta", icon: <ShoppingCart size={19} />, label: "Ventas" },
  { s: "catalogo", icon: <Boxes size={19} />, label: "Catálogo / Inventario" },
  { s: "historial", icon: <Receipt size={19} />, label: "Historial" },
  { s: "gastos", icon: <Wallet size={19} />, label: "Gastos" },
  { s: "caja", icon: <Coins size={19} />, label: "Corte de caja" },
  { s: "reportes", icon: <LineChart size={19} />, label: "Reportes" },
  { s: "usuarios", icon: <Users size={19} />, label: "Usuarios", soloAdmin: true },
  { s: "configuracion", icon: <Settings size={19} />, label: "Configuración" },
  { s: "proveedor", icon: <Warehouse size={19} />, label: "Proveedores", oculto: true },
];

/** Preferencia de modo oscuro del CRM. Se recuerda por navegador. */
const DARK_KEY = "easypos.crm.dark";

export function AdminShell({ adminIntro = true }: { adminIntro?: boolean }) {
  const [drawer, setDrawer] = useState(false);
  const [colapsado, setColapsado] = useState(false);
  const auth = useAuth();
  const business = useBusiness();
  // Igual que la app de escritorio: el CRM abre en Inicio.
  const [section, setSection] = useState<Section>("inicio");

  /**
   * Modo oscuro. Arranca en claro y se hidrata desde localStorage después de
   * montar: leerlo durante el render rompería el HTML del servidor.
   */
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try {
      setDark(window.localStorage.getItem(DARK_KEY) === "1");
    } catch {
      /* navegador sin storage (modo privado): queda en claro */
    }
  }, []);
  const toggleDark = useCallback(() => {
    setDark((d) => {
      try {
        window.localStorage.setItem(DARK_KEY, d ? "0" : "1");
      } catch {
        /* no se pudo recordar: igual cambia por esta sesión */
      }
      return !d;
    });
  }, []);

  const go = (s: Section) => {
    setSection(s);
    setDrawer(false);
  };

  const esAdmin = auth.role === "Administrador";
  const permitidas = NAV.filter((n) => !n.soloAdmin || esAdmin);
  const nav = permitidas.filter((n) => !n.oculto);
  // Si a alguien le cambian el rol mientras mira Usuarios, el CRM lo devuelve a
  // Inicio en vez de dejarlo en una pantalla que ya no le corresponde.
  const seccion: Section = permitidas.some((n) => n.s === section) ? section : "inicio";

  const page = () => {
    switch (seccion) {
      case "inicio":
        return <InicioScreen onGo={go} />;
      case "venta":
        return <VentasScreen />;
      case "catalogo":
        return <ProductsPage onGo={go} />;
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
    <div className={`${dark ? "dark " : ""}flex h-screen bg-bg`}>
      <EasyPosSplash enabled={adminIntro} />

      {/* Sidebar (lg) */}
      <div className="hidden lg:block">
        <Sidebar
          current={seccion}
          nav={nav}
          onSelect={go}
          colapsado={colapsado}
          onColapsar={() => setColapsado((c) => !c)}
          dark={dark}
          onDark={toggleDark}
        />
      </div>

      {/* Drawer (mobile) */}
      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar
              current={seccion}
              nav={nav}
              onSelect={go}
              onClose={() => setDrawer(false)}
              dark={dark}
              onDark={toggleDark}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Barra del teléfono: el menú vive en el cajón lateral. */}
        <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <button onClick={() => setDrawer(true)} aria-label="Menú" className="text-ink">
            <Menu size={24} />
          </button>
          <BusinessAvatar size={30} />
          <span className="truncate text-[14px] font-extrabold uppercase leading-tight text-ink">
            {business.name}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">{page()}</div>
      </div>

      <DebugReporter surface="crm" />
    </div>
  );
}

/** Isotipo del negocio: su logo o, si no cargó ninguno, el icono de tienda. */
function BusinessAvatar({ size = 44 }: { size?: number }) {
  const business = useBusiness();
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-onAccent/25 bg-onAccent/[0.07] text-onAccent"
      style={{ height: size, width: size }}
    >
      {business.logoUrl ? (
        <Image
          src={business.logoUrl}
          alt={business.name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <Store size={size * 0.5} />
      )}
    </span>
  );
}

function Sidebar({
  current,
  nav,
  onSelect,
  onClose,
  colapsado = false,
  onColapsar,
  dark,
  onDark,
}: {
  current: Section;
  /** Menú ya filtrado por el rol de quien inició sesión. */
  nav: NavDef[];
  onSelect: (s: Section) => void;
  onClose?: () => void;
  colapsado?: boolean;
  onColapsar?: () => void;
  dark: boolean;
  onDark: () => void;
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
        title={colapsado ? n.label : undefined}
        className={`relative flex w-full items-center gap-3 rounded-[12px] py-2.5 text-left transition-colors ${
          colapsado ? "justify-center px-0" : "px-3.5"
        } ${active ? "bg-pinkSoft" : "hover:bg-surface2"}`}
      >
        {/* Barra amarilla de la sección activa (como en el diseño). */}
        {active && (
          <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-pink" aria-hidden />
        )}
        <span className={active ? "text-ink" : "text-faint"}>{n.icon}</span>
        {!colapsado && (
          <span
            className={`truncate text-[13.5px] ${
              active ? "font-semibold text-ink" : "font-medium text-ink2"
            }`}
          >
            {n.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className={`flex h-full flex-col border-r border-line bg-surface transition-[width] duration-200 ${
        colapsado ? "w-[78px]" : "w-[272px]"
      }`}
    >
      {/* Cabecera amarilla con la marca del NEGOCIO (no la de easy pos). */}
      <div
        className={`flex px-4 py-4 ${
          // Contraído no entran el isotipo y el botón lado a lado (78 px de
          // ancho): se apilan, que si no el botón de expandir queda cortado.
          colapsado ? "flex-col items-center gap-2.5" : "items-center gap-3"
        }`}
        style={{ background: "linear-gradient(135deg,#FFC93C 0%,#FEBB03 55%,#F5A800 100%)" }}
      >
        <BusinessAvatar size={colapsado ? 38 : 44} />
        {!colapsado && (
          <span className="min-w-0 flex-1 text-[15px] font-extrabold uppercase leading-[1.15] tracking-[-0.2px] text-onAccent">
            {business.name}
          </span>
        )}
        {onColapsar && (
          <button
            onClick={onColapsar}
            aria-label={colapsado ? "Expandir el menú" : "Contraer el menú"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-onAccent/10 text-onAccent hover:bg-onAccent/20"
          >
            {colapsado ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        )}
        {onClose && (
          <button onClick={onClose} aria-label="Cerrar el menú" className="shrink-0 text-onAccent">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Secciones */}
      <div className="mt-4 flex-1 overflow-y-auto px-3">
        <div className="flex flex-col gap-0.5">{nav.map((n) => item(n))}</div>
      </div>

      {/* Quién está usando el CRM */}
      <div className="px-3 pb-1">
        <div
          className={`flex items-center gap-2.5 rounded-[14px] border border-line px-3 py-2.5 ${
            colapsado ? "justify-center px-0" : ""
          }`}
          title={colapsado ? `${auth.name} · ${auth.role}` : undefined}
        >
          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-pinkSoft text-[13px] font-bold text-ink">
            {initials}
          </span>
          {!colapsado && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {auth.name}
                </span>
                <span className="block text-[11px] italic text-faint">{auth.role}</span>
              </span>
              <ChevronDown size={16} className="shrink-0 text-faint" />
            </>
          )}
        </div>
      </div>

      {/* Administración: lo que no es una sección del negocio */}
      <div className="px-3 pb-2 pt-3">
        {!colapsado && (
          <span className="block px-1 pb-1.5 text-[11px] font-bold uppercase tracking-[0.5px] text-error">
            Administración
          </span>
        )}
        <button
          onClick={onDark}
          title={colapsado ? (dark ? "Modo claro" : "Modo oscuro") : undefined}
          className={`flex w-full items-center gap-3 rounded-[12px] py-2.5 text-left text-ink2 transition-colors hover:bg-surface2 ${
            colapsado ? "justify-center px-0" : "px-3.5"
          }`}
        >
          <span className="text-faint">{dark ? <Sun size={19} /> : <Moon size={19} />}</span>
          {!colapsado && (
            <span className="text-[13.5px] font-medium">{dark ? "Modo claro" : "Modo oscuro"}</span>
          )}
        </button>
        <button
          onClick={auth.logout}
          title={colapsado ? "Cerrar sesión" : undefined}
          className={`flex w-full items-center gap-3 rounded-[12px] py-2.5 text-left text-ink2 transition-colors hover:bg-surface2 ${
            colapsado ? "justify-center px-0" : "px-3.5"
          }`}
        >
          <span className="text-faint">
            <LogOut size={19} />
          </span>
          {!colapsado && <span className="text-[13.5px] font-medium">Cerrar sesión</span>}
        </button>
      </div>

      {/* Pie: el negocio y la versión de easy pos que está corriendo. */}
      <div className="border-t border-line px-4 py-3">
        {colapsado ? (
          <p className="text-center text-[10px] font-bold text-faint">V{EASYPOS.version}</p>
        ) : (
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.5px] text-faint">
            {business.name} • V{EASYPOS.version}
          </p>
        )}
      </div>
    </div>
  );
}
