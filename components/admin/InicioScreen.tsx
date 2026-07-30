"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Coins,
  LineChart,
  Receipt,
  ShoppingCart,
  Wallet,
  Warehouse,
} from "lucide-react";
import { useAuth, useBusiness } from "@/context/StoreProvider";
import { apiReports } from "@/lib/reportsClient";
import { apiListPurchaseOrders } from "@/lib/purchaseClient";
import { apiCashShift } from "@/lib/cashClient";
import { bs2 } from "@/lib/products";
import { BigButton, DarkCard, Eyebrow, QuickAccess, StatCard } from "./kit";

/**
 * Secciones a las que Inicio puede mandar. Es un subconjunto del `Section` de
 * AdminShell: acá no se llega ni a Configuración ni a Usuarios.
 */
export type InicioSection =
  | "venta"
  | "catalogo"
  | "historial"
  | "proveedor"
  | "gastos"
  | "caja"
  | "reportes";

/**
 * Inicio — el resumen con el que arranca el CRM, con las mismas secciones que
 * la app de escritorio: lo vendido hoy, el inventario y los pedidos a proveedor
 * por recibir.
 *
 * El ancho es fluido: en una pantalla grande las tarjetas se reparten en varias
 * columnas en vez de quedar apiladas en una columna angosta con la mitad de la
 * página vacía.
 */
export function InicioScreen({ onGo }: { onGo: (s: InicioSection) => void }) {
  const auth = useAuth();
  const business = useBusiness();

  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState(0);
  const [stockBajo, setStockBajo] = useState(0);
  const [ventasHoy, setVentasHoy] = useState(0);
  const [numVentasHoy, setNumVentasHoy] = useState(0);
  const [pendientes, setPendientes] = useState(0);
  const [efectivoTurno, setEfectivoTurno] = useState(0);

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
      // Efectivo del TURNO abierto (desde el último corte), no del día: es el
      // número con el que se abre el cajón para hacer el arqueo.
      try {
        const turno = await apiCashShift();
        if (alive) setEfectivoTurno(turno.totalEfectivo);
      } catch {
        /* sin datos */
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const primer = auth.name.trim().split(" ")[0] || "";
  const negocio = business.name || "tu negocio";
  const dato = (v: string) => (loading ? "—" : v);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pb-12 pt-6 sm:px-8">
      {/* Saludo */}
      <h2 className="font-serif text-[30px] font-semibold leading-none text-ink">
        {primer ? `¡Hola, ${primer}!` : "¡Hola!"}
      </h2>
      <p className="mt-1.5 text-[13.5px] text-ink2">Este es el resumen de {negocio}.</p>

      {/* Vistazo: 2 columnas en el teléfono, hasta 4 en pantalla grande */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          icon={<ShoppingCart size={22} />}
          value={dato(bs2(ventasHoy))}
          label={
            numVentasHoy === 1 ? "Vendido hoy · 1 venta" : `Vendido hoy · ${numVentasHoy} ventas`
          }
          onClick={() => onGo("historial")}
        />
        <StatCard
          icon={<Boxes size={22} />}
          value={dato(`${productos}`)}
          label="Productos"
          onClick={() => onGo("catalogo")}
        />
        <StatCard
          icon={<AlertTriangle size={22} />}
          value={dato(`${stockBajo}`)}
          label="Stock bajo"
          color="#E0324E"
          highlight={stockBajo > 0}
          onClick={() => onGo("catalogo")}
        />
        <StatCard
          icon={<Coins size={22} />}
          value={dato(bs2(efectivoTurno))}
          label="Efectivo del turno"
          onClick={() => onGo("caja")}
        />
      </div>

      {/* Acciones grandes, lado a lado cuando hay ancho */}
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <DarkCard
          icon={<Warehouse size={24} />}
          value={dato(`${pendientes}`)}
          label={"Pedidos a proveedor\npor recibir"}
          onClick={() => onGo("proveedor")}
        />
        <BigButton
          icon={<ShoppingCart size={22} />}
          title="Nueva venta"
          subtitle="Cobrar del inventario"
          onClick={() => onGo("venta")}
        />
      </div>

      {/* Accesos rápidos */}
      <div className="mt-7">
        <Eyebrow>Accesos rápidos</Eyebrow>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <QuickAccess
            icon={<ShoppingCart size={19} />}
            title="Vender"
            subtitle="Nueva venta"
            onClick={() => onGo("venta")}
          />
          <QuickAccess
            icon={<Boxes size={19} />}
            title="Catálogo"
            subtitle="Ver inventario"
            onClick={() => onGo("catalogo")}
          />
          <QuickAccess
            icon={<Receipt size={19} />}
            title="Historial"
            subtitle="Ventas y proformas"
            onClick={() => onGo("historial")}
          />
          <QuickAccess
            icon={<Warehouse size={19} />}
            title="Pedir"
            subtitle="A proveedor"
            onClick={() => onGo("proveedor")}
          />
          <QuickAccess
            icon={<Wallet size={19} />}
            title="Gastos"
            subtitle="Cargar un egreso"
            onClick={() => onGo("gastos")}
          />
          <QuickAccess
            icon={<LineChart size={19} />}
            title="Reportes"
            subtitle="Ventas y ganancias"
            onClick={() => onGo("reportes")}
          />
        </div>
      </div>
    </div>
  );
}
