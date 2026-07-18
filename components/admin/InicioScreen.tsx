"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useAuth, useBusiness } from "@/context/StoreProvider";
import { apiReports } from "@/lib/reportsClient";
import { apiListPurchaseOrders } from "@/lib/purchaseClient";
import { BigButton, DarkCard, Eyebrow, QuickAccess, StatCard } from "./kit";

/**
 * Inicio — mini panel de arranque, igual que la app móvil (inicio_screen.dart):
 * saludo, dos tarjetas de vistazo (productos / stock bajo), tarjeta oscura de
 * pedidos por recibir, botón principal y accesos rápidos.
 */
export function InicioScreen({
  onVentas,
  onProductos,
  onPedidos,
}: {
  onVentas: () => void;
  onProductos: () => void;
  onPedidos: () => void;
}) {
  const auth = useAuth();
  const business = useBusiness();
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState(0);
  const [stockBajo, setStockBajo] = useState(0);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiReports();
        if (alive) {
          setProductos(r.totalProductos);
          setStockBajo(r.stockBajo);
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

  const primer = auth.name.trim().split(" ")[0] || "";
  const negocio = business.name || "tu negocio";

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-10 pt-6">
      {/* Saludo */}
      <h2 className="font-serif text-[30px] font-semibold leading-none text-ink">
        {primer ? `¡Hola, ${primer}!` : "¡Hola!"}
      </h2>
      <p className="mt-1.5 text-[13.5px] text-ink2">Este es el resumen de {negocio}.</p>

      {/* Vistazo */}
      <div className="mt-5 grid grid-cols-2 gap-3.5">
        <StatCard
          icon={<Package size={22} />}
          value={loading ? "—" : `${productos}`}
          label="Productos"
          onClick={onProductos}
        />
        <StatCard
          icon={<AlertTriangle size={22} />}
          value={loading ? "—" : `${stockBajo}`}
          label="Stock bajo"
          color="#E0324E"
          highlight={stockBajo > 0}
          onClick={onProductos}
        />
      </div>

      {/* Pedidos a proveedor por recibir */}
      <div className="mt-3.5">
        <DarkCard
          icon={<Truck size={24} />}
          value={loading ? "—" : `${pendientes}`}
          label={"Pedidos a proveedor\npor recibir"}
          onClick={onPedidos}
        />
      </div>

      {/* Botón principal */}
      <div className="mt-4.5 mt-4">
        <BigButton
          icon={<Package size={22} />}
          title="Ver inventario"
          subtitle="Productos, precios y stock"
          onClick={onProductos}
        />
      </div>

      {/* Accesos rápidos */}
      <div className="mt-6">
        <Eyebrow>Accesos rápidos</Eyebrow>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <QuickAccess icon={<ShoppingCart size={19} />} title="Vender" subtitle="Nueva venta" onClick={onVentas} />
          <QuickAccess icon={<Package size={19} />} title="Productos" subtitle="Ver inventario" onClick={onProductos} />
          <QuickAccess icon={<Truck size={19} />} title="Pedir" subtitle="A proveedor" onClick={onPedidos} />
        </div>
      </div>
    </div>
  );
}
