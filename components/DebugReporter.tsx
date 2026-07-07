"use client";

import { useState } from "react";
import { Bug, Check, Loader2, Send, X } from "lucide-react";

/**
 * Botón flotante "Debug" (abajo-derecha) para reportar bugs / mejoras.
 * Envía al sistema de Tickets vía el proxy `/api/tickets/report` → los reportes
 * entran en estado "desarrollo" con el proyecto FloresOnline.
 *
 * `surface` distingue desde dónde se reporta (web / crm) para el contexto.
 */
export function DebugReporter({ surface = "web" }: { surface?: "web" | "crm" }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"error" | "optimizacion">("error");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [email, setEmail] = useState("desarrolloia@petroboxinc.com");
  const [imagen, setImagen] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const reset = () => {
    setTipo("error");
    setTitulo("");
    setDescripcion("");
    setImagen(null);
    setOkMsg(null);
    setErrMsg(null);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 200);
  };

  const submit = async () => {
    setErrMsg(null);
    if (!titulo.trim() || !descripcion.trim()) {
      setErrMsg("Completá título y descripción.");
      return;
    }
    if (!email.trim()) {
      setErrMsg("Ingresá un correo de contacto.");
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("tipo", tipo);
      fd.append("titulo", titulo.trim());
      fd.append("descripcion", descripcion.trim());
      fd.append("email", email.trim());
      fd.append("surface", surface);
      fd.append("url", typeof window !== "undefined" ? window.location.href : "");
      if (imagen) fd.append("imagen", imagen);

      const r = await fetch("/api/tickets/report", { method: "POST", body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "No se pudo enviar el reporte.");
      setOkMsg(data?.numero_ticket || "Reporte enviado");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Error al enviar el reporte.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* FAB abajo-derecha */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Reportar un bug"
        className="fixed bottom-5 right-5 z-[85] inline-flex items-center gap-2 rounded-full bg-[#1f2937] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_6px_20px_rgba(0,0,0,0.28)] transition-transform hover:scale-[1.04] active:scale-95"
      >
        <Bug size={17} /> Debug
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            {/* Cabecera */}
            <div className="flex items-start justify-between">
              <h3 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
                <span className="text-[#1f2937]"><Bug size={18} /></span>
                Reportar bug o mejora
              </h3>
              <button onClick={close} aria-label="Cerrar" className="text-ink2 hover:text-ink">
                <X size={22} />
              </button>
            </div>

            {okMsg ? (
              <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-green-100 text-green-700">
                  <Check size={30} />
                </span>
                <p className="text-[15px] font-semibold text-ink">¡Reporte enviado!</p>
                <p className="text-[13px] text-ink2">
                  Ticket <span className="font-semibold text-ink">{okMsg}</span> creado en Desarrollo.
                  El equipo ya puede verlo.
                </p>
                <button
                  onClick={close}
                  className="mt-2 rounded-full bg-[#1f2937] px-6 py-2.5 text-[13px] font-semibold text-white"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {/* Tipo */}
                <div className="grid grid-cols-2 gap-2">
                  {(["error", "optimizacion"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTipo(t)}
                      className={`rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                        tipo === t
                          ? "border-[#1f2937] bg-[#1f2937] text-white"
                          : "border-line bg-surface2 text-ink2"
                      }`}
                    >
                      {t === "error" ? "🐞 Error" : "✨ Mejora"}
                    </button>
                  ))}
                </div>

                <Field label="Título">
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Resumen corto del problema"
                    className={inputCls}
                  />
                </Field>

                <Field label="Descripción">
                  <textarea
                    rows={4}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="¿Qué pasó? ¿Qué esperabas que pasara?"
                    className={inputCls}
                  />
                </Field>

                <Field label="Correo de contacto">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    className={inputCls}
                  />
                </Field>

                <Field label="Captura (opcional)">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImagen(e.target.files?.[0] ?? null)}
                    className="block w-full text-[12.5px] text-ink2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-[12.5px] file:font-semibold file:text-ink"
                  />
                </Field>

                {errMsg && <p className="text-[12.5px] font-medium text-red-600">{errMsg}</p>}

                <button
                  onClick={submit}
                  disabled={sending}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1f2937] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
                >
                  {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
                  {sending ? "Enviando…" : "Enviar reporte"}
                </button>
                <p className="text-center text-[11px] text-faint">
                  Se registra en Tickets (Desarrollo) · Proyecto FloresOnline
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-[#1f2937]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink2">{label}</span>
      {children}
    </label>
  );
}
