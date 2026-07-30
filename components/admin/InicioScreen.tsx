"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  LineChart,
  ListOrdered,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { useAuth, useBusiness, useOrders } from "@/context/StoreProvider";
import { apiReports } from "@/lib/reportsClient";
import { apiListPurchaseOrders } from "@/lib/purchaseClient";
import { bs2 } from "@/lib/products";
import { orderTotal, statusLabel } from "@/lib/adminData";
import type { ModuleId } from "@/lib/modules";
import { BigButton, DarkCard, Eyebrow, QuickAccess, StatCard } from "./kit";

/** Secciones del CRM a las que Inicio puede mandar (las de AdminShell). */
export type InicioSection =
  | "ventas"
  | "nuevoPedido"
  | "pedidos"
  | "proveedor"
  | "agenda"
  | "clientes"
  | "productos"
  | "entregas"
  | "reportes";

/**
 * Inicio — el resumen con el que arranca el CRM.
 *
 * Se arma con los MÓDULOS del negocio (Configuración → Módulos), no con una
 * lista fija: una tienda de mostrador ve ventas del día e inventario; una
 * florería, sus entregas y su agenda. Un negocio que apagó un módulo no ve sus
 * tarjetas — antes Inicio hablaba de inventario y proveedores aunque el negocio
 * no usara ninguno de los dos.
 *
 * El ancho es fluido: en una pantalla grande las tarjetas se reparten en varias
 * columnas en vez de quedar apiladas en una columna angosta con la mitad de la
 * página vacía.
 */
export function InicioScreen({ onGo }: { onGo: (s: InicioSection) => void }) {
  const auth = useAuth();
  const business = useBusiness();
  const { orders } = useOrders();
  const mod = business.modules;

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState(0);
  const [stockBajo, setStockBajo] = useState(0);
  const [ventasHoy, setVentasHoy] = useState(0);
  const [numVentasHoy, setNumVentasHoy] = useState(0);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Catálogo (total y stock bajo) y ventas DEL DÍA, que es el dato que se
      // mira al abrir el CRM por la mañana.
      const hoy = new Date();
      const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
        hoy.getDate()
      ).padStart(2, "0")}`;
      try {
        const [todo, dia] = await Promise.all([
          apiReports(),
          apiReports({ desde: iso, hasta: iso }),
        ]);
        if (alive) {
          setProductos(todo.totalProductos);
          setStockBajo(todo.stockBajo);
          setVentasHoy(dia.totalVentas);
          setNumVentasHoy(dia.numVentas);
        }
      } catch {
        /* sin datos */
      }
      try {
        const pos = await apiListPurchaseOrders();
        if (alive) setPendientes(pos.filter((p) => p.status === "solicitado").length);
      } catch {
        /* sin datos */
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Los pedidos ya viven en el contexto (se refrescan solos cada 10 s), así que
  // estos números no cuestan una consulta más.
  const { porEntregar, hoyEntregas } = useMemo(() => {
    const activo = (s: string) => s !== "entregado" && s !== "cancelado";
    const mismoDia = (d: Date) => {
      const h = new Date();
      return (
        d.getDate() === h.getDate() &&
        d.getMonth() === h.getMonth() &&
        d.getFullYear() === h.getFullYear()
      );
    };
    return {
      porEntregar: orders.filter((o) => activo(o.status)).length,
      hoyEntregas: orders.filter((o) => activo(o.status) && mismoDia(o.deliveryDate)).length,
    };
  }, [orders]);

  /** Los 5 pedidos más nuevos, para ver el movimiento sin cambiar de pantalla. */
  const ultimos = useMemo(
    () =>
      [...orders]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
    [orders]
  );

  const primer = auth.name.trim().split(" ")[0] || "";
  const negocio = business.name || "tu negocio";
  const dato = (v: string) => (loading ? "—" : v);

  /* ---- Tarjetas de vistazo, según lo que use el negocio ---- */
  const stats: React.ReactNode[] = [];
  if (mod.ventas) {
    stats.push(
      <StatCard
        key="ventas"
        icon={<ShoppingCart size={22} />}
        value={dato(bs2(ventasHoy))}
        label={numVentasHoy === 1 ? "Vendido hoy · 1 venta" : `Vendido hoy · ${numVentasHoy} ventas`}
        onClick={() => onGo("ventas")}
      />
    );
  }
  stats.push(
    <StatCard
      key="pedidos"
      icon={<ListOrdered size={22} />}
      value={dato(`${porEntregar}`)}
      label="Pedidos abiertos"
      onClick={() => onGo("pedidos")}
    />
  );
  if (mod.entregas) {
    stats.push(
      <StatCard
        key="entregas"
        icon={<Truck size={22} />}
        value={dato(`${hoyEntregas}`)}
        label="Entregas de hoy"
        highlight={hoyEntregas > 0}
        onClick={() => onGo("entregas")}
      />
    );
  }
  if (mod.productos) {
    stats.push(
      <StatCard
        key="productos"
        icon={<Package size={22} />}
        value={dato(`${productos}`)}
        label="Productos"
        onClick={() => onGo("productos")}
      />,
      <StatCard
        key="stock"
        icon={<AlertTriangle size={22} />}
        value={dato(`${stockBajo}`)}
        label="Stock bajo"
        color="#E0324E"
        highlight={stockBajo > 0}
        onClick={() => onGo("productos")}
      />
    );
  }

  /* ---- Accesos rápidos ---- */
  type Acceso = {
    id: InicioSection;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    mod?: ModuleId;
  };
  const accesos: Acceso[] = ([
    { id: "ventas", icon: <ShoppingCart size={19} />, title: "Vender", subtitle: "Nueva venta", mod: "ventas" },
    { id: "nuevoPedido", icon: <ListOrdered size={19} />, title: "Nuevo pedido", subtitle: "Cargar un pedido" },
    { id: "productos", icon: <Package size={19} />, title: "Productos", subtitle: "Ver inventario", mod: "productos" },
    { id: "proveedor", icon: <Warehouse size={19} />, title: "Pedir", subtitle: "A proveedor" },
    { id: "entregas", icon: <Truck size={19} />, title: "Entregas", subtitle: "Reparto de hoy", mod: "entregas" },
    { id: "agenda", icon: <CalendarClock size={19} />, title: "Agenda", subtitle: "Por fecha", mod: "agenda" },
    { id: "clientes", icon: <Users size={19} />, title: "Clientes", subtitle: "Libreta", mod: "clientes" },
    { id: "reportes", icon: <LineChart size={19} />, title: "Reportes", subtitle: "Ventas y ganancias", mod: "reportes" },
  ] as Acceso[]).filter((a) => !a.mod || mod[a.mod]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pb-12 pt-6 sm:px-8">
      {/* Saludo */}
      <h2 className="font-serif text-[30px] font-semibold leading-none text-ink">
        {primer ? `¡Hola, ${primer}!` : "¡Hola!"}
      </h2>
      <p className="mt-1.5 text-[13.5px] text-ink2">Este es el resumen de {negocio}.</p>

      {/* Vistazo: 2 columnas en el teléfono, hasta 5 en pantalla grande */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        {stats}
      </div>

      {/* Acciones grandes, lado a lado cuando hay ancho */}
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <DarkCard
          icon={<Truck size={24} />}
          value={dato(`${pendientes}`)}
          label={"Pedidos a proveedor\npor recibir"}
          onClick={() => onGo("proveedor")}
        />
        {mod.productos ? (
          <BigButton
            icon={<Package size={22} />}
            title="Ver inventario"
            subtitle="Productos, precios y stock"
            onClick={() => onGo("productos")}
          />
        ) : (
          <BigButton
            icon={<ListOrdered size={22} />}
            title="Cargar un pedido"
            subtitle="Nuevo pedido del negocio"
            onClick={() => onGo("nuevoPedido")}
          />
        )}
      </div>

      {/* Accesos rápidos */}
      <div className="mt-7">
        <Eyebrow>Accesos rápidos</Eyebrow>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {accesos.map((a) => (
            <QuickAccess
              key={a.id}
              icon={a.icon}
              title={a.title}
              subtitle={a.subtitle}
              onClick={() => onGo(a.id)}
            />
          ))}
        </div>
      </div>

      {/* Últimos pedidos: lo que estaba pasando en el negocio, sin salir de acá */}
      <div className="mt-7">
        <Eyebrow>Últimos pedidos</Eyebrow>
        <div className="mt-3 overflow-hidden rounded-[18px] border border-line bg-surface shadow-soft">
          {ultimos.length === 0 ? (
            <button
              onClick={() => onGo("nuevoPedido")}
              className="flex w-full flex-col items-center gap-1 px-5 py-10 text-center"
            >
              <ListOrdered size={26} className="text-faint" />
              <span className="mt-1 text-[13.5px] font-semibold text-ink">
                Todavía no hay pedidos
              </span>
              <span className="text-[12px] text-ink2">
                Carga el primero desde “Nuevo pedido”.
              </span>
            </button>
          ) : (
            ultimos.map((o, i) => (
              <button
                key={o.code}
                onClick={() => onGo("pedidos")}
                className={`flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface2 ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <span className="w-[92px] shrink-0 text-[12.5px] font-semibold text-ink">
                  {o.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {o.clientName || "Sin cliente"}
                </span>
                <span className="hidden w-[110px] shrink-0 text-[12px] text-ink2 sm:block">
                  {o.deliveryDate.toLocaleDateString("es-BO", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <span className="w-[96px] shrink-0 text-right text-[13px] font-semibold text-ink">
                  {bs2(orderTotal(o))}
                </span>
                <span className="w-[104px] shrink-0 text-right">
                  <span className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-ink2">
                    {statusLabel(o.status)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
