"use client";

import { useState } from "react";
import { MapPin, Plus, Search } from "lucide-react";
import { Client, kClients } from "@/lib/adminData";
import { bs2 } from "@/lib/products";
import { PrimaryButton } from "@/components/ui";

export function ClientsPage({ onNew }: { onNew: () => void }) {
  const [q, setQ] = useState("");
  const items = kClients.filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)
  );

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div className="flex items-start">
        <div className="flex-1">
          <h1 className="text-[30px] font-semibold text-ink">Clientes</h1>
          <p className="mt-1 text-[13px] text-ink2">
            {kClients.length} clientes registrados
          </p>
        </div>
        <PrimaryButton label="Nuevo pedido" icon={<Plus size={18} />} onClick={onNew} />
      </div>

      <div className="mt-5 flex h-[46px] max-w-[420px] items-center gap-2.5 rounded-xl border border-line bg-surface px-4">
        <Search size={19} className="text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          className="flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((cl) => (
          <ClientCard key={cl.name} cl={cl} />
        ))}
      </div>
    </div>
  );
}

function ClientCard({ cl }: { cl: Client }) {
  const initials = cl.name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <div className="rounded-[18px] border border-line bg-surface p-[18px] shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line bg-surface2 text-[18px] font-bold text-pink">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold text-ink">{cl.name}</p>
          <p className="text-[12.5px] text-ink2">{cl.phone}</p>
        </div>
      </div>
      {cl.address && (
        <div className="mt-3.5 flex items-start gap-1.5">
          <MapPin size={15} className="mt-0.5 shrink-0 text-faint" />
          <span className="text-[12px] text-ink2">{cl.address}</span>
        </div>
      )}
      <div className="mt-3.5 flex items-center rounded-xl bg-surface2 p-3">
        <Stat k="Pedidos" v={`${cl.ordersCount}`} />
        <Sep />
        <Stat k="Gastado" v={bs2(cl.totalSpent)} />
        <Sep />
        <Stat k="Último" v={cl.lastOrder} />
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <span className="truncate text-[12.5px] font-bold text-ink">{v}</span>
      <span className="mt-0.5 text-[10.5px] text-faint">{k}</span>
    </div>
  );
}

function Sep() {
  return <div className="h-[26px] w-px bg-line" />;
}
