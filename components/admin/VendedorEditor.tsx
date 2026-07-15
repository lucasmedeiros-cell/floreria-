"use client";

import { apiUrl } from "@/lib/apiBase";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, QrCode, Save, Send, Smartphone } from "lucide-react";
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
  authMode: "api-key" | "cuenta" | "simulado";
  cloudConnected: boolean;
}

interface BaileysStatus {
  status: "idle" | "connecting" | "qr" | "open" | "closed" | "unavailable";
  connected: boolean;
  available?: boolean;
  qr: string | null;
  error?: string | null;
}

const fallback: VendedorConfig = {
  botEnabled: true,
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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // WhatsApp por Baileys (QR)
  const [wa, setWa] = useState<BaileysStatus | null>(null);
  const [waBusy, setWaBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setStatus(data.status);
      })
      .catch(() => showToast("No se pudo cargar la configuración del vendedor"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [showToast]);

  // Estado de Baileys (polling mientras esté abierto el panel).
  const refreshWa = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/whatsapp/baileys"));
      if (!r.ok) return;
      setWa(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshWa();
    pollRef.current = setInterval(refreshWa, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshWa]);

  const connectWa = async () => {
    setWaBusy(true);
    try {
      const r = await fetch(apiUrl("/api/whatsapp/baileys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!r.ok) throw new Error();
      setWa(await r.json());
      showToast("Generando QR… escanéalo desde WhatsApp");
    } catch {
      showToast("No se pudo iniciar la conexión de WhatsApp");
    } finally {
      setWaBusy(false);
    }
  };

  const disconnectWa = async () => {
    setWaBusy(true);
    try {
      await fetch(apiUrl("/api/whatsapp/baileys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      await refreshWa();
      showToast("WhatsApp desconectado");
    } finally {
      setWaBusy(false);
    }
  };

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
      setStatus(data.status);
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
        <span className="text-pink"><Bot size={18} /></span>
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
          on={status.authMode === "cuenta" ? "IA conectada (token de cuenta)" : "IA conectada (Claude)"}
          off="IA en modo simulado"
        />
        <Badge ok={!!wa?.connected} on="WhatsApp vinculado (Baileys)" off="WhatsApp sin vincular" />
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

        <Field label="Formas de pago que ofrece" value={cfg.paymentOptions} onChange={(v) => set("paymentOptions", v)} rows={2} />
        <Field label="Mensaje fuera de horario (opcional)" value={cfg.offHoursMessage} onChange={(v) => set("offHoursMessage", v)} rows={2}
          placeholder="Vacío = no responde fuera de horario" />

        <PrimaryButton
          label={saving ? "Guardando…" : "Guardar vendedor"}
          icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          onClick={save}
          disabled={saving}
        />
      </div>

      {/* Conectar WhatsApp por QR (Baileys) */}
      <div className="mt-5 rounded-2xl border border-line bg-surface2 p-4">
        <h4 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Smartphone size={15} className="text-pink" /> Conectar WhatsApp (Baileys)
        </h4>
        <p className="mt-0.5 text-[11.5px] text-ink2">
          Vincula tu número escaneando un QR (WhatsApp → Dispositivos vinculados). Una vez
          conectado, el vendedor responde solo los mensajes que te llegan.
        </p>

        {wa?.available === false ? (
          <div className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3 text-[12px] text-amber-800">
            {wa.error ??
              "La vinculación por QR no está disponible en este despliegue (serverless). Ejecutá el vendedor en local o en el servidor bilbo."}
          </div>
        ) : wa?.connected ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11.5px] font-semibold text-green-700">
              ✓ Número vinculado y activo
            </span>
            <button
              onClick={disconnectWa}
              disabled={waBusy}
              className="text-[12.5px] font-semibold text-ink2 hover:text-pink disabled:opacity-60"
            >
              Desconectar
            </button>
          </div>
        ) : wa?.qr ? (
          <div className="mt-3 flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wa.qr} alt="QR de WhatsApp" className="h-56 w-56 rounded-xl bg-white p-2" />
            <p className="text-[11.5px] text-ink2">
              Abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo y escanea.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={connectWa}
              disabled={waBusy || wa?.status === "connecting"}
              className="inline-flex items-center gap-2 rounded-xl bg-pink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {waBusy || wa?.status === "connecting" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <QrCode size={15} />
              )}
              {wa?.status === "connecting" ? "Generando QR…" : "Generar QR y conectar"}
            </button>
            {wa?.error && <span className="text-[11.5px] text-red-600">{wa.error}</span>}
          </div>
        )}
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
            className="inline-flex items-center gap-2 rounded-xl bg-pink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
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
