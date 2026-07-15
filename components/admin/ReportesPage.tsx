"use client";

import { DollarSign, ReceiptText, PackageCheck, Users } from "lucide-react";
import { orderStatuses, orderTotal, statusColor, statusLabel } from "@/lib/adminData";
import { useClients } from "@/lib/clientsClient";
import { bs2 } from "@/lib/products";
import { useBusiness, useOrders } from "@/context/StoreProvider";

const MS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function ReportesPage() {
  const { orders, countByStatus } = useOrders();
  const { colors } = useBusiness();
  const { clients } = useClients();
  const valid = orders.filter((o) => o.status !== "cancelado");

  const totalSales = valid.reduce((s, o) => s + orderTotal(o), 0);
  const delivered = orders.filter((o) => o.status === "entregado").length;

  // Productos más vendidos (por ingreso)
  const byProduct: Record<string, number> = {};
  for (const o of valid) for (const it of o.items) byProduct[it.name] = (byProduct[it.name] ?? 0) + it.qty * it.unitPrice;
  const topProducts = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxProd = topProducts[0]?.[1] ?? 1;

  // Ventas por repartidor
  const byCourier: Record<string, number> = {};
  for (const o of valid) byCourier[o.courier] = (byCourier[o.courier] ?? 0) + orderTotal(o);
  const couriers = Object.entries(byCourier).sort((a, b) => b[1] - a[1]);
  const maxCourier = couriers[0]?.[1] ?? 1;

  // Ventas por mes (5 meses demo + mes actual real)
  const now = new Date();
  const demo = [42000, 38500, 61000, 47000, 53000];
  const monthly: { label: string; value: number }[] = [];
  for (let i = 5; i >= 1; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly.push({ label: MS[m.getMonth()], value: demo[5 - i] });
  }
  const currentMonth = valid
    .filter((o) => o.createdAt.getMonth() === now.getMonth() && o.createdAt.getFullYear() === now.getFullYear())
    .reduce((s, o) => s + orderTotal(o), 0);
  monthly.push({ label: MS[now.getMonth()], value: currentMonth || 12000 });
  const maxMonthly = Math.max(...monthly.map((m) => m.value));

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <h1 className="text-[30px] font-semibold text-ink">Reportes</h1>
      <p className="mt-1 text-[13px] text-ink2">Ventas, productos más vendidos y desempeño de entregas</p>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<DollarSign size={22} />} label="Ventas acumuladas" value={bs2(totalSales)} color={colors.accent} />
        <Kpi icon={<ReceiptText size={22} />} label="Notas totales" value={`${orders.length}`} color="#3B6FD4" />
        <Kpi icon={<PackageCheck size={22} />} label="Entregadas" value={`${delivered}`} color="#2EA66B" />
        <Kpi icon={<Users size={22} />} label="Clientes" value={`${clients.length}`} color={`${colors.accent}99`} />
      </div>

      {/* Ventas por mes */}
      <div className="mt-4 rounded-[18px] border border-line bg-surface p-5 shadow-soft">
        <h3 className="text-[15px] font-semibold text-ink">Ventas por mes</h3>
        <div className="mt-6 flex h-[200px] items-end gap-3">
          {monthly.map((m, i) => {
            const last = i === monthly.length - 1;
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end">
                <span className="text-[10.5px] font-semibold text-ink2">{bs2(m.value)}</span>
                <div
                  className="mt-1.5 w-full rounded-t-lg"
                  style={{
                    height: `${Math.max(4, (m.value / maxMonthly) * 140)}px`,
                    background: last
                      ? `linear-gradient(180deg,${colors.accent},${colors.accentDeep})`
                      : `linear-gradient(180deg,${colors.accent}55,${colors.accent}99)`,
                  }}
                />
                <span className={`mt-2 text-[11.5px] ${last ? "font-bold text-pink" : "font-medium text-ink2"}`}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankCard title="Productos más vendidos" rows={topProducts.map(([n, v]) => ({ name: n, label: bs2(v), pct: v / maxProd }))} />
        <RankCard title="Ventas por repartidor" rows={couriers.map(([n, v]) => ({ name: n, label: bs2(v), pct: v / maxCourier }))} />
      </div>

      {/* Pedidos por estado */}
      <div className="mt-4 rounded-[18px] border border-line bg-surface p-5 shadow-soft">
        <h3 className="text-[15px] font-semibold text-ink">Pedidos por estado</h3>
        <div className="mt-3.5 flex flex-col gap-2.5">
          {orderStatuses.map((s) => {
            const count = countByStatus(s);
            return (
              <div key={s}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor(s) }} />
                  <span className="flex-1 text-ink">{statusLabel(s)}</span>
                  <span className="font-semibold text-ink2">{count}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full" style={{ width: `${orders.length ? (count / orders.length) * 100 : 0}%`, background: statusColor(s) }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-[18px] border border-line bg-surface p-5 text-center shadow-soft">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(140deg, ${color}, ${color}cc)`, boxShadow: `0 10px 20px ${color}44` }}>
        {icon}
      </span>
      <p className="mt-3.5 text-[26px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-2 text-[12.5px] text-ink2">{label}</p>
    </div>
  );
}

function RankCard({ title, rows }: { title: string; rows: { name: string; label: string; pct: number }[] }) {
  const { colors } = useBusiness();
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <div className="mt-3 flex flex-col gap-2.5">
        {rows.length === 0 ? (
          <p className="text-[13px] text-ink2">Sin datos aún.</p>
        ) : (
          rows.map((r) => (
            <div key={r.name}>
              <div className="flex items-center justify-between">
                <span className="truncate text-[13px] font-medium text-ink">{r.name}</span>
                <span className="text-[13px] font-bold text-pink">{r.label}</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full" style={{ width: `${r.pct * 100}%`, background: `linear-gradient(90deg,${colors.accent},${colors.accentDeep})` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
