"use client";

import { useState } from "react";
import { Bike, CalendarCheck, MapPin } from "lucide-react";
import { fmtDate } from "@/lib/adminData";
import { useOrders } from "@/context/StoreProvider";
import { StatusChip } from "./OrdersPage";

const WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MF = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function AgendaPage() {
  const { orders } = useOrders();
  const today = new Date();
  const [sel, setSel] = useState<Date>(today);

  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  const dayOrders = orders
    .filter((o) => sameDay(o.deliveryDate, sel))
    .sort((a, b) => a.deliveryTime.localeCompare(b.deliveryTime));

  const byCourier = dayOrders.reduce<Record<string, typeof dayOrders>>((acc, o) => {
    (acc[o.courier] ??= []).push(o);
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <h1 className="font-serif text-[30px] font-semibold text-ink">Agenda</h1>
      <p className="mt-1 text-[13px] text-ink2">Calendario de entregas del día por repartidor</p>

      {/* Selector de días */}
      <div className="mt-5 flex gap-2.5 overflow-x-auto pb-1">
        {days.map((d) => {
          const active = sameDay(d, sel);
          const count = orders.filter((o) => sameDay(o.deliveryDate, d)).length;
          return (
            <button
              key={d.toISOString()}
              onClick={() => setSel(d)}
              className={`flex w-[76px] shrink-0 flex-col items-center rounded-[16px] border py-3 transition-colors ${
                active ? "border-rose bg-rose text-white shadow-card" : "border-line bg-surface text-ink shadow-soft"
              }`}
            >
              <span className={`text-[11px] font-semibold ${active ? "text-white/75" : "text-ink2"}`}>{WD[d.getDay()]}</span>
              <span className="font-serif text-[24px] font-bold leading-tight">{d.getDate()}</span>
              <span
                className="mt-1 rounded-full px-2 text-[10.5px] font-bold"
                style={active ? { background: "rgba(255,255,255,.25)", color: "#fff" } : count ? { background: "#B11E4B1a", color: "#B11E4B" } : { color: "#9C9094" }}
              >
                {count || "—"}
              </span>
            </button>
          );
        })}
      </div>

      <h2 className="mt-6 font-serif text-[22px] font-semibold text-ink">
        {sel.getDate()} de {MF[sel.getMonth()]} de {sel.getFullYear()}
      </h2>

      {dayOrders.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-[18px] border border-line bg-surface py-16 text-center shadow-card">
          <CalendarCheck size={40} className="text-faint" />
          <h3 className="mt-3 font-serif text-[22px] font-semibold text-ink">Día libre</h3>
          <p className="mt-1.5 text-[13px] text-ink2">No hay entregas programadas para esta fecha.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {Object.entries(byCourier).map(([courier, list]) => (
            <div key={courier} className="rounded-[18px] border border-line bg-surface p-[18px] shadow-card">
              <div className="flex items-center gap-2">
                <Bike size={18} className="text-gold" />
                <span className="text-[14px] font-semibold text-ink">{courier}</span>
                <span className="ml-auto rounded-full bg-surface2 px-2.5 py-1 text-[11.5px] font-semibold text-ink2">
                  {list.length} entrega(s)
                </span>
              </div>
              <div className="mt-2">
                {list.map((o) => (
                  <div key={o.code} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                    <span className="w-14 text-center font-serif text-[16px] font-bold text-rose">{o.deliveryTime}</span>
                    <div className="h-9 w-px bg-line" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink">{o.clientName}</p>
                      <p className="flex items-center gap-1 truncate text-[12px] text-ink2">
                        <MapPin size={13} className="shrink-0 text-faint" /> {o.code} · {o.address || "Sin dirección"}
                      </p>
                    </div>
                    <StatusChip s={o.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
