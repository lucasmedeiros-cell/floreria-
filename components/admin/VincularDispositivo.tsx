"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, Loader2, RefreshCw } from "lucide-react";
import { apiBase, apiUrl } from "@/lib/apiBase";
import { useToast } from "@/context/StoreProvider";
import { PrimaryButton } from "@/components/ui";

/**
 * Vincular dispositivo — así se conecta la app móvil por primera vez.
 *
 * Genera un código de 6 dígitos, de un solo uso y con vencimiento. El empleado
 * lo tipea en la app (pantalla de pareo) y el teléfono queda vinculado a este
 * negocio. Reemplaza al viejo "pegá la URL del servidor": el usuario no tiene
 * que saber ninguna dirección.
 */
export function VincularDispositivo() {
  const { showToast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [restante, setRestante] = useState(0);
  const [loading, setLoading] = useState(false);

  const generar = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/devices/pair-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "No se pudo generar el código.");
      setCode(data.code);
      setExpiresAt(new Date(data.expiresAt).getTime());
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo generar el código.");
    } finally {
      setLoading(false);
    }
  };

  // Cuenta regresiva; al llegar a 0, el código deja de servir y se limpia.
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRestante(s);
      if (s === 0) setCode(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mmss = `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, "0")}`;

  // Contenido del QR: el servidor de este panel + el código. La app lo escanea,
  // adopta el servidor y canjea el código en un solo paso (sin escribir nada).
  const qrValue =
    code && typeof window !== "undefined"
      ? JSON.stringify({ server: window.location.origin + apiBase(), code })
      : "";

  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <span className="text-ink">
          <Smartphone size={18} />
        </span>
        Vincular dispositivo
      </h3>
      <p className="mt-1 text-[12.5px] text-ink2">
        Generá un código y escribilo en la app easy pos del teléfono para
        conectarlo a este negocio. Vence a los 15 minutos y sirve una sola vez.
      </p>

      {code ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-[14px] border border-line bg-surface2 py-6">
          {qrValue && (
            <div className="rounded-[12px] bg-white p-3 shadow-soft">
              <QRCodeSVG value={qrValue} size={168} level="M" />
            </div>
          )}
          <span className="text-[12px] text-ink2">
            Escaneá el QR desde la app, o escribí el código:
          </span>
          <span className="font-mono text-[40px] font-bold tracking-[0.35em] text-ink">
            {code}
          </span>
          <span className="text-[12px] text-ink2">
            Vence en <span className="font-semibold text-ink">{mmss}</span>
          </span>
          <button
            onClick={generar}
            className="mt-1 flex items-center gap-1 text-[12px] font-medium text-ink hover:underline"
          >
            <RefreshCw size={13} /> Generar otro
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <PrimaryButton
            label={loading ? "Generando…" : "Generar código"}
            icon={
              loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Smartphone size={16} />
              )
            }
            onClick={loading ? undefined : generar}
          />
        </div>
      )}
    </div>
  );
}
