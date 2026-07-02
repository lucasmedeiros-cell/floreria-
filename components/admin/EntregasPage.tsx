"use client";

import { Bike, MapPin, Phone, Truck, PackageCheck, Navigation } from "lucide-react";
import { fmtDate, orderTotal, statusColor, statusLabel } from "@/lib/adminData";
import { bs2 } from "@/lib/products";
import { useOrders, useToast } from "@/context/StoreProvider";
import { openWhatsapp } from "@/lib/whatsapp";
import { OutlineButton, PrimaryButton } from "@/components/ui";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { StatusChip } from "./OrdersPage";

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function EntregasPage() {
  const model = useOrders();
  const { showToast } = useToast();
  const today = new Date();

  const activas = model.orders.filter((o) => o.status === "programado" || o.status === "enCamino");
  const enCamino = model.orders.filter((o) => o.status === "enCamino").length;
  const progHoy = model.orders.filter((o) => o.status === "programado" && sameDay(o.deliveryDate, today)).length;
  const entHoy = model.orders.filter((o) => o.status === "entregado" && sameDay(o.deliveryDate, today)).length;

  const byCourier = activas.reduce<Record<string, typeof activas>>((acc, o) => {
    (acc[o.courier] ??= []).push(o);
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <h1 className="font-serif text-[30px] font-semibold text-ink">Entregas</h1>
      <p className="mt-1 text-[13px] text-ink2">Seguimiento de entregas en curso y rutas de los repartidores</p>

      {/* Resumen */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat icon={<Navigation size={20} />} label="En camino" value={`${enCamino}`} color="#B8924A" />
        <MiniStat icon={<Truck size={20} />} label="Programadas hoy" value={`${progHoy}`} color="#3B6FD4" />
        <MiniStat icon={<PackageCheck size={20} />} label="Entregadas hoy" value={`${entHoy}`} color="#2EA66B" />
      </div>

      {activas.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-[18px] border border-line bg-surface py-16 text-center shadow-card">
          <Truck size={40} className="text-faint" />
          <h3 className="mt-3 font-serif text-[22px] font-semibold text-ink">Sin entregas activas</h3>
          <p className="mt-1.5 text-[13px] text-ink2">Todas las notas están entregadas o en borrador.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {Object.entries(byCourier).map(([courier, list]) => (
            <div key={courier} className="rounded-[18px] border border-line bg-surface p-[18px] shadow-card">
              <div className="flex items-center gap-2">
                <Bike size={18} className="text-gold" />
                <span className="text-[14px] font-semibold text-ink">{courier}</span>
                <span className="ml-auto rounded-full bg-surface2 px-2.5 py-1 text-[11.5px] font-semibold text-ink2">
                  {list.length} en ruta
                </span>
              </div>

              <div className="mt-2">
                {list.map((o) => (
                  <div key={o.code} className="border-t border-line py-3.5 first:border-t-0">
                    <div className="flex items-center gap-2">
                      <span className="eyebrow text-[10.5px] font-semibold text-gold">{o.code}</span>
                      <span className="ml-auto"><StatusChip s={o.status} /></span>
                    </div>
                    <div className="mt-1 flex items-center">
                      <p className="font-serif text-[18px] font-semibold text-ink">{o.clientName}</p>
                      <span className="ml-auto font-serif text-[16px] font-bold text-rose">{bs2(orderTotal(o))}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink2">
                      <MapPin size={13} className="shrink-0 text-faint" /> {o.address || "Sin dirección"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-faint">Entrega: {fmtDate(o.deliveryDate)} · {o.deliveryTime}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      {o.status === "programado" && (
                        <PrimaryButton
                          label="Marcar en camino"
                          icon={<Navigation size={16} />}
                          onClick={() => {
                            model.setStatus(o, "enCamino");
                            showToast(`${o.code} en camino 🛵`);
                          }}
                        />
                      )}
                      {o.status === "enCamino" && (
                        <PrimaryButton
                          label="Marcar entregado"
                          icon={<PackageCheck size={16} />}
                          colors={["#3AC07C", "#2EA66B"]}
                          onClick={() => {
                            model.setStatus(o, "entregado");
                            showToast(`${o.code} entregado ✓`);
                          }}
                        />
                      )}
                      <OutlineButton
                        label="Avisar por WhatsApp"
                        icon={<WhatsAppIcon size={17} />}
                        color="#1FAE54"
                        onClick={() => {
                          const p = o.phone.replace(/\D/g, "");
                          if (!p) return showToast("Este cliente no tiene teléfono");
                          const msg = `Hola ${o.clientName} 🌷, tu pedido ${o.code} está *${statusLabel(o.status)}*. Entrega: ${fmtDate(o.deliveryDate)} ${o.deliveryTime}.`;
                          openWhatsapp(msg, `591${p}`);
                        }}
                      />
                    </div>
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

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-[18px] shadow-card">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(140deg, ${color}, ${color}cc)` }}>
        {icon}
      </span>
      <div>
        <p className="font-serif text-[26px] font-bold leading-none text-ink">{value}</p>
        <p className="mt-1 text-[12.5px] text-ink2">{label}</p>
      </div>
    </div>
  );
}
