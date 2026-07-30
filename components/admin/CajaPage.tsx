"use client";

import { useEffect, useState } from "react";
import { Banknote, Coins, QrCode, Wallet } from "lucide-react";
import { bs2 } from "@/lib/products";
import { useToast } from "@/context/StoreProvider";
import { apiCashShift, apiCloseCash, type CashShift } from "@/lib/cashClient";
import { StatCard } from "./kit";

function fmt(iso: string | null): string {
  if (!iso) return "el inicio del día";
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

/**
 * Corte de caja — el arqueo del turno.
 *
 * El turno son las ventas desde el último cierre (o desde que arrancó el día).
 * El sistema dice cuánto efectivo DEBERÍA haber; el cajero cuenta el que hay de
 * verdad y la diferencia queda guardada con el cierre. Después de cerrar, el
 * turno siguiente arranca de cero.
 */
export function CajaPage() {
  const { showToast } = useToast();
  const [turno, setTurno] = useState<CashShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [contado, setContado] = useState("");
  const [cerrando, setCerrando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setTurno(await apiCashShift());
      setErr(null);
    } catch {
      setErr("No se pudo cargar el turno de caja.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cerrar = async () => {
    setCerrando(true);
    try {
      const res = await apiCloseCash(Number(contado) || 0);
      showToast(`Caja cerrada · diferencia ${bs2(res.difference)}`);
      setContado("");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo cerrar la caja.");
    } finally {
      setCerrando(false);
    }
  };

  const diferencia = (Number(contado) || 0) - (turno?.totalEfectivo ?? 0);
  const cuadra = Math.abs(diferencia) < 0.005;

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <h1 className="font-serif text-[30px] font-semibold text-ink">Corte de caja</h1>
      <p className="mt-1 text-[13px] text-ink2">
        {loading || !turno
          ? "Cargando el turno…"
          : `Turno desde ${fmt(turno.fromAt)} · ${turno.numVentas} ${
              turno.numVentas === 1 ? "venta" : "ventas"
            }.`}
      </p>

      {err && (
        <div className="mt-5 rounded-[14px] border border-error/30 bg-error/5 px-4 py-3 text-[13px] text-error">
          {err}
        </div>
      )}

      {turno && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3.5 xl:grid-cols-4">
            <StatCard
              icon={<Wallet size={22} />}
              value={bs2(turno.totalVentas)}
              label="Total vendido"
            />
            <StatCard
              icon={<Banknote size={22} />}
              value={bs2(turno.totalEfectivo)}
              label="Efectivo"
              color="#1F9D55"
            />
            <StatCard
              icon={<QrCode size={22} />}
              value={bs2(turno.totalQr)}
              label="QR / Transferencia"
              color="#2563EB"
            />
            <StatCard
              icon={<Coins size={22} />}
              value={bs2(turno.totalOtros)}
              label="Otros medios"
              color="#8B5CF6"
            />
          </div>

          {/* Arqueo: lo único que se carga a mano es el efectivo contado. */}
          <div className="mt-5 max-w-[480px] rounded-[18px] border border-line bg-surface p-5 shadow-soft">
            <h2 className="text-[15px] font-semibold text-ink">Arqueo</h2>
            <p className="mt-1 text-[12.5px] text-ink2">
              Contá el efectivo que hay en el cajón y escribilo acá.
            </p>

            <label className="mt-4 block">
              <span className="text-[12px] font-semibold text-ink2">
                Efectivo contado en caja (Bs)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={contado}
                onChange={(e) => setContado(e.target.value)}
                placeholder="0.00"
                className="mt-1.5 w-full rounded-[11px] border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink"
              />
            </label>

            <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
              <span className="text-[13.5px] font-semibold text-ink2">Diferencia</span>
              <span
                className={`font-serif text-[22px] font-bold leading-none ${
                  cuadra ? "text-emerald-600" : "text-error"
                }`}
              >
                {diferencia < 0 ? "-" : ""}
                {bs2(Math.abs(diferencia))}
              </span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-faint">
              {cuadra
                ? "La caja cuadra con lo vendido en efectivo."
                : diferencia > 0
                  ? "Hay más efectivo del que registran las ventas (sobrante)."
                  : "Falta efectivo respecto de lo vendido."}
            </p>

            <button
              onClick={cerrar}
              disabled={cerrando}
              className="mt-4 w-full rounded-[12px] bg-pink px-4 py-3 text-[14px] font-bold text-onAccent disabled:opacity-50"
            >
              {cerrando ? "Cerrando…" : "Cerrar caja"}
            </button>
            <p className="mt-2 text-[11.5px] text-faint">
              Al cerrar se guarda el resumen del turno con la diferencia, y el próximo turno
              arranca de cero.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
