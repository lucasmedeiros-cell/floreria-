"use client";

import { apiUrl } from "@/lib/apiBase";
import { useEffect, useState } from "react";
import { Bot, Loader2, Save, Send, Smartphone } from "lucide-react";
import { useToast } from "@/context/StoreProvider";
import { PrimaryButton } from "@/components/ui";

interface VendedorConfig {
  botEnabled: boolean;
  botPersona: string;
  activationKeyword: string;
  aiModel: string;
  paymentOptions: string;
  offHoursMessage: string;
  timezone: string;
}

interface Status {
  aiConfigured: boolean;
  authMode: "plan" | "api-key" | "cuenta" | "simulado";
  /** Hay al menos un número de Meta atendiendo a este negocio. */
  cloudConnected: boolean;
  /** Los números que le asignó el panel de easy pos (solo para mostrarlos). */
  numeros: { numero: string | null; etiqueta: string | null; activo: boolean }[];
}

/** Con qué credencial está respondiendo la IA (lo dice /api/whatsapp/config). */
const MODO_IA: Record<Status["authMode"], string> = {
  plan: "IA conectada (plan del vendedor)",
  "api-key": "IA conectada (API key)",
  cuenta: "IA conectada (token de cuenta)",
  simulado: "IA en modo simulado",
};

const fallback: VendedorConfig = {
  botEnabled: false,
  botPersona: "",
  activationKeyword: "",
  aiModel: "claude-haiku-4-5",
  paymentOptions: "",
  offHoursMessage: "",
  timezone: "America/La_Paz",
};

/** Editor del Vendedor 24/7 — bot de WhatsApp con IA. */
export function VendedorEditor() {
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<VendedorConfig>(fallback);
  const [status, setStatus] = useState<Status>({
    aiConfigured: false,
    authMode: "simulado",
    cloudConnected: false,
    numeros: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Probador local
  const [testMsg, setTestMsg] = useState("Hola, ¿qué me pueden ofrecer?");
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/whatsapp/config"))
      .then((r) => r.json())
      .then((data: { config: VendedorConfig; status: Status }) => {
        if (!alive) return;
        setCfg({ ...fallback, ...data.config });
        setStatus({ ...data.status, numeros: data.status.numeros ?? [] });
      })
      .catch(() => showToast("No se pudo cargar la configuración del vendedor"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [showToast]);

  const set = <K extends keyof VendedorConfig>(key: K, value: VendedorConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/whatsapp/config"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { config: VendedorConfig; status: Status };
      setCfg({ ...fallback, ...data.config });
      setStatus({ ...data.status, numeros: data.status.numeros ?? [] });
      showToast("Vendedor 24/7 guardado");
    } catch {
      showToast("No se pudo guardar. Revisa tu sesión.");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    const text = testMsg.trim();
    if (!text) return;
    setTesting(true);
    setTestReply(null);
    try {
      const res = await fetch(apiUrl("/api/whatsapp/simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setTestReply(data.text ?? "(sin respuesta)");
    } catch (e) {
      setTestReply(
        "Error: " + (e instanceof Error ? e.message : "no se pudo simular la conversación")
      );
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[18px] border border-line bg-surface p-5 text-[13px] text-ink2 shadow-soft">
        <Loader2 size={16} className="animate-spin" /> Cargando el Vendedor 24/7…
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <span className="text-ink"><Bot size={18} /></span>
        Vendedor 24/7 (WhatsApp con IA)
      </h3>
      <p className="mt-1 text-[12.5px] text-ink2">
        Un asistente responde tu WhatsApp automáticamente actuando como vendedor: usa tu catálogo,
        toma el pedido y cobra por QR. Configúralo aquí.
      </p>

      {/* Estado */}
      <div className="mt-3 flex flex-wrap gap-2 text-[11.5px] font-semibold">
        <Badge
          ok={status.aiConfigured}
          on={MODO_IA[status.authMode] ?? "IA conectada (Claude)"}
          off="IA en modo simulado"
        />
        <Badge
          ok={status.cloudConnected}
          on="WhatsApp conectado (oficial de Meta)"
          off="WhatsApp sin número asignado"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Toggle label="Vendedor 24/7 activo" checked={cfg.botEnabled} onChange={() => set("botEnabled", !cfg.botEnabled)} />

        <Field label="Persona del asistente" value={cfg.botPersona} onChange={(v) => set("botPersona", v)} rows={4}
          placeholder="Vacío = usa la persona del rubro (Configuración → Rubro del negocio)" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Palabra clave de activación (opcional)" value={cfg.activationKeyword} onChange={(v) => set("activationKeyword", v)}
            placeholder="vacío = responde siempre" />
          <Field label="Modelo de IA" value={cfg.aiModel} onChange={(v) => set("aiModel", v)} placeholder="claude-haiku-4-5" />
        </div>

        {/* El vendedor atiende 24/7 (de ahí el nombre): no hay horario que
            configurar, así que tampoco hay mensaje de fuera de horario. */}
        <Field label="Formas de pago que ofrece" value={cfg.paymentOptions} onChange={(v) => set("paymentOptions", v)} rows={2} />

        <PrimaryButton
          label={saving ? "Guardando…" : "Guardar vendedor"}
          icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          onClick={save}
          disabled={saving}
        />
      </div>

      {/* Número de WhatsApp (Cloud API oficial de Meta) */}
      <div className="mt-5 rounded-2xl border border-line bg-surface2 p-4">
        <h4 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Smartphone size={15} className="text-ink" /> Tu número de WhatsApp
        </h4>

        {status.numeros.length > 0 ? (
          <>
            <p className="mt-0.5 text-[11.5px] text-ink2">
              El vendedor atiende los mensajes que llegan a este número.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {status.numeros.map((n, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-ink">{n.numero || "Número asignado"}</span>
                  {n.etiqueta && <span className="text-[11.5px] text-ink2">{n.etiqueta}</span>}
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                      n.activo ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {n.activo ? "✓ Atendiendo" : "Pausado"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-[12px] text-ink2">
            Todavía no tienes un número asignado, así que el vendedor no recibe mensajes. Pasale tu
            número de WhatsApp al equipo de easy pos y lo damos de alta en Meta.
          </p>
        )}

        <p className="mt-3 text-[11.5px] text-faint">
          Es WhatsApp oficial (Cloud API de Meta): no hay QR que escanear ni un teléfono que tenga
          que quedar prendido.
        </p>
      </div>

      {/* Probador local */}
      <div className="mt-5 rounded-2xl border border-line bg-surface2 p-4">
        <h4 className="text-[13px] font-semibold text-ink">Probar la conversación</h4>
        <p className="mt-0.5 text-[11.5px] text-ink2">
          Simula un mensaje de cliente sin usar WhatsApp real. Ideal para probar en local.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={testMsg}
            onChange={(e) => setTestMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runTest()}
            placeholder="Escribe como si fueras un cliente…"
            className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-pink"
          />
          <button
            onClick={runTest}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-xl bg-pink px-4 py-2.5 text-[13px] font-semibold text-onAccent disabled:opacity-60"
          >
            {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar
          </button>
        </div>
        {testReply !== null && (
          <div className="mt-3 rounded-xl bg-surface px-3.5 py-3 text-[13.5px] text-ink border border-line">
            <span className="text-[11px] font-semibold text-ink2">Respuesta del vendedor:</span>
            <p className="mt-1 whitespace-pre-wrap">{testReply}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ ok, on, off }: { ok: boolean; on: string; off: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 ${
        ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {ok ? on : off}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const cls =
    "mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink";
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink2">{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5">
      <span className="text-[13.5px] text-ink">{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-9 accent-pink" />
    </label>
  );
}
