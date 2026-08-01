"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, ReceiptText, Sparkles, Tags, Wallet, X } from "lucide-react";
import { IconTile } from "./kit";
import { bs2 } from "@/lib/products";
import { useToast } from "@/context/StoreProvider";
import { apiCreateExpense, apiListExpenses, type Expense } from "@/lib/expensesClient";

/** Hoy en `YYYY-MM-DD` local — el `toISOString()` pelado se va de día en Bolivia. */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return d && m && a ? `${d}/${m}/${a}` : ymd;
}

/**
 * Gastos — la plata que SALE del negocio (alquiler, servicios, sueldos, fletes).
 * No toca el inventario: es la otra mitad de la cuenta que Reportes usa para
 * mostrar la ganancia real y no solo lo facturado.
 */
export function GastosPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await apiListExpenses());
      setErr(null);
    } catch {
      setErr("No se pudieron cargar los gastos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const total = useMemo(() => rows.reduce((a, r) => a + r.amount, 0), [rows]);

  /** Lo gastado en el mes en curso: es el número que se mira mes a mes. */
  const delMes = useMemo(() => {
    const mes = hoyISO().slice(0, 7);
    return rows.filter((r) => r.spentAt.startsWith(mes)).reduce((a, r) => a + r.amount, 0);
  }, [rows]);

  /** Cuánto se fue en cada categoría, de mayor a menor. */
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.category, (m.get(r.category) ?? 0) + r.amount);
    return [...m.entries()]
      .map(([categoria, monto]) => ({ categoria, monto }))
      .sort((a, b) => b.monto - a.monto);
  }, [rows]);
  const maxCategoria = Math.max(1, porCategoria[0]?.monto ?? 1);

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-10 pt-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[27px] font-extrabold leading-none tracking-[-0.4px] text-ink">
              Gastos
            </h1>
            <p className="mt-1.5 text-[13px] text-ink2">
              Egresos del negocio. Reportes los resta a las ventas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Lo gastado en total: el número por el que se entra acá. */}
            <div
              className="relative flex items-center gap-4 overflow-hidden rounded-[18px] border-2 bg-surface px-5 py-3.5 shadow-card"
              style={{ borderColor: "#FEBB0355" }}
            >
              <Sparkles size={15} className="absolute right-3 top-2.5 text-pink" />
              <IconTile icon={<Wallet size={26} />} tone="#C88600" size={54} />
              <span>
                <span className="block text-[11px] font-bold uppercase tracking-[2px] text-ink2">
                  Total
                </span>
                <span className="mt-1 block text-[25px] font-extrabold leading-none text-ink">
                  {bs2(total)}
                </span>
              </span>
            </div>
            <button
              onClick={() => setNuevo(true)}
              className="inline-flex h-[52px] items-center gap-2 rounded-[12px] px-5 text-[14px] font-extrabold text-onAccent transition-transform hover:-translate-y-0.5"
              style={{ background: "linear-gradient(100deg,#FFC93C,#FEBB03 55%,#F0A400)" }}
            >
              <Plus size={18} /> Nuevo gasto
            </button>
          </div>
        </div>

        {/* Vistazo del mes */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <GastoCard
            icon={<CalendarDays size={24} />}
            tone="#F5A800"
            label="Gastado este mes"
            value={bs2(delMes)}
          />
          <GastoCard
            icon={<ReceiptText size={24} />}
            tone="#3B6FD4"
            label="Gastos cargados"
            value={`${rows.length}`}
          />
          <GastoCard
            icon={<Tags size={24} />}
            tone="#7C6BE0"
            label="Categorías"
            value={`${porCategoria.length}`}
          />
        </div>

        {err && (
          <div className="mt-5 rounded-[14px] border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
            {err}
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-[18px] border border-line bg-surface shadow-card">
          {loading ? (
            <p className="px-5 py-10 text-center text-[13px] text-ink2">Cargando…</p>
          ) : rows.length === 0 ? (
            <div className="relative overflow-hidden px-5 py-16 text-center">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: "radial-gradient(rgb(var(--c-faint)) 1.2px, transparent 1.2px)",
                  backgroundSize: "10px 10px",
                  opacity: 0.13,
                }}
              />
              <span className="relative mx-auto grid h-[110px] w-[110px] place-items-center rounded-full bg-pinkSoft text-ink2">
                <Wallet size={46} strokeWidth={1.6} />
              </span>
              <p className="relative mt-5 text-[19px] font-extrabold text-ink">
                Sin gastos registrados.
              </p>
              <p className="relative mt-1.5 text-[13px] text-ink2">
                Cargá acá lo que pagás: alquiler, luz, sueldos, fletes.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  {["Fecha", "Categoría", "Descripción", "Cargado por", "Monto"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.8px] text-ink2 ${
                        i === 4 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-[13px] text-ink2">{fmt(g.spentAt)}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-pinkSoft px-2.5 py-1 text-[11.5px] font-bold text-ink">
                        {g.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-ink">{g.description || "—"}</td>
                    <td className="px-5 py-3 text-[12.5px] text-ink2">{g.createdBy || "—"}</td>
                    <td className="px-5 py-3 text-right text-[14px] font-bold text-ink">
                      {bs2(g.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* En qué se va la plata: la misma barra que usa Reportes. */}
        {porCategoria.length > 0 && (
          <div className="mt-4 rounded-[18px] border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
                style={{ background: "#F5A80024", color: "#C88600" }}
              >
                <Tags size={18} />
              </span>
              <h2 className="text-[15px] font-bold text-ink">Gastos por categoría</h2>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {porCategoria.slice(0, 8).map((c) => (
                <div key={c.categoria}>
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px] font-medium text-ink">{c.categoria}</span>
                    <span className="text-[13px] font-bold text-ink">{bs2(c.monto)}</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, (c.monto / maxCategoria) * 100)}%`,
                        background: "linear-gradient(90deg,#FFC93C,#F0A400)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {nuevo && (
        <NuevoGastoModal
          onClose={() => setNuevo(false)}
          onSaved={() => {
            setNuevo(false);
            showToast("Gasto registrado");
            load();
          }}
        />
      )}
    </div>
  );
}

/** Tarjeta de dato de Gastos: el mismo bloque que usan Reportes y Caja. */
function GastoCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-[18px] border border-line bg-surface p-5 shadow-card">
      <span
        aria-hidden
        className="pointer-events-none absolute right-4 top-5 h-[42px] w-[72px]"
        style={{
          backgroundImage: "radial-gradient(rgb(var(--c-faint)) 1.3px, transparent 1.3px)",
          backgroundSize: "9px 9px",
          opacity: 0.28,
        }}
      />
      <IconTile icon={icon} tone={tone} />
      <span className="relative min-w-0">
        <span className="block truncate text-[12.5px] text-ink2">{label}</span>
        <span className="mt-1 block truncate text-[24px] font-extrabold leading-none text-ink">
          {value}
        </span>
      </span>
    </div>
  );
}

function NuevoGastoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [spentAt, setSpentAt] = useState(hoyISO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    const monto = Number(amount);
    if (!Number.isFinite(monto) || monto <= 0) return setError("Ingresá un monto mayor a cero.");
    setSaving(true);
    setError(null);
    try {
      await apiCreateExpense({
        category: category.trim() || "General",
        description: description.trim(),
        amount: monto,
        spentAt,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el gasto.");
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
        className="w-full max-w-[440px] rounded-[20px] bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-extrabold text-ink">Nuevo gasto</h2>
          <button onClick={onClose} className="text-ink2 hover:text-ink">
            <X size={22} />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] font-semibold text-ink2">Categoría</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Servicios, Alquiler, Sueldos…"
            className={input}
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[12px] font-semibold text-ink2">Descripción</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalle del gasto"
            className={input}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-semibold text-ink2">Monto (Bs)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={input}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-ink2">Fecha</span>
            <input
              type="date"
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
              className={input}
            />
          </label>
        </div>

        {error && <p className="mt-3 text-[13px] text-error">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-[11px] border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink2"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="flex-1 rounded-[11px] bg-pink px-4 py-2.5 text-[13.5px] font-bold text-onAccent disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
