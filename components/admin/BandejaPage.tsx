"use client";

import { apiUrl } from "@/lib/apiBase";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, UserRound } from "lucide-react";
import { useToast } from "@/context/StoreProvider";

/**
 * Bandeja del Vendedor 24/7: las charlas de WhatsApp y el traspaso a humano.
 *
 * Es la pantalla que faltaba para poder intervenir una venta. Mientras la charla
 * esté "en manos del bot" contesta la IA; al tomar el control el motor se calla
 * (columna `bot_active`) y responde la persona desde acá.
 */

interface Charla {
  phone: string;
  name: string;
  botActive: boolean;
  campaign: string | null;
  lastMessageAt: string;
  ultimo: string | null;
  mensajes: number;
  pedidos: number;
}

interface Mensaje {
  direction: "in" | "out";
  body: string;
  fromBot: boolean;
  createdAt: string;
}

interface Pedido {
  code: string;
  status: string;
  paidAt: string | null;
  total: number | null;
}

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function BandejaPage() {
  const { showToast } = useToast();
  const [charlas, setCharlas] = useState<Charla[]>([]);
  const [elegida, setElegida] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [detalle, setDetalle] = useState<Charla | null>(null);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  const cargarLista = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/whatsapp/inbox"));
      const d = await r.json();
      setCharlas(d.charlas ?? []);
    } catch {
      /* se reintenta en el siguiente refresco */
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarCharla = useCallback(async (phone: string) => {
    try {
      const r = await fetch(apiUrl(`/api/whatsapp/inbox?phone=${encodeURIComponent(phone)}`));
      const d = await r.json();
      setMensajes(d.mensajes ?? []);
      setPedidos(d.pedidos ?? []);
      setDetalle(d.charla ?? null);
    } catch {
      /* idem */
    }
  }, []);

  // Refresco cada 5 s: la charla es en vivo, si no hay que apretar F5.
  useEffect(() => {
    cargarLista();
    const t = setInterval(cargarLista, 5000);
    return () => clearInterval(t);
  }, [cargarLista]);

  useEffect(() => {
    if (!elegida) return;
    cargarCharla(elegida);
    const t = setInterval(() => cargarCharla(elegida), 5000);
    return () => clearInterval(t);
  }, [elegida, cargarCharla]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  const accion = async (action: "tomar" | "devolver") => {
    if (!elegida) return;
    try {
      const r = await fetch(apiUrl("/api/whatsapp/inbox"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: elegida, action }),
      });
      if (!r.ok) throw new Error();
      showToast(action === "tomar" ? "Tomaste la charla" : "El bot vuelve a atender");
      await Promise.all([cargarCharla(elegida), cargarLista()]);
    } catch {
      showToast("No se pudo cambiar el control de la charla");
    }
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !elegida) return;
    setEnviando(true);
    try {
      const r = await fetch(apiUrl("/api/whatsapp/inbox"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: elegida, text: t }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error);
      setTexto("");
      await cargarCharla(elegida);
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : "No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col px-7 pb-6 pt-6">
      <div className="shrink-0">
        <h1 className="font-serif text-[30px] font-semibold text-ink">Conversaciones</h1>
        <p className="mt-1 text-[13px] text-ink2">
          Lo que atiende el Vendedor 24/7. Podés tomar el control de una charla y seguir vos.
        </p>
      </div>

      <div className="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Lista de charlas */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-line bg-surface shadow-soft">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cargando ? (
              <p className="flex items-center gap-2 p-5 text-[13px] text-ink2">
                <Loader2 size={15} className="animate-spin" /> Cargando…
              </p>
            ) : charlas.length === 0 ? (
              <p className="p-5 text-[13px] text-ink2">
                Todavía no hay conversaciones. Aparecen acá en cuanto alguien le escriba al
                WhatsApp del vendedor.
              </p>
            ) : (
              charlas.map((c) => (
                <button
                  key={c.phone}
                  onClick={() => setElegida(c.phone)}
                  className={`block w-full border-b border-line/60 px-4 py-3 text-left transition-colors ${
                    elegida === c.phone ? "bg-pink/5" : "hover:bg-surface2"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-ink">
                      {c.name || c.phone}
                    </span>
                    {!c.botActive && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        humano
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink2">
                    {c.ultimo ?? "—"}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-[10.5px] text-faint">
                    {hora(c.lastMessageAt)}
                    {c.pedidos > 0 && <span>· {c.pedidos} pedido(s)</span>}
                    {c.campaign && <span className="truncate">· {c.campaign}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* La charla */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-line bg-surface shadow-soft">
          {!elegida ? (
            <p className="p-5 text-[13px] text-ink2">Elegí una conversación de la izquierda.</p>
          ) : (
            <>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">
                    {detalle?.name || elegida}
                  </p>
                  <p className="text-[11.5px] text-faint">{elegida}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                      detalle?.botActive
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {detalle?.botActive ? <Bot size={13} /> : <UserRound size={13} />}
                    {detalle?.botActive ? "Atiende el bot" : "Atendés vos"}
                  </span>
                  {detalle?.botActive ? (
                    <button
                      onClick={() => accion("tomar")}
                      className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-surface"
                    >
                      Tomar el control
                    </button>
                  ) : (
                    <button
                      onClick={() => accion("devolver")}
                      className="rounded-full border border-line px-4 py-2 text-[12.5px] font-semibold text-ink"
                    >
                      Devolver al bot
                    </button>
                  )}
                </div>
              </div>

              {pedidos.length > 0 && (
                <div className="flex shrink-0 flex-wrap gap-2 border-b border-line bg-surface2/50 px-5 py-2.5">
                  {pedidos.map((p) => (
                    <span
                      key={p.code}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] text-ink2"
                    >
                      <b className="text-ink">{p.code}</b>
                      {p.total != null && ` · Bs ${p.total}`}
                      {p.paidAt ? (
                        <b className="text-green-600"> · pagado</b>
                      ) : (
                        ` · ${p.status}`
                      )}
                    </span>
                  ))}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {mensajes.map((m, i) => {
                  const mio = m.direction === "out";
                  return (
                    <div key={i} className={`mb-2.5 flex ${mio ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13.5px] ${
                          mio
                            ? m.fromBot
                              ? "bg-pinkSoft text-ink"
                              : "bg-ink text-surface"
                            : "bg-surface2 text-ink"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            mio && !m.fromBot ? "text-surface/60" : "text-faint"
                          }`}
                        >
                          {hora(m.createdAt)}
                          {mio && (m.fromBot ? " · bot" : " · vos")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={finRef} />
              </div>

              <div className="shrink-0 border-t border-line px-4 py-3">
                {detalle?.botActive && (
                  <p className="mb-2 text-[11.5px] text-faint">
                    El bot está atendiendo. Si escribís acá, el mensaje sale igual, pero conviene
                    tomar el control para que no respondan los dos.
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !enviando && enviar()}
                    placeholder="Escribí tu respuesta…"
                    className="flex-1 rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-pink"
                  />
                  <button
                    onClick={enviar}
                    disabled={enviando || !texto.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-pink px-4 py-2.5 text-[13px] font-semibold text-onAccent disabled:opacity-50"
                  >
                    {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Enviar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
