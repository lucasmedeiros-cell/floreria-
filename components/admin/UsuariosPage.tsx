"use client";

import { useState } from "react";
import { Plus, ShieldCheck, X } from "lucide-react";
import { useBusiness, useToast } from "@/context/StoreProvider";
import { PrimaryButton, OutlineButton } from "@/components/ui";

interface TeamUser {
  id: string;
  name: string;
  role: string;
  email: string;
  active: boolean;
}

const ROLES = ["Administrador", "Vendedora", "Repartidor"];

/** El rol principal se pinta con el color del rubro; los demás, con su color fijo. */
const roleColor = (r: string, accent: string): string =>
  (({ Administrador: accent, Vendedora: "#3B6FD4", Repartidor: `${accent}99` } as Record<string, string>)[r] ?? "#6E6064");

// Sin usuarios de ejemplo: el equipo se arma invitando gente desde el panel.
const SEED: TeamUser[] = [];

const initials = (n: string) => n.trim().split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("");

export function UsuariosPage() {
  const { showToast } = useToast();
  const { colors } = useBusiness();
  const [users, setUsers] = useState<TeamUser[]>(SEED);
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => setUsers((us) => us.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div className="flex items-start">
        <div className="flex-1">
          <h1 className="text-[30px] font-semibold text-ink">Usuarios</h1>
          <p className="mt-1 text-[13px] text-ink2">{users.filter((u) => u.active).length} miembros activos · gestiona roles y accesos</p>
        </div>
        <PrimaryButton label="Invitar usuario" icon={<Plus size={18} />} onClick={() => setOpen(true)} />
      </div>

      {users.length === 0 && (
        <div className="mt-6 flex flex-col items-center rounded-[18px] border border-dashed border-line bg-surface py-16 text-center">
          <h3 className="text-[18px] font-semibold text-ink">Todavía no hay usuarios</h3>
          <p className="mt-1.5 max-w-[380px] text-[13px] text-ink2">
            Invita a los miembros del equipo que van a usar el panel.
          </p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3.5 rounded-[18px] border border-line bg-surface p-[18px] shadow-soft">
            <span
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[18px] font-bold text-white"
              style={{ background: `linear-gradient(180deg,${colors.accent},${colors.accentDeep})` }}
            >
              {initials(u.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-semibold text-ink">{u.name}</p>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${roleColor(u.role, colors.accent)}1a`, color: roleColor(u.role, colors.accent) }}>
                  {u.role}
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-ink2">{u.email}</p>
            </div>
            <label className="flex cursor-pointer flex-col items-center gap-1">
              <input type="checkbox" checked={u.active} onChange={() => toggle(u.id)} className="h-4 w-4 accent-[#2EA66B]" />
              <span className="text-[10.5px]" style={{ color: u.active ? "#2EA66B" : "#9C9094" }}>{u.active ? "Activo" : "Inactivo"}</span>
            </label>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-[18px] border border-line bg-surface2 p-[18px]">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-ink" />
        <p className="text-[12.5px] leading-relaxed text-ink2">
          <span className="font-semibold text-ink">Roles y permisos:</span> el <b>Administrador</b> gestiona todo el panel; la <b>Vendedora</b> crea notas y clientes; el <b>Repartidor</b> solo ve su agenda y entregas asignadas.
        </p>
      </div>

      {open && (
        <InviteDialog
          onClose={() => setOpen(false)}
          onSave={(u) => {
            setUsers((us) => [u, ...us]);
            setOpen(false);
            showToast("Usuario invitado");
          }}
        />
      )}
    </div>
  );
}

function InviteDialog({ onClose, onSave }: { onClose: () => void; onSave: (u: TeamUser) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Vendedora");

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-5" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-[22px] bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <h2 className="text-[24px] font-semibold text-ink">Invitar usuario</h2>
          <button onClick={onClose} className="ml-auto text-ink2"><X size={22} /></button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <FieldRow label="Nombre" value={name} onChange={setName} placeholder="Nombre y apellido" />
          <FieldRow label="Correo" value={email} onChange={setEmail} placeholder="correo@empresa.com" type="email" />
          <label className="block">
            <span className="text-[12px] font-semibold text-ink2">Rol</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none focus:border-pink">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <OutlineButton label="Cancelar" onClick={onClose} />
          <PrimaryButton
            label="Invitar"
            onClick={() => name.trim() && onSave({ id: `u${Date.now()}`, name: name.trim(), email: email.trim(), role, active: true })}
          />
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink2">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink" />
    </label>
  );
}
