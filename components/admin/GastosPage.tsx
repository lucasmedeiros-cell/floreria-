"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Wallet, X } from "lucide-react";
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

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-[30px] font-semibold text-ink">Gastos</h1>
          <p className="mt-1 text-[13px] text-ink2">
            Egresos del negocio. Reportes los resta a las ventas.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <span className="text-[11px] font-semibold uppercase tracking-[2px] text-faint">
              Total
            </span>
            <p className="font-serif text-[26px] font-bold leading-none text-ink">{bs2(total)}</p>
          </div>
          <button
            onClick={() => setNuevo(true)}
            className="flex items-center gap-2 rounded-[12px] bg-pink px-4 py-2.5 text-[13.5px] font-bold text-onAccent"
          >
            <Plus size={18} /> Nuevo gasto
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-5 rounded-[14px] border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
          {err}
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-[18px] border border-line bg-surface shadow-soft">
        {loading ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink2">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Wallet size={34} className="mx-auto text-faint" />
            <p className="mt-3 text-[14px] font-medium text-ink">Sin gastos registrados.</p>
            <p className="mt-1 text-[12.5px] text-ink2">
              Cargá acá lo que pagás: alquiler, luz, sueldos, fletes.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                <th className="px-4 py-3 text-left font-semibold">Descripción</th>
                <th className="px-4 py-3 text-left font-semibold">Cargado por</th>
                <th className="px-4 py-3 text-right font-semibold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-[13px] text-ink2">{fmt(g.spentAt)}</td>
                  <td className="px-4 py-3 text-[13px] text-ink">{g.category}</td>
                  <td className="px-4 py-3 text-[13px] text-ink">{g.description || "—"}</td>
                  <td className="px-4 py-3 text-[12.5px] text-ink2">{g.createdBy || "—"}</td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold text-ink">
                    {bs2(g.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <h2 className="font-serif text-[22px] font-semibold text-ink">Nuevo gasto</h2>
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
