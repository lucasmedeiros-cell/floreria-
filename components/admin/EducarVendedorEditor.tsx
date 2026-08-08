"use client";

import { apiUrl } from "@/lib/apiBase";
import { useEffect, useState } from "react";
import { Bot, GraduationCap, Loader2, Save, Send } from "lucide-react";
import { useToast } from "@/context/StoreProvider";
import { PrimaryButton } from "@/components/ui";

/**
 * Educar al Vendedor 24/7 desde Configuración.
 *
 * El bot ya sabe vender con el catálogo; lo que no puede saber es cómo trabaja
 * ESTE negocio: si hace envíos, qué promo está vigente, qué no tiene que
 * prometer. Eso se escribe acá y viaja en cada respuesta.
 *
 * Va con el probador al lado a propósito: educar es escribir, probar y corregir.
 * Sin probar en el momento, nadie sabe si la indicación sirvió.
 */

interface Cfg {
  botEnabled: boolean;
  botPersona: string;
  botInstructions: string;
}

interface Estado {
  aiConfigured: boolean;
  authMode: "plan" | "api-key" | "cuenta" | "simulado";
}

const EJEMPLO = `Hacemos envíos en Santa Cruz el mismo día si el pedido entra antes de las 16:00; al interior, por flota y el cliente paga el envío.
El pack de 3 unidades siempre conviene: ofrecelo cuando pidan una sola.
No damos consejos médicos ni prometemos resultados. Si preguntan por dosis, decí que sigan lo que indica el envase y consulten a su médico.
No vendemos a menores de 18 años.
Si piden factura, pedí NIT y razón social.`;

export function EducarVendedorEditor() {
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<Cfg>({ botEnabled: false, botPersona: "", botInstructions: "" });
  const [estado, setEstado] = useState<Estado>({ aiConfigured: false, authMode: "simulado" });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [prueba, setPrueba] = useState("Hola, cuánto cuesta y hacen envíos?");
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(apiUrl("/api/whatsapp/config"))
      .then((r) => r.json())
      .then((d: { config: Cfg; status: Estado }) => {
        if (!vivo) return;
        setCfg({
          botEnabled: !!d.config?.botEnabled,
          botPersona: d.config?.botPersona ?? "",
          botInstructions: d.config?.botInstructions ?? "",
        });
        setEstado(d.status);
      })
      .catch(() => showToast("No se pudo cargar la configuración del vendedor"))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [showToast]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await fetch(apiUrl("/api/whatsapp/config"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!r.ok) throw new Error();
      showToast("Indicaciones guardadas");
    } catch {
      showToast("No se pudo guardar. Revisá tu sesión.");
    } finally {
      setGuardando(false);
    }
  };

  const probar = async () => {
    const texto = prueba.trim();
    if (!texto) return;
    setProbando(true);
    setRespuesta(null);
    try {
      const r = await fetch(apiUrl("/api/whatsapp/simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: texto }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error);
      setRespuesta(d.text ?? "(sin respuesta)");
    } catch (e) {
      setRespuesta("Error: " + (e instanceof Error ? e.message : "no se pudo probar"));
    } finally {
      setProbando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center gap-2 rounded-[18px] border border-line bg-surface p-5 text-[13px] text-ink2 shadow-soft">
        <Loader2 size={16} className="animate-spin" /> Cargando el vendedor…
      </div>
    );
  }

  const campo =
    "mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink";

  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <GraduationCap size={18} /> Educar al vendedor
      </h3>
      <p className="mt-1 text-[12.5px] text-ink2">
        Acá le enseñás cómo trabaja tu negocio. El catálogo y los precios ya los sabe: esto es todo
        lo demás — envíos, promociones, y lo que no tiene que prometer.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
            cfg.botEnabled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"
          }`}
        >
          <Bot size={13} /> {cfg.botEnabled ? "Vendedor encendido" : "Vendedor apagado"}
        </span>
        {!estado.aiConfigured && (
          <span className="text-[11.5px] font-semibold text-amber-700">
            La IA está en modo simulado: las respuestas son de ejemplo.
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <label className="block">
          <span className="text-[12px] font-semibold text-ink2">
            Indicaciones para el vendedor
          </span>
          <textarea
            rows={10}
            value={cfg.botInstructions}
            onChange={(e) => setCfg({ ...cfg, botInstructions: e.target.value })}
            placeholder={EJEMPLO}
            className={campo}
          />
          <span className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11.5px] text-faint">
              Una indicación por línea, como si le hablaras a un vendedor nuevo.
            </span>
            <button
              type="button"
              onClick={() => setCfg({ ...cfg, botInstructions: EJEMPLO })}
              className="text-[11.5px] font-semibold text-ink2 underline hover:text-ink"
            >
              Usar el ejemplo
            </button>
          </span>
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-ink2">
            Quién es el vendedor (opcional)
          </span>
          <textarea
            rows={3}
            value={cfg.botPersona}
            onChange={(e) => setCfg({ ...cfg, botPersona: e.target.value })}
            placeholder="Vacío = usa la personalidad de tu rubro. Ej: Sos el vendedor de…, tuteás, sos breve y directo."
            className={campo}
          />
        </label>

        <PrimaryButton
          label={guardando ? "Guardando…" : "Guardar indicaciones"}
          icon={guardando ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          onClick={guardar}
          disabled={guardando}
        />
      </div>

      {/* Probador: escribir, probar, corregir. */}
      <div className="mt-5 rounded-2xl border border-line bg-surface2 p-4">
        <h4 className="text-[13px] font-semibold text-ink">Probalo como si fueras un cliente</h4>
        <p className="mt-0.5 text-[11.5px] text-ink2">
          Usa lo último que guardaste. No manda nada por WhatsApp.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={prueba}
            onChange={(e) => setPrueba(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !probando && probar()}
            className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-pink"
          />
          <button
            onClick={probar}
            disabled={probando}
            className="inline-flex items-center gap-2 rounded-xl bg-pink px-4 py-2.5 text-[13px] font-semibold text-onAccent disabled:opacity-60"
          >
            {probando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Probar
          </button>
        </div>
        {respuesta !== null && (
          <div className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] text-ink">
            <span className="text-[11px] font-semibold text-ink2">Respondió:</span>
            <p className="mt-1 whitespace-pre-wrap">{respuesta}</p>
          </div>
        )}
      </div>
    </div>
  );
}
