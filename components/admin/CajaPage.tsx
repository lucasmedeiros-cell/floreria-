"use client";

import { useEffect, useState } from "react";
import { Banknote, Coins, Info, Lock, QrCode, Scale, Wallet } from "lucide-react";
import { bs2 } from "@/lib/products";
import { useToast } from "@/context/StoreProvider";
import { apiCashShift, apiCloseCash, type CashShift } from "@/lib/cashClient";

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
    <div className="relative h-full overflow-y-auto bg-bg">
      {/* Texturas del fondo, como en el diseño. Decorativas: no tapan nada. */}
      <Puntos className="right-[8%] top-6 h-[70px] w-[150px]" />
      <Puntos className="bottom-[18%] right-[6%] h-[80px] w-[120px]" />

      <div className="relative mx-auto w-full max-w-[1500px] px-5 pb-10 pt-6 sm:px-8">
        <h1 className="text-[27px] font-extrabold leading-none tracking-[-0.4px] text-ink">
          Corte de caja
        </h1>
        <p className="mt-1.5 text-[13px] text-ink2">
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
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CajaCard
                icon={<Wallet size={22} />}
                tone="#F5A800"
                value={bs2(turno.totalVentas)}
                label="Total vendido"
              />
              <CajaCard
                icon={<Banknote size={22} />}
                tone="#2EA66B"
                value={bs2(turno.totalEfectivo)}
                label="Efectivo"
              />
              <CajaCard
                icon={<QrCode size={22} />}
                tone="#3B6FD4"
                value={bs2(turno.totalQr)}
                label="QR / Transferencia"
              />
              <CajaCard
                icon={<Coins size={22} />}
                tone="#7C6BE0"
                value={bs2(turno.totalOtros)}
                label="Otros medios"
              />
            </div>

            {/* Arqueo: lo único que se carga a mano es el efectivo contado. */}
            <div className="relative mt-4 max-w-[540px] overflow-hidden rounded-[18px] border border-line bg-surface p-6 shadow-card">
              <Puntos className="-bottom-2 left-4 h-[60px] w-[110px]" />
              <div className="relative flex items-center gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px]"
                  style={{ background: "#F5A80024", color: "#C88600" }}
                >
                  <Scale size={22} />
                </span>
                <h2 className="text-[19px] font-extrabold text-ink">Arqueo</h2>
              </div>
              <p className="relative mt-3 text-[13px] text-ink2">
                Contá el efectivo que hay en el cajón y escribilo acá.
              </p>

              <label className="relative mt-4 block">
                <span className="text-[12.5px] font-semibold text-ink2">
                  Efectivo contado en caja (Bs)
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={contado}
                  onChange={(e) => setContado(e.target.value)}
                  placeholder="0.0"
                  className="mt-1.5 w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink"
                />
              </label>

              <div className="relative mt-4 flex items-center justify-between border-t border-dashed border-line pt-4">
                <span className="text-[14px] font-bold text-ink">Diferencia</span>
                <span
                  className={`text-[19px] font-extrabold leading-none ${
                    cuadra ? "text-success" : "text-error"
                  }`}
                >
                  {diferencia < 0 ? "-" : ""}
                  {bs2(Math.abs(diferencia))}
                </span>
              </div>
              <p className="relative mt-1.5 text-[12px] text-ink2">
                {cuadra
                  ? "La caja cuadra con lo vendido en efectivo."
                  : diferencia > 0
                    ? "Hay más efectivo del que registran las ventas (sobrante)."
                    : "Falta efectivo respecto de lo vendido."}
              </p>

              <button
                onClick={cerrar}
                disabled={cerrando}
                className="relative mt-5 flex w-full items-center justify-center gap-2.5 rounded-[12px] px-4 py-3.5 text-[14.5px] font-extrabold text-onAccent transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: "linear-gradient(100deg,#FFC93C,#FEBB03 55%,#F0A400)" }}
              >
                <Lock size={18} /> {cerrando ? "Cerrando…" : "Cerrar caja"}
              </button>
              <p className="relative mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-ink2">
                <Info size={15} className="mt-px shrink-0 text-faint" />
                Al cerrar se guarda el resumen del turno con la diferencia, y el próximo turno
                arranca de cero.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Tarjeta de un medio de cobro del turno: el ícono en su color, el monto
 * grande, y la ola de color en la esquina — el mismo bloque del diseño.
 */
function CajaCard({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-line bg-surface p-5 shadow-card">
      <Puntos className="right-4 top-5 h-[42px] w-[72px]" />
      {/* Ola de color de la esquina inferior derecha. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-28 rounded-[40%]"
        style={{ background: `linear-gradient(135deg, ${tone}00, ${tone}33)` }}
      />
      <span
        className="relative grid h-12 w-12 place-items-center rounded-[13px]"
        style={{ background: `${tone}24`, color: tone }}
      >
        {icon}
      </span>
      <p className="relative mt-4 truncate text-[25px] font-extrabold leading-none text-ink">
        {value}
      </p>
      <p className="relative mt-2 truncate text-[12.5px] text-ink2">{label}</p>
    </div>
  );
}

/** Trama de puntitos del diseño. Puramente decorativa. */
function Puntos({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{
        backgroundImage: "radial-gradient(currentColor 1.3px, transparent 1.3px)",
        backgroundSize: "9px 9px",
        color: "rgb(var(--c-faint))",
        opacity: 0.28,
      }}
    />
  );
}
