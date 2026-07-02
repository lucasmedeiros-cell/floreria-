"use client";

import { useState } from "react";
import {
  Bike,
  CalendarClock,
  Flower2,
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
import { useAuth } from "@/context/StoreProvider";
import { FlowerMark, Wordmark } from "@/components/Brand";
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
import { AdminIntro } from "./AdminIntro";

type Section =
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
}

const NAV: NavDef[] = [
  { s: "pedidos", icon: <ListOrdered size={19} />, label: "Pedidos" },
  { s: "agenda", icon: <CalendarClock size={19} />, label: "Agenda" },
  { s: "clientes", icon: <Users size={19} />, label: "Clientes" },
  { s: "productos", icon: <Flower2 size={19} />, label: "Productos" },
  { s: "entregas", icon: <Truck size={19} />, label: "Entregas" },
  { s: "reportes", icon: <LineChart size={19} />, label: "Reportes" },
  { s: "configuracion", icon: <Settings size={19} />, label: "Configuración" },
  { s: "usuarios", icon: <IdCard size={19} />, label: "Usuarios" },
];

export function AdminShell({ adminIntro = true }: { adminIntro?: boolean }) {
  const [section, setSection] = useState<Section>("nuevoPedido");
  const [drawer, setDrawer] = useState(false);

  const go = (s: Section) => {
    setSection(s);
    setDrawer(false);
  };

  const page = () => {
    switch (section) {
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
      <AdminIntro enabled={adminIntro} />

      {/* Sidebar (lg) */}
      <div className="hidden lg:block">
        <Sidebar current={section} onSelect={go} />
      </div>

      {/* Drawer (mobile) */}
      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar current={section} onSelect={go} onClose={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* App bar (mobile) */}
        <div className="flex items-center gap-3 bg-dark px-4 py-3 lg:hidden">
          <button onClick={() => setDrawer(true)} className="text-white">
            <Menu size={24} />
          </button>
          <FlowerMark size={28} />
          <Wordmark light />
        </div>
        <div className="flex-1 overflow-hidden">{page()}</div>
      </div>
    </div>
  );
}

function Sidebar({
  current,
  onSelect,
  onClose,
}: {
  current: Section;
  onSelect: (s: Section) => void;
  onClose?: () => void;
}) {
  const auth = useAuth();
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
        className={`flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left ${
          active ? "bg-white/10" : "hover:bg-white/5"
        }`}
      >
        <span className={active ? "text-goldSoft" : "text-white/60"}>{n.icon}</span>
        <span
          className={`text-[13.5px] ${
            active ? "font-semibold text-white" : "font-medium text-white/70"
          }`}
        >
          {n.label}
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full w-64 flex-col bg-dark">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <FlowerMark size={38} />
        <Wordmark light />
        {onClose && (
          <button onClick={onClose} className="ml-auto text-white/70">
            <X size={20} />
          </button>
        )}
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
          {item({ s: "nuevoPedido", icon: <PlusSquare size={19} />, label: "Nuevo Pedido" })}
          {NAV.map((n) => item(n))}
        </div>
      </div>
      <div className="h-px bg-white/10" />
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gradient-to-b from-[#C9305F] to-[#8C153A] text-[13px] font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white">{auth.name}</p>
          <p className="text-[11px] text-white/50">{auth.role}</p>
        </div>
        <button onClick={auth.logout} title="Cerrar sesión" className="text-white/70">
          <LogOut size={19} />
        </button>
      </div>
    </div>
  );
}
