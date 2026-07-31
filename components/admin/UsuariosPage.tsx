"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Plus, ShieldCheck, Users, X } from "lucide-react";
import { useAuth, useToast } from "@/context/StoreProvider";
import {
  apiCreateEmployee,
  apiListEmployees,
  apiUpdateEmployee,
  ROLES,
  type Employee,
} from "@/lib/employeesClient";

const initials = (n: string) =>
  n.trim().split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("");

/**
 * Usuarios — el equipo que entra al CRM, leído de la base (`/api/employees`),
 * igual que en la app de escritorio.
 *
 * Solo el administrador la ve y solo él puede escribir; el backend lo vuelve a
 * exigir en cada llamada, así que esconder los botones es comodidad, no
 * seguridad. Las cuentas no se borran: se DESACTIVAN, porque el nombre de quien
 * vendió o cargó un gasto queda pegado a ese registro.
 */
export function UsuariosPage() {
  const { showToast } = useToast();
  const auth = useAuth();
  const esAdmin = auth.role === "Administrador";

  const [users, setUsers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await apiListEmployees());
      setErr(null);
    } catch {
      setErr("No se pudo cargar el equipo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (esAdmin) load();
    else setLoading(false);
  }, [esAdmin]);

  const patch = async (id: string, p: { active?: boolean; perms?: { products: boolean } }) => {
    setBusy(id);
    try {
      await apiUpdateEmployee(id, p);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo actualizar el usuario.");
    } finally {
      setBusy(null);
    }
  };

  if (!esAdmin) {
    return (
      <div className="grid h-full place-items-center px-7 text-center">
        <div>
          <ShieldCheck size={38} className="mx-auto text-faint" />
          <h1 className="mt-3 font-serif text-[22px] font-semibold text-ink">
            Solo para administradores
          </h1>
          <p className="mt-1.5 text-[13px] text-ink2">Tu cuenta no puede gestionar usuarios.</p>
        </div>
      </div>
    );
  }

  const activos = users.filter((u) => u.active).length;

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[27px] font-extrabold leading-none tracking-[-0.4px] text-ink">
            Usuarios
          </h1>
          <p className="mt-1 text-[13px] text-ink2">
            {activos} {activos === 1 ? "cuenta activa" : "cuentas activas"} · quién entra al CRM y
            qué puede hacer
          </p>
        </div>
        <button
          onClick={() => setNuevo(true)}
          className="flex items-center gap-2 rounded-[12px] bg-pink px-4 py-2.5 text-[13.5px] font-bold text-onAccent"
        >
          <Plus size={18} /> Nuevo usuario
        </button>
      </div>

      {err && (
        <div className="mt-5 rounded-[14px] border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
          {err}
        </div>
      )}

      {/* Vista de tarjetas: una por cuenta, con su rol, sus datos y lo que
          puede hacer a la vista, sin tener que leer una fila de tabla. */}
      {loading ? (
        <p className="mt-5 rounded-[18px] border border-line bg-surface px-5 py-10 text-center text-[13px] text-ink2">
          Cargando…
        </p>
      ) : users.length === 0 ? (
        <div className="mt-5 rounded-[18px] border border-line bg-surface px-5 py-14 text-center">
          <Users size={34} className="mx-auto text-faint" />
          <p className="mt-3 text-[14px] font-medium text-ink">Todavía no hay usuarios.</p>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-4">
          {users.map((u) => {
            const admin = u.role === "Administrador";
            const puede = u.perms?.products === true;
            // Sin `id` en la sesión del contexto, el correo alcanza para
            // reconocerse; el backend igual impide autodesactivarse.
            const yo = !!auth.email && u.email === auth.email;
            return (
              <div
                key={u.id}
                className={`flex w-full max-w-[320px] flex-col rounded-[18px] border border-line bg-surface p-5 shadow-card sm:w-[320px] ${
                  u.active ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pinkSoft text-[15px] font-bold text-ink">
                    {initials(u.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-ink">{u.name}</p>
                    <p className="text-[12px] text-ink2">
                      {u.role}
                      {yo && <span className="text-faint"> · vos</span>}
                    </p>
                  </div>
                  <Chip tone={u.active ? "ok" : "off"}>{u.active ? "Activo" : "Inactivo"}</Chip>
                </div>

                <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3.5 text-[12.5px]">
                  <p className="flex items-center gap-2 text-ink2">
                    <Mail size={14} className="shrink-0 text-faint" />
                    <span className="truncate">{u.email || "Sin correo"}</span>
                  </p>
                  <p className="flex items-center gap-2 text-ink2">
                    <Phone size={14} className="shrink-0 text-faint" />
                    <span className="truncate">{u.phone || "Sin teléfono"}</span>
                  </p>
                </div>

                <div className="mt-3.5 flex items-center gap-2 border-t border-line pt-3.5">
                  <span className="text-[12.5px] font-semibold text-ink2">Catálogo</span>
                  {admin ? (
                    <Chip tone="neutral">Siempre</Chip>
                  ) : (
                    <button
                      disabled={busy === u.id}
                      onClick={() => patch(u.id, { perms: { products: !puede } })}
                      title="Deja que esta cuenta registre y edite productos"
                      className="disabled:opacity-50"
                    >
                      <Chip tone={puede ? "ok" : "neutral"}>{puede ? "Sí" : "No"}</Chip>
                    </button>
                  )}
                  <span className="ml-auto">
                    {yo ? (
                      <span className="text-[12px] text-faint">Tu cuenta</span>
                    ) : (
                      <button
                        disabled={busy === u.id}
                        onClick={() => patch(u.id, { active: !u.active })}
                        className={`rounded-[10px] border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${
                          u.active
                            ? "border-error/50 text-error"
                            : "border-line text-ink2 hover:text-ink"
                        }`}
                      >
                        {u.active ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2.5 rounded-[18px] border border-line bg-surface2 p-[18px]">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-ink" />
        <p className="text-[12.5px] leading-relaxed text-ink2">
          <span className="font-semibold text-ink">Roles y permisos:</span> el{" "}
          <b>Administrador</b> ve y hace todo. El permiso <b>Catálogo</b> deja que una{" "}
          <b>Vendedora</b> registre y edite productos; sin él, solo vende lo que ya está cargado.
        </p>
      </div>

      {nuevo && (
        <NuevoUsuarioModal
          onClose={() => setNuevo(false)}
          onCreated={() => {
            setNuevo(false);
            showToast("Usuario creado");
            load();
          }}
        />
      )}
    </div>
  );
}

/** Etiqueta redonda de estado o permiso, con los tres tonos que usa el CRM. */
function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "off" | "neutral";
}) {
  const cls = {
    ok: "bg-success/[0.14] text-success",
    off: "bg-error/[0.14] text-error",
    neutral: "bg-surface2 text-ink2",
  }[tone];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

function NuevoUsuarioModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [role, setRole] = useState("Vendedora");
  const [catalogo, setCatalogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    if (!name.trim() || !pass || (!email.trim() && !phone.trim())) {
      return setError("Completá nombre, contraseña y un correo o teléfono.");
    }
    setSaving(true);
    setError(null);
    try {
      const creado = await apiCreateEmployee({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        pass,
        role,
      });
      // El alta no toma el permiso de catálogo: se asigna en un segundo paso, y
      // si ese paso falla, el usuario igual quedó creado.
      if (catalogo && role !== "Administrador" && creado?.id) {
        await apiUpdateEmployee(creado.id, { perms: { products: true } }).catch(() => {});
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el usuario.");
      setSaving(false);
    }
  };

  const input =
    "mt-1.5 w-full rounded-[11px] border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-[440px] overflow-y-auto rounded-[20px] bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[22px] font-semibold text-ink">Nuevo usuario</h2>
          <button onClick={onClose} className="text-ink2 hover:text-ink">
            <X size={22} />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] font-semibold text-ink2">Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-semibold text-ink2">Correo</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="opcional"
              className={input}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-ink2">Teléfono</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="opcional"
              className={input}
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="text-[12px] font-semibold text-ink2">Contraseña</span>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="mínimo 6 caracteres"
            className={input}
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[12px] font-semibold text-ink2">Rol</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={input}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>

        {/* El administrador siempre puede el catálogo: la casilla no le aplica. */}
        {role !== "Administrador" && (
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-[11px] border border-line bg-surface2 px-3.5 py-3">
            <input
              type="checkbox"
              checked={catalogo}
              onChange={() => setCatalogo((v) => !v)}
              className="mt-0.5 h-4 w-4 accent-pink"
            />
            <span className="text-[12.5px] leading-snug text-ink2">
              Puede gestionar el catálogo (registrar y editar productos).
            </span>
          </label>
        )}

        {error && <p className="mt-3 text-[13px] text-error">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-[11px] border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink2"
          >
            Cancelar
          </button>
          <button
            onClick={crear}
            disabled={saving}
            className="flex-1 rounded-[11px] bg-pink px-4 py-2.5 text-[13.5px] font-bold text-onAccent disabled:opacity-50"
          >
            {saving ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
