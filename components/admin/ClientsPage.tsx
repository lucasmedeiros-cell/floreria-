"use client";

import { useState } from "react";
import { MapPin, Plus, Search, Users, X } from "lucide-react";
import type { Client } from "@/lib/adminData";
import { apiCreateClient, useClients } from "@/lib/clientsClient";
import { bs2 } from "@/lib/products";
import { PrimaryButton } from "@/components/ui";

/**
 * Libreta de clientes del negocio. `nuevo` llega desde el acceso "Nuevo
 * cliente" del Resumen: abre el alta apenas se entra a la pantalla.
 */
export function ClientsPage({ nuevo = false }: { nuevo?: boolean }) {
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(nuevo);
  const { clients, loading, reload } = useClients();
  const items = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)
  );

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div className="flex items-start">
        <div className="flex-1">
          <h1 className="text-[30px] font-semibold text-ink">Clientes</h1>
          <p className="mt-1 text-[13px] text-ink2">
            {loading ? "Cargando…" : `${clients.length} clientes registrados`}
          </p>
        </div>
        <PrimaryButton
          label="Nuevo cliente"
          icon={<Plus size={18} />}
          onClick={() => setShowNew(true)}
        />
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

      {items.length === 0 && !loading ? (
        <EmptyState
          title={q ? "Sin resultados" : "Todavía no hay clientes"}
          text={
            q
              ? "Prueba con otro nombre o teléfono."
              : "Cargá el primero con «Nuevo cliente»; los de los pedidos se suman solos."
          }
        />
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((cl) => (
            <ClientCard key={cl.name} cl={cl} />
          ))}
        </div>
      )}

      {showNew && (
        <NuevoClienteModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Alta de un cliente. Solo el nombre es obligatorio: el resto se completa después. */
function NuevoClienteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    setSaving(true);
    setError(null);
    try {
      await apiCreateClient({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cliente.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-[460px] rounded-[20px] border border-line bg-surface p-6 shadow-card">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 text-[20px] font-bold text-ink">Nuevo cliente</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-faint hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Campo label="Nombre" value={name} onChange={setName} autoFocus />
          <Campo label="Teléfono" value={phone} onChange={setPhone} />
          <Campo label="Dirección" value={address} onChange={setAddress} />
          <Campo label="Notas" value={notes} onChange={setNotes} />
        </div>

        {error && (
          <p className="mt-3 rounded-[12px] border border-error/30 bg-error/5 px-3 py-2 text-[12.5px] text-error">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-[12px] border border-line px-4 py-2.5 text-[13px] font-semibold text-ink2 hover:text-ink"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-[12px] bg-pink px-4 py-2.5 text-[13px] font-bold text-onAccent disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-ink2">{label}</span>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="h-[44px] w-full rounded-[12px] border border-line bg-surface px-3.5 text-[13.5px] text-ink outline-none focus:border-pink"
      />
    </label>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-[18px] border border-dashed border-line bg-surface py-16 text-center">
      <Users size={38} className="text-faint" />
      <h3 className="mt-3 text-[18px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[380px] text-[13px] text-ink2">{text}</p>
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
        <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line bg-surface2 text-[18px] font-bold text-ink">
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
