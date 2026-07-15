"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, Loader2, ShieldCheck, Store } from "lucide-react";
import { EASYPOS } from "@/lib/easypos";

/**
 * Pareo del navegador con el CRM de un negocio.
 *
 * Es la contraparte web de escanear el QR: el panel de Case emite un token por
 * dispositivo y, con él, este equipo queda asociado a UN negocio. Si el link
 * trae `?token=…` se parea solo (igual que la `PairingScreen` de Case en web);
 * si no, se pega el token a mano.
 *
 * El token se guarda en este navegador para poder volver al negocio sin tener
 * que parear de nuevo. No es una credencial de acceso al CRM: para entrar al
 * panel sigue haciendo falta el login del empleado.
 */

const LS_KEY = "easypos:pareos";

interface Pareo {
  slug: string;
  nombre: string;
  crm: string;
  token: string;
}

function leerPareos(): Pareo[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Pareo[]) : [];
  } catch {
    return [];
  }
}

function guardarPareo(p: Pareo): void {
  const otros = leerPareos().filter((x) => x.slug !== p.slug);
  localStorage.setItem(LS_KEY, JSON.stringify([p, ...otros].slice(0, 8)));
}

export function PairForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [pareando, setPareando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pareos, setPareos] = useState<Pareo[]>([]);
  // El auto-pareo del link tiene que correr UNA vez, no en cada render.
  const autoHecho = useRef(false);

  const parear = useCallback(
    async (t: string) => {
      const limpio = t.trim();
      if (!limpio) {
        setError("Pegá el token que te dio tu proveedor.");
        return;
      }
      setPareando(true);
      setError(null);
      try {
        const r = await fetch("/api/pair/verify", {
          headers: { "X-Device-Token": limpio },
          cache: "no-store",
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data.error ?? "No se pudo parear con el negocio.");
        }
        guardarPareo({
          slug: data.negocio.slug,
          nombre: data.negocio.nombre,
          crm: data.crm,
          token: limpio,
        });
        router.push(data.crm);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo parear.");
        setPareando(false);
      }
    },
    [router]
  );

  useEffect(() => {
    setPareos(leerPareos());
    const t = params.get("token")?.trim();
    if (t && !autoHecho.current) {
      autoHecho.current = true;
      setToken(t);
      void parear(t); // link de pareo del panel: no hace falta tocar nada
    }
  }, [params, parear]);

  return (
    <main className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-line bg-surface p-8 shadow-soft">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src={EASYPOS.logo}
              alt={EASYPOS.name}
              width={132}
              height={44}
              className="h-11 w-auto"
              priority
            />
            <h1 className="font-display text-2xl text-ink">Parear tu negocio</h1>
            <p className="text-[13px] leading-relaxed text-ink/60">
              Pegá el token que te entregó tu proveedor y este equipo queda
              conectado al CRM de tu negocio. En el celular es más simple: escaneá
              el QR con la app.
            </p>
          </div>

          <form
            className="mt-7 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void parear(token);
            }}
          >
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Token del negocio"
              autoFocus
              spellCheck={false}
              className="w-full rounded-2xl border border-line bg-bg px-4 py-3 font-mono text-[13px] text-ink outline-none transition-colors focus:border-ink/30"
            />

            {error && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-[12.5px] text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pareando}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-[14px] text-[13.5px] font-semibold tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: EASYPOS.yellow, color: EASYPOS.ink }}
            >
              {pareando ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Link2 size={17} />
              )}
              {pareando ? "Pareando…" : "Parear"}
            </button>
          </form>

          <p className="mt-5 flex items-start gap-2 text-[11.5px] leading-relaxed text-ink/45">
            <ShieldCheck size={14} className="mt-px shrink-0" />
            El pareo conecta el equipo con el negocio. Para entrar al CRM igual
            necesitás tu usuario y contraseña de empleado.
          </p>
        </div>

        {pareos.length > 0 && (
          <div className="mt-6">
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
              Negocios pareados en este equipo
            </p>
            <ul className="space-y-2">
              {pareos.map((p) => (
                <li key={p.slug}>
                  <a
                    href={p.crm}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] font-semibold text-ink shadow-soft transition-colors hover:border-ink/25"
                  >
                    <Store size={16} className="text-ink/40" />
                    {p.nombre}
                    <span className="ml-auto font-mono text-[11px] font-normal text-ink/35">
                      /n/{p.slug}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
