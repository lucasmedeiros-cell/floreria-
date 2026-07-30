"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck, Users, X } from "lucide-react";
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
          <h1 className="font-serif text-[30px] font-semibold text-ink">Usuarios</h1>
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

      <div className="mt-5 overflow-x-auto rounded-[18px] border border-line bg-surface shadow-soft">
        {loading ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink2">Cargando…</p>
        ) : users.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Users size={34} className="mx-auto text-faint" />
            <p className="mt-3 text-[14px] font-medium text-ink">Todavía no hay usuarios.</p>
          </div>
        ) : (
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold">Correo</th>
                <th className="px-4 py-3 text-left font-semibold">Teléfono</th>
                <th className="px-4 py-3 text-left font-semibold">Rol</th>
                <th className="px-4 py-3 text-center font-semibold">Catálogo</th>
                <th className="px-4 py-3 text-center font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const admin = u.role === "Administrador";
                const puede = u.perms?.products === true;
                // Sin `id` en la sesión del contexto, el correo alcanza para
                // reconocerse; el backend igual impide autodesactivarse.
                const yo = !!auth.email && u.email === auth.email;
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-line last:border-0 ${u.active ? "" : "opacity-50"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pinkSoft text-[11px] font-bold text-ink">
                          {initials(u.name)}
                        </span>
                        <span className="text-[13px] font-semibold text-ink">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink2">{u.email || "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-ink2">{u.phone || "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-ink">{u.role}</td>
                    <td className="px-4 py-3 text-center">
                      {admin ? (
                        <span className="inline-block rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-ink2">
                          Siempre
                        </span>
                      ) : (
                        <button
                          disabled={busy === u.id}
                          onClick={() => patch(u.id, { perms: { products: !puede } })}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold disabled:opacity-50 ${
                            puede ? "bg-emerald-100 text-emerald-700" : "bg-surface2 text-ink2"
                          }`}
                        >
                          {puede ? "Sí" : "No"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          u.active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {u.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {yo ? (
                        <span className="text-[12px] text-faint">Vos</span>
                      ) : (
                        <button
                          disabled={busy === u.id}
                          onClick={() => patch(u.id, { active: !u.active })}
                          className={`rounded-[9px] border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${
                            u.active
                              ? "border-error/50 text-error"
                              : "border-line text-ink2 hover:text-ink"
                          }`}
                        >
                          {u.active ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
