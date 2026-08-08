"use client";

// ============================================================
//  Panel de negocios de easy pos (`/panel`).
//
//  La herramienta del EQUIPO easy pos (no de un negocio): da de alta
//  negocios (base + admin listos), cambia estados (activo/suspendido/
//  baja), vincula dispositivos por QR, administra empleados y las
//  credenciales de cobro QR. Habla con /api/provision y /api/panel/*;
//  el registro vive en la central propia (`bo_epos_central`).
//
//  Identidad: negro + amarillo #FEBB03 (la marca easy pos), interior
//  oscuro con sidebar por secciones — Inicio, Negocios, Vinculación QR,
//  Cobros QR, Usuarios y Actividad.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { RUBROS, type RubroId } from "@/lib/rubros";

// ---------- Tipos que devuelve /api/provision ----------

interface NegocioRow {
  id: string;
  nombre: string;
  slug: string;
  db_name: string;
  estado: string;
  rubro: string | null;
  fechaAlta?: string;
  dispositivos?: number;
  ultimoUso?: string | null;
  nit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  propietario?: string | null;
  comisionQr?: number;
  cuentaQr?: string;
}

interface DeviceRow {
  id: string;
  label: string | null;
  habilitado: boolean;
  lastSeen: string | null;
  altaAt: string;
  modelo: string | null;
  plataforma: string | null;
  appVersion: string | null;
  ip?: string | null;
  tokenHint: string;
  // Solo en la vista global (listAllDevices):
  negocio?: string;
  slug?: string;
}

/** Estado del vínculo por QR (Baileys). Es uno por instalación, no por negocio. */
interface BaileysRow {
  status: string;
  connected: boolean;
  available?: boolean;
  qr: string | null;
  number?: string | null;
  error?: string | null;
}

/** Lo que el panel edita del bot; el resto sale de los valores por defecto. */
interface VendedorRow {
  botEnabled: boolean;
  botPersona: string;
}

// Un número de WhatsApp (Cloud API de Meta) atendiendo a este negocio.
interface WaNumeroRow {
  phoneNumberId: string;
  numero: string | null;
  etiqueta: string | null;
  activo: boolean;
  tokenPropio: boolean;
  fechaAlta?: string;
}

interface EmployeeRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
}

interface ActividadRow {
  usuario: string | null;
  accion: string;
  detalle: Record<string, unknown>;
  fecha: string;
  negocio?: string | null;
}

interface PanelUser {
  email: string;
  name: string;
}

// ---------- Llamadas ----------

async function api<T = Record<string, unknown>>(
  action: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch("/api/provision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j.error || "No se pudo completar la acción.");
  return j;
}

async function listBusinesses(): Promise<NegocioRow[]> {
  const res = await fetch("/api/provision");
  const j = (await res.json().catch(() => ({}))) as { businesses?: NegocioRow[]; error?: string };
  if (!res.ok) throw new Error(j.error || "No se pudo cargar la lista.");
  return j.businesses ?? [];
}

// ---------- Piezas de UI ----------

const ESTADOS: Record<string, { label: string; cls: string }> = {
  activo: { label: "Activo", cls: "bg-success/10 text-success" },
  prueba: { label: "Prueba", cls: "bg-gold/10 text-gold" },
  suspendido: { label: "Suspendido", cls: "bg-error/10 text-error" },
  baja: { label: "De baja", cls: "bg-line/70 text-faint" },
};

function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { label: estado, cls: "bg-line/70 text-ink2" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.cls}`}>
      {e.label}
    </span>
  );
}

function fecha(v?: string | null, conHora = false): string {
  if (!v) return "—";
  const d = new Date(v);
  const f = d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
  return conHora
    ? `${f} ${d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`
    : f;
}

// Piezas base del interior. Los colores salen de variables CSS (--pv-*) que
// definen el tema (claro/oscuro) y el acento; así todo el panel se retiñe solo.
const input =
  "w-full rounded-xl border border-[var(--pv-line)] bg-[var(--pv-input-bg)] px-3.5 py-2.5 text-sm text-[var(--pv-text)] outline-none placeholder:text-[var(--pv-faint)] focus:border-[var(--pv-acc)]";
const btnPrimary =
  "rounded-xl bg-[var(--pv-acc)] px-4 py-2.5 text-sm font-bold text-[var(--pv-on-acc)] shadow-[0_10px_24px_rgba(0,0,0,.18)] hover:bg-[var(--pv-acc-deep)] disabled:opacity-50";
const btnGhost =
  "rounded-xl border border-[var(--pv-line)] bg-[var(--pv-ghost-bg)] px-4 py-2 text-sm font-semibold text-[var(--pv-text2)] hover:border-[var(--pv-acc)] hover:text-[var(--pv-text)]";
const card =
  "rounded-2xl border border-[var(--pv-line)] bg-[var(--pv-surface)] p-5 shadow-[0_14px_34px_rgba(0,0,0,.18)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-ink2">{label}</span>
      {children}
    </label>
  );
}

/** Botón peligroso en dos pasos: primero pide confirmación inline. */
function ConfirmBtn({
  label,
  confirm,
  onDo,
  className,
}: {
  label: string;
  confirm: string;
  onDo: () => void;
  className?: string;
}) {
  const [arm, setArm] = useState(false);
  useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(false), 4000);
    return () => clearTimeout(t);
  }, [arm]);
  return arm ? (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="font-semibold text-error">{confirm}</span>
      <button className="rounded-lg bg-error px-2 py-1 font-bold text-white" onClick={() => { setArm(false); onDo(); }}>
        Sí
      </button>
      <button className="rounded-lg border border-line px-2 py-1 font-semibold text-ink2" onClick={() => setArm(false)}>
        No
      </button>
    </span>
  ) : (
    <button className={className ?? "text-xs font-semibold text-error hover:underline"} onClick={() => setArm(true)}>
      {label}
    </button>
  );
}

/** Tarjeta del QR de pareo: QR grande + código de 4 dígitos bien visible. */
function QrPareo({
  qr,
  negocio,
  onClose,
}: {
  qr: { qrImage: string; token: string; label: string; code?: string };
  negocio: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-6 rounded-2xl border border-[#FEBB03]/40 bg-[#FEBB03]/[.06] p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qr.qrImage}
        alt="QR de pareo"
        className="h-64 w-64 rounded-xl border border-line bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,.35)]"
      />
      <div className="min-w-[220px] flex-1 text-sm">
        <p className="text-base font-extrabold text-ink">Escaneá este QR desde la app easy pos</p>
        <p className="mt-1 text-ink2">
          Vincula «{qr.label}» a <b>{negocio}</b>. En el teléfono se escanea; en la PC se escribe el
          código de abajo.
        </p>

        {qr.code && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">
              O escribí este código
            </div>
            <div className="inline-flex gap-2">
              {qr.code.split("").map((d, i) => (
                <span
                  key={i}
                  className="grid h-14 w-11 place-items-center rounded-xl border border-[#FEBB03]/50 bg-[#141310] text-3xl font-extrabold tabular-nums text-[#FEBB03] shadow-inner"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="mt-1.5 text-xs text-faint">Vence en 30 minutos · de un solo uso.</div>
          </div>
        )}

        <button className={`${btnGhost} mt-4`} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

/** Selector de negocio compartido por las secciones QR/Cobros/Usuarios. */
function PickNegocio({
  negocios,
  value,
  onChange,
}: {
  negocios: NegocioRow[];
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <select className={`${input} max-w-sm`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Elegí un negocio…</option>
      {negocios.map((n) => (
        <option key={n.id} value={n.slug}>
          {n.nombre} — /n/{n.slug}
        </option>
      ))}
    </select>
  );
}

// ---------- Login ----------
// Puerta del equipo con identidad easy pos: fondo oscuro animado (tipografía
// fantasma + auras amarillas) y tarjeta glassmorphism con las esquinas de
// visor del logo. Con Google configurado (producción) el único camino es
// "Ingresar con Google" (@petroboxinc.com); sin configurar (desarrollo) cae
// al correo+contraseña de la central.

const OAUTH_ERRORES: Record<string, string> = {
  dominio: "Esa cuenta no es del equipo. Entrá con tu correo @petroboxinc.com.",
  inactivo: "Tu usuario del panel está desactivado. Hablá con el administrador.",
  email_no_verificado: "Google no verificó ese correo. Probá con otra cuenta.",
  sin_central: "Esta instalación no tiene central de negocios configurada.",
  no_config: "El login con Google no está configurado en el servidor.",
};

function PanelLogin({ onOk }: { onOk: (u: PanelUser) => void }) {
  const [cfg, setCfg] = useState<{ oauth: boolean; domain: string } | null>(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/panel/auth/config")
      .then(async (r) => setCfg(await r.json()))
      .catch(() => setCfg({ oauth: false, domain: "petroboxinc.com" }));
    // Si Google rebotó el intento, el motivo viene en la URL: se muestra y se limpia.
    const q = new URLSearchParams(window.location.search);
    const oe = q.get("oauth_error");
    if (oe) {
      setErr(OAUTH_ERRORES[oe] ?? "No se pudo entrar con Google. Probá de nuevo.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/panel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pass }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "No se pudo entrar.");
      onOk(j.user as PanelUser);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const domain = cfg?.domain ?? "petroboxinc.com";

  return (
    <main className="pl-login">
      <style>{PL_CSS}</style>

      {/* Fondo animado: tipografía fantasma "easy pos" que respira + auras doradas. */}
      <div className="pl-bg" aria-hidden="true">
        <i className="pl-orb pl-orb-a" />
        <i className="pl-orb pl-orb-b" />
        <span className="pl-ghost pl-ghost-easy">easy</span>
        <span className="pl-ghost pl-ghost-pos">pos</span>
        <div className="pl-grain" />
      </div>

      <div className="pl-card">
        {/* Esquinas de visor: el marco del logo de easy pos, llevado a la tarjeta. */}
        <i className="pl-corners" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-logo" src="/images/easypos.png" alt="easy pos" />
        <h1 className="pl-title">
          <em>easy</em> <b>pos</b>
        </h1>
        <p className="pl-sub">PANEL DE NEGOCIOS</p>

        {cfg === null ? (
          <p className="pl-hint">Cargando…</p>
        ) : cfg.oauth ? (
          <>
            <button
              className="pl-google"
              onClick={() => (window.location.href = "/api/panel/auth/google/start")}
            >
              <span className="pl-g">G</span> Ingresar con Google
            </button>
            <p className="pl-hint">
              Solo cuentas <b>@{domain}</b>
            </p>
          </>
        ) : (
          <form onSubmit={entrar} className="pl-form">
            <input
              className="pl-input"
              type="email"
              placeholder={`Correo @${domain}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
            />
            <input
              className="pl-input"
              type="password"
              placeholder="Contraseña"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
            <button className="pl-google" disabled={busy || !email || !pass}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
            <p className="pl-hint">
              Solo el equipo <b>@{domain}</b> · los negocios entran por su CRM
            </p>
          </form>
        )}

        {err && <p className="pl-error">{err}</p>}
      </div>
    </main>
  );
}

// El login no depende del tema claro del CRM: identidad easy pos fija — negro
// + amarillo #FEBB03, el wordmark del logo (easy en itálica, pos en negrita) y
// las esquinas de visor del logo como marco de la tarjeta.
const PL_CSS = `
.pl-login { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% -10%, #1c1503 0%, transparent 55%),
    radial-gradient(100% 100% at 50% 120%, #131007 0%, transparent 60%),
    linear-gradient(180deg, #0e0d0a, #0a0906 60%, #070604); }

.pl-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
/* Trama punteada de ticket: textura de papel de impresora, muy sutil. */
.pl-bg::after { content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(rgba(254,187,3,.05) 1px, transparent 1.4px);
  background-size: 26px 26px;
  -webkit-mask-image: radial-gradient(75% 75% at 50% 50%, transparent 30%, #000 100%);
  mask-image: radial-gradient(75% 75% at 50% 50%, transparent 30%, #000 100%); }
.pl-ghost { position: absolute; line-height: .8; user-select: none;
  color: transparent; -webkit-text-stroke: 1px rgba(254,187,3,.08);
  text-shadow: 0 0 70px rgba(254,187,3,.03); }
.pl-ghost-easy { top: 4%; left: -4%; font-family: var(--font-cormorant), Georgia, serif; font-style: italic;
  font-weight: 600; letter-spacing: -.02em;
  font-size: clamp(170px, 31vw, 420px); animation: plGhost 26s ease-in-out infinite; }
.pl-ghost-pos { bottom: -8%; right: -3%; font-family: var(--font-poppins), sans-serif; font-weight: 800;
  letter-spacing: -.04em; font-size: clamp(200px, 37vw, 520px);
  -webkit-text-stroke: 1px rgba(254,187,3,.065);
  animation: plGhost 31s ease-in-out infinite reverse; }
@keyframes plGhost {
  0%, 100% { transform: translate3d(0,0,0) rotate(0); }
  50%      { transform: translate3d(26px,-20px,0) rotate(-1.2deg); }
}
.pl-orb { position: absolute; border-radius: 50%; filter: blur(60px); }
.pl-orb-a { width: 46vmax; height: 46vmax; top: -18vmax; left: -12vmax;
  background: radial-gradient(circle, rgba(254,187,3,.15), transparent 70%); animation: plOrb 19s ease-in-out infinite; }
.pl-orb-b { width: 40vmax; height: 40vmax; bottom: -16vmax; right: -10vmax;
  background: radial-gradient(circle, rgba(224,161,0,.12), transparent 70%); animation: plOrb 23s ease-in-out infinite reverse; }
@keyframes plOrb {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50%      { transform: translate3d(3vmax,4vmax,0) scale(1.08); }
}
.pl-grain { position: absolute; inset: 0; opacity: .5; mix-blend-mode: overlay;
  background-image: radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px); background-size: 3px 3px; }

/* Tarjeta: vidrio oscuro de esquinas rectas — el marco lo ponen los visores. */
.pl-card { position: relative; z-index: 1; width: 100%; max-width: 400px; text-align: center;
  background: linear-gradient(170deg, rgba(255,255,255,.085), rgba(255,255,255,.025));
  -webkit-backdrop-filter: blur(26px) saturate(1.2); backdrop-filter: blur(26px) saturate(1.2);
  border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 46px 38px 36px;
  box-shadow: 0 40px 90px -28px rgba(0,0,0,.8), 0 0 0 1px rgba(254,187,3,.08),
    0 1px 0 rgba(255,255,255,.14) inset, 0 -30px 60px -42px rgba(254,187,3,.28) inset;
  animation: plCardIn .7s cubic-bezier(.2,.7,.2,1) both; }
@keyframes plCardIn { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: none; } }

/* Las 4 esquinas de visor del logo, alrededor de la tarjeta. */
.pl-card::before, .pl-card::after, .pl-corners::before, .pl-corners::after {
  content: ''; position: absolute; width: 30px; height: 30px; border: 3px solid #FEBB03;
  filter: drop-shadow(0 0 8px rgba(254,187,3,.45)); animation: plCorner 3.8s ease-in-out 1s infinite; }
.pl-card::before  { top: -13px; left: -13px; border-right: 0; border-bottom: 0; border-radius: 8px 0 0 0; }
.pl-card::after   { top: -13px; right: -13px; border-left: 0; border-bottom: 0; border-radius: 0 8px 0 0; }
.pl-corners::before { bottom: -13px; left: -13px; border-right: 0; border-top: 0; border-radius: 0 0 0 8px; }
.pl-corners::after  { bottom: -13px; right: -13px; border-left: 0; border-top: 0; border-radius: 0 0 8px 0; }
@keyframes plCorner {
  0%, 100% { filter: drop-shadow(0 0 5px rgba(254,187,3,.30)); }
  50%      { filter: drop-shadow(0 0 12px rgba(254,187,3,.65)); }
}

.pl-logo { width: 118px; height: 118px; margin: 0 auto 18px; display: block; border-radius: 26px; object-fit: cover;
  box-shadow: 0 16px 42px rgba(254,187,3,.32);
  animation: plLogoIn .7s cubic-bezier(.2,.7,.2,1) both, plLogoGlow 3.8s ease-in-out 1s infinite; }
@keyframes plLogoIn { from { opacity: 0; transform: scale(.78) translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes plLogoGlow {
  0%, 100% { box-shadow: 0 14px 36px rgba(254,187,3,.28); }
  50%      { box-shadow: 0 20px 50px rgba(254,187,3,.5); }
}

/* Wordmark como en el logo: "easy" itálica fina clara, "pos" negrita amarilla. */
.pl-title { font-size: 40px; line-height: 1; letter-spacing: -.5px; }
.pl-title em { font-family: var(--font-cormorant), Georgia, serif; font-style: italic; font-weight: 600;
  color: #F7F1E3; }
.pl-title b { font-family: var(--font-poppins), sans-serif; font-weight: 800; letter-spacing: -1px;
  background: linear-gradient(180deg, #FFD34D 0%, #FEBB03 55%, #E0A100 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  filter: drop-shadow(0 2px 14px rgba(254,187,3,.25)); }
.pl-sub { font-size: 11px; font-weight: 700; letter-spacing: 4px; margin-top: 10px; color: rgba(255,255,255,.45);
  font-family: var(--font-poppins), sans-serif; }

.pl-google { position: relative; display: flex; align-items: center; justify-content: center; gap: 11px;
  width: 100%; margin-top: 28px; padding: 15px; border-radius: 14px; cursor: pointer;
  border: 1px solid rgba(255,232,170,.5);
  background: linear-gradient(180deg, #FFD34D 0%, #FEBB03 52%, #E0A100 100%);
  color: #17120F; font-weight: 800; font-size: 14.5px; letter-spacing: .1px;
  font-family: var(--font-poppins), sans-serif;
  box-shadow: 0 12px 30px rgba(254,187,3,.38), 0 1px 0 rgba(255,255,255,.55) inset;
  transition: transform .15s ease, box-shadow .15s ease; }
.pl-google:hover:not([disabled]) { transform: translateY(-1.5px);
  box-shadow: 0 18px 42px rgba(254,187,3,.55), 0 1px 0 rgba(255,255,255,.65) inset; }
.pl-google:active:not([disabled]) { transform: translateY(0); }
.pl-google[disabled] { opacity: .5; cursor: not-allowed; }
.pl-g { width: 24px; height: 24px; border-radius: 50%; background: #17120F; color: #FEBB03; font-weight: 800;
  font-size: 13px; font-family: Arial, sans-serif; display: grid; place-items: center; flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,.35); }

.pl-hint { font-size: 12.5px; margin-top: 20px; color: rgba(255,255,255,.45);
  font-family: var(--font-poppins), sans-serif; }
.pl-hint b { color: #FEBB03; font-weight: 600; }
.pl-error { font-size: 12.5px; color: #ff6b6b; margin-top: 14px; background: rgba(255,80,80,.12);
  padding: 9px 12px; border-radius: 10px; }

.pl-form { display: flex; flex-direction: column; gap: 10px; margin-top: 28px; }
.pl-form .pl-google { margin-top: 6px; }
.pl-form .pl-hint { margin-top: 10px; }
.pl-input { width: 100%; padding: 13px 14px; border-radius: 12px; font-size: 14px; outline: none;
  border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color: #F7F1E3;
  transition: border-color .15s ease; }
.pl-input::placeholder { color: rgba(255,255,255,.32); }
.pl-input:focus { border-color: rgba(254,187,3,.65); }

@media (prefers-reduced-motion: reduce) {
  .pl-logo, .pl-ghost, .pl-orb, .pl-card,
  .pl-card::before, .pl-card::after, .pl-corners::before, .pl-corners::after { animation: none; }
}
`;

// ---------- Alta de negocio ----------

function AltaNegocio({ onDone, onCancel }: { onDone: (slug: string) => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [rubro, setRubro] = useState<RubroId>("repuestos");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const autoSlug = (v: string) =>
    v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("createBusiness", { nombre, slug, rubro, adminName, adminEmail, adminPass });
      onDone(slug);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={crear} className={`${card} space-y-4`}>
      <h2 className="text-lg font-extrabold text-ink">Nuevo negocio</h2>
      <p className="text-sm text-ink2">
        Crea la base del negocio con su catálogo vacío y el usuario Administrador con el que el
        dueño entra a su CRM (<code className="text-xs">/n/&lt;slug&gt;</code>) y a la app.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del negocio">
          <input
            className={input}
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (!slugTocado) setSlug(autoSlug(e.target.value));
            }}
            autoFocus
          />
        </Field>
        <Field label="Slug (la URL: /n/<slug>)">
          <input
            className={input}
            value={slug}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(autoSlug(e.target.value));
            }}
          />
        </Field>
        <Field label="Rubro">
          <select className={input} value={rubro} onChange={(e) => setRubro(e.target.value as RubroId)}>
            {Object.entries(RUBROS).map(([id, r]) => (
              <option key={id} value={id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="border-t border-line pt-4">
        <h3 className="mb-3 text-sm font-bold text-ink">Administrador del negocio</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nombre">
            <input className={input} value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </Field>
          <Field label="Correo (su usuario)">
            <input className={input} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña (6+)">
            <input className={input} type="text" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
          </Field>
        </div>
      </div>
      {err && <p className="text-sm font-semibold text-error">{err}</p>}
      <div className="flex gap-3">
        <button className={btnPrimary} disabled={busy || !nombre || !slug || !adminEmail || adminPass.length < 6}>
          {busy ? "Creando…" : "Crear negocio"}
        </button>
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ---------- Ficha de un negocio ----------

function FichaNegocio({ slug, onBack, onChanged }: { slug: string; onBack: () => void; onChanged: () => void }) {
  const [neg, setNeg] = useState<NegocioRow | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [emps, setEmps] = useState<EmployeeRow[]>([]);
  const [acts, setActs] = useState<ActividadRow[]>([]);
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState("");
  const [qr, setQr] = useState<{ qrImage: string; token: string; label: string; code?: string } | null>(null);
  const [devLabel, setDevLabel] = useState("");
  const [nuevoEmp, setNuevoEmp] = useState({ name: "", email: "", pass: "", role: "Vendedora" });
  const [edit, setEdit] = useState<Partial<NegocioRow>>({});
  const [busy, setBusy] = useState("");
  const [waNums, setWaNums] = useState<WaNumeroRow[]>([]);
  const [nuevoWa, setNuevoWa] = useState({ phoneNumberId: "", numero: "", etiqueta: "" });
  const [bl, setBl] = useState<BaileysRow | null>(null);
  // El formulario de Meta arranca oculto mientras no haya alta oficial: si va
  // primero, parece que el phone_number_id es obligatorio para empezar, y no lo
  // es — con el QR el bot atiende hoy.
  const [mostrarMeta, setMostrarMeta] = useState(false);
  const [vend, setVend] = useState<VendedorRow>({ botEnabled: false, botPersona: "" });

  const cargar = useCallback(async () => {
    try {
      const [n, d, e, a, w, v] = await Promise.all([
        api<{ business: NegocioRow }>("getNegocio", { slug }),
        api<{ devices: DeviceRow[] }>("listDevices", { slug }),
        api<{ employees: EmployeeRow[] }>("listEmployees", { slug }),
        api<{ actividad: ActividadRow[] }>("listActividad", { slug }),
        api<{ numeros: WaNumeroRow[] }>("listWaNumeros", { slug }),
        api<{ vendedor: Partial<VendedorRow> | null }>("getVendedor", { slug }),
      ]);
      setVend({
        botEnabled: !!v.vendedor?.botEnabled,
        botPersona: v.vendedor?.botPersona ?? "",
      });
      // El estado del QR se pide aparte: que falle no debe romper la ficha.
      api<BaileysRow>("baileysEstado", { slug }).then(setBl).catch(() => {});
      setNeg(n.business);
      setEdit(n.business);
      setDevices(d.devices);
      setEmps(e.employees);
      setActs(a.actividad);
      setWaNums(w.numeros);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [slug]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El QR llega unos segundos DESPUÉS de pedirlo y además rota cada ~20 s. Sin
  // este refresco, el panel se quedaba en "generando" o mostraba un QR vencido
  // que el teléfono ya no acepta.
  const esperandoQr = !!bl && !bl.connected && bl.available !== false;
  useEffect(() => {
    if (!esperandoQr) return;
    const t = setInterval(() => {
      api<BaileysRow>("baileysEstado", { slug }).then(setBl).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [esperandoQr]);

  const accion = async (nombre: string, fn: () => Promise<unknown>, exito?: string) => {
    setBusy(nombre);
    setErr("");
    setAviso("");
    try {
      await fn();
      await cargar();
      onChanged();
      if (exito) setAviso(exito);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (!neg)
    return (
      <div className={card}>
        <button className={btnGhost} onClick={onBack}>← Volver</button>
        <p className="mt-4 text-sm text-ink2">{err || "Cargando…"}</p>
      </div>
    );

  const crm = `/n/${neg.slug}`;
  const sinMeta = waNums.filter((w) => w.activo).length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button className={btnGhost} onClick={onBack}>← Volver</button>
          <h2 className="text-xl font-extrabold text-ink">{neg.nombre}</h2>
          <EstadoBadge estado={neg.estado} />
        </div>
        <a href={crm} target="_blank" rel="noreferrer" className={btnGhost}>
          Abrir su CRM ({crm}) ↗
        </a>
      </div>

      {err && <p className="rounded-xl bg-error/10 px-4 py-2 text-sm font-semibold text-error">{err}</p>}
      {aviso && <p className="rounded-xl bg-success/10 px-4 py-2 text-sm font-semibold text-success">{aviso}</p>}

      {/* Estado */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Estado</h3>
        <div className="flex flex-wrap items-center gap-2">
          {neg.estado !== "activo" && (
            <button
              className={btnPrimary}
              disabled={!!busy}
              onClick={() => accion("estado", () => api("setEstado", { slug, estado: "activo" }), "Negocio activado.")}
            >
              Activar
            </button>
          )}
          {neg.estado !== "suspendido" && neg.estado !== "baja" && (
            <ConfirmBtn
              label="Suspender"
              confirm="¿Suspender? Deja de atender web y app."
              className={btnGhost}
              onDo={() => accion("estado", () => api("setEstado", { slug, estado: "suspendido" }), "Negocio suspendido.")}
            />
          )}
          {neg.estado !== "baja" && (
            <ConfirmBtn
              label="Dar de baja"
              confirm="¿Dar de baja? Es el fin del servicio para este negocio."
              className={btnGhost}
              onDo={() => accion("estado", () => api("setEstado", { slug, estado: "baja" }), "Negocio dado de baja.")}
            />
          )}
          <span className="text-xs text-faint">
            Suspendido o de baja: ni la web ni la app del negocio responden (tarda ≤30 s en aplicar).
          </span>
        </div>
      </section>

      {/* Accesos: lo que se le entrega al negocio cuando se lo activa */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Accesos del negocio</h3>
        <ul className="grid gap-3 text-sm lg:grid-cols-2">
          {[
            { label: "CRM web", href: crm + "/admin", txt: `easypos.easypaybo.com${crm}/admin` },
            { label: "Tienda", href: crm, txt: `easypos.easypaybo.com${crm}` },
            { label: "App del teléfono", href: "/app", txt: "easypos.easypaybo.com/app" },
            { label: "Programa de PC", href: "/pc", txt: "easypos.easypaybo.com/pc" },
          ].map((a) => (
            <li key={a.label} className="min-w-0">
              <div className="mb-0.5 text-xs text-faint">{a.label}</div>
              <a
                href={a.href}
                target="_blank"
                rel="noreferrer"
                className="block break-all font-semibold text-[#FEBB03] hover:underline"
              >
                {a.txt}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-faint">
          Entran con el correo y la contraseña del administrador que definiste al crear el negocio
          (o los usuarios que agregues en la sección Usuarios). El teléfono y la PC se vinculan
          primero con el QR/código de la sección Vinculación QR.
        </p>
      </section>

      {/* Datos */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Datos del negocio</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nombre">
            <input className={input} value={edit.nombre ?? ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
          </Field>
          <Field label="Rubro">
            <select className={input} value={edit.rubro ?? "repuestos"} onChange={(e) => setEdit({ ...edit, rubro: e.target.value })}>
              {Object.entries(RUBROS).map(([id, r]) => (
                <option key={id} value={id}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="NIT">
            <input className={input} value={edit.nit ?? ""} onChange={(e) => setEdit({ ...edit, nit: e.target.value })} />
          </Field>
          <Field label="Teléfono">
            <input className={input} value={edit.telefono ?? ""} onChange={(e) => setEdit({ ...edit, telefono: e.target.value })} />
          </Field>
          <Field label="Correo">
            <input className={input} value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
          </Field>
          <Field label="Ciudad">
            <input className={input} value={edit.ciudad ?? ""} onChange={(e) => setEdit({ ...edit, ciudad: e.target.value })} />
          </Field>
          <div className="sm:col-span-3">
            <Field label="Dirección">
              <input className={input} value={edit.direccion ?? ""} onChange={(e) => setEdit({ ...edit, direccion: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            className={btnPrimary}
            disabled={!!busy}
            onClick={() =>
              accion(
                "datos",
                () =>
                  api("updateNegocio", {
                    slug,
                    nombre: edit.nombre,
                    rubro: edit.rubro,
                    nit: edit.nit ?? "",
                    telefono: edit.telefono ?? "",
                    email: edit.email ?? "",
                    direccion: edit.direccion ?? "",
                    ciudad: edit.ciudad ?? "",
                  }),
                "Datos guardados."
              )
            }
          >
            Guardar datos
          </button>
          <span className="text-xs text-faint">
            Base: <code>{neg.db_name}</code> · Alta: {fecha(neg.fechaAlta)}
          </span>
        </div>
      </section>

      {/* Cobro con QR: comisión + cuenta */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Cobro con QR</h3>
        <div className="grid items-end gap-4 sm:grid-cols-3">
          <Field label="Comisión (% sobre lo cobrado por QR)">
            <input
              className={input}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={edit.comisionQr ?? 0}
              onChange={(e) => setEdit({ ...edit, comisionQr: Number(e.target.value) })}
            />
          </Field>
          <Field label="¿A qué cuenta caen los pagos?">
            <select
              className={input}
              value={edit.cuentaQr ?? "empresa"}
              onChange={(e) => setEdit({ ...edit, cuentaQr: e.target.value })}
            >
              <option value="empresa">Cuenta de la empresa (se paga el neto al comercio)</option>
              <option value="comercio">Cuenta del comercio (se le cobra la comisión)</option>
            </select>
          </Field>
          <button
            className={btnPrimary}
            disabled={!!busy}
            onClick={() =>
              accion(
                "cobroqr",
                () => api("updateNegocio", { slug, comisionQr: edit.comisionQr ?? 0, cuentaQr: edit.cuentaQr ?? "empresa" }),
                "Config de cobro QR guardada."
              )
            }
          >
            Guardar cobro QR
          </button>
        </div>
        <p className="mt-3 text-xs text-faint">
          La comisión se calcula sobre lo recaudado por QR. Base de la liquidación en Cobros QR / Comisiones.
        </p>
      </section>

      {/* WhatsApp del Vendedor 24/7 (Cloud API de Meta) */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">
          WhatsApp del Vendedor 24/7
        </h3>

        {/* El QR va PRIMERO: es el camino que sirve hoy. Con el formulario de
            Meta arriba parecía que el phone_number_id era obligatorio para
            arrancar, y no lo es. */}
        {sinMeta && (
          <div className="rounded-xl border border-line bg-surface2/40 p-4">
            <h4 className="text-[13px] font-bold text-ink">
              Vincular el WhatsApp por QR
            </h4>
            <p className="mt-1 text-xs text-ink2">
              Se vincula un número normal, como un dispositivo más de WhatsApp. Anda hoy mismo, sin
              esperar a Meta, pero <b>no es el canal oficial</b>: usá una línea dedicada al bot,
              porque existe riesgo de que la bloqueen.
            </p>

            {bl?.available === false ? (
              <p className="mt-3 text-xs text-error">{bl.error}</p>
            ) : bl?.connected ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-success">
                  ✓ Vinculado{bl.number ? ` · +${bl.number}` : ""}
                </span>
                <ConfirmBtn
                  label="Desvincular"
                  confirm="¿Desvincular? El bot deja de recibir por ese número."
                  onDo={() =>
                    accion(
                      "wa",
                      async () => setBl(await api<BaileysRow>("baileysLogout", { slug })),
                      "WhatsApp desvinculado."
                    )
                  }
                />
              </div>
            ) : bl?.qr ? (
              <div className="mt-3 flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bl.qr} alt="QR para vincular WhatsApp" className="h-56 w-56 rounded-xl bg-white p-2" />
                <p className="text-xs text-ink2">
                  En el teléfono: WhatsApp → Dispositivos vinculados → Vincular un dispositivo.
                </p>
                <button className={btnGhost} onClick={() => api<BaileysRow>("baileysEstado", { slug }).then(setBl)}>
                  Ya lo escaneé
                </button>
              </div>
            ) : (
              <>
              {bl?.status === "connecting" && (
                <p className="mt-3 text-xs text-ink2">Generando el QR…</p>
              )}
              <button
                className={`${btnPrimary} mt-3`}
                disabled={!!busy}
                onClick={() =>
                  accion("wa", async () => {
                    setBl(await api<BaileysRow>("baileysStart", { slug }));
                  }, "Generando el QR… aparece en unos segundos.")
                }
              >
                {bl?.status === "connecting" ? "Generando…" : "Generar QR"}
              </button>
              </>
            )}
          </div>
        )}

        {sinMeta && !mostrarMeta && (
          <button
            className="mt-4 text-xs font-semibold text-ink2 underline hover:text-ink"
            onClick={() => setMostrarMeta(true)}
          >
            Ya tengo el alta oficial de Meta →
          </button>
        )}

        {(!sinMeta || mostrarMeta) && (
        <div className="mb-4 mt-4 grid items-end gap-3 sm:grid-cols-4">
          <Field label="ID del número (Meta)">
            <input
              className={input}
              placeholder="123456789012345"
              value={nuevoWa.phoneNumberId}
              onChange={(e) => setNuevoWa({ ...nuevoWa, phoneNumberId: e.target.value })}
            />
          </Field>
          <Field label="Número visible">
            <input
              className={input}
              placeholder="+591 79874920"
              value={nuevoWa.numero}
              onChange={(e) => setNuevoWa({ ...nuevoWa, numero: e.target.value })}
            />
          </Field>
          <Field label="Etiqueta">
            <input
              className={input}
              placeholder="Ventas, Pedidos…"
              value={nuevoWa.etiqueta}
              onChange={(e) => setNuevoWa({ ...nuevoWa, etiqueta: e.target.value })}
            />
          </Field>
          <button
            className={btnPrimary}
            disabled={!!busy || !nuevoWa.phoneNumberId.trim()}
            onClick={() =>
              accion(
                "wa",
                async () => {
                  await api("saveWaNumero", { slug, ...nuevoWa });
                  setNuevoWa({ phoneNumberId: "", numero: "", etiqueta: "" });
                },
                "Número asociado. Empieza a atender en ≤30 s."
              )
            }
          >
            Asociar número
          </button>
        </div>
        )}

        {waNums.length === 0 ? null : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
                  <th className="py-2 pr-3">Número</th>
                  <th className="py-2 pr-3">Etiqueta</th>
                  <th className="py-2 pr-3">ID de Meta</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {waNums.map((w) => (
                  <tr key={w.phoneNumberId} className="border-b border-line/60">
                    <td className="py-2.5 pr-3 font-semibold text-ink">{w.numero || "—"}</td>
                    <td className="py-2.5 pr-3 text-ink2">{w.etiqueta || "—"}</td>
                    <td className="py-2.5 pr-3 text-ink2">
                      <code className="text-xs">{w.phoneNumberId}</code>
                      {w.tokenPropio && (
                        <span className="ml-2 text-xs text-faint">token propio</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-bold ${w.activo ? "text-success" : "text-error"}`}>
                        {w.activo ? "Atendiendo" : "Pausado"}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-3">
                        <button
                          className="text-xs font-semibold text-ink2 hover:text-ink hover:underline"
                          disabled={!!busy}
                          onClick={() =>
                            accion(
                              "wa",
                              () =>
                                api("saveWaNumero", {
                                  slug,
                                  phoneNumberId: w.phoneNumberId,
                                  numero: w.numero ?? "",
                                  etiqueta: w.etiqueta ?? "",
                                  activo: !w.activo,
                                }),
                              w.activo ? "Número pausado." : "Número atendiendo."
                            )
                          }
                        >
                          {w.activo ? "Pausar" : "Reactivar"}
                        </button>
                        <ConfirmBtn
                          label="Quitar"
                          confirm="¿Quitar el número? Deja de atender este WhatsApp."
                          className="text-xs font-semibold text-error hover:underline"
                          onDo={() =>
                            accion(
                              "wa",
                              () => api("deleteWaNumero", { phoneNumberId: w.phoneNumberId }),
                              "Número quitado."
                            )
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(!sinMeta || mostrarMeta) && (
          <p className="mt-3 text-xs text-faint">
            El <b>ID del número</b> sale del panel de Meta (WhatsApp → Configuración de la API), y
            no es el número: es el <code>phone_number_id</code>. Es lo que llega en cada mensaje y lo
            que permite saber a qué negocio contestar. Un negocio puede tener uno o dos.
          </p>
        )}

      </section>

      {/* El bot: encendido y personalidad */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">El bot</h3>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={vend.botEnabled}
            onChange={() => setVend({ ...vend, botEnabled: !vend.botEnabled })}
            className="h-5 w-5 accent-[#FEBB03]"
          />
          <span className="text-sm text-ink">
            Vendedor 24/7 encendido
            <span className="ml-2 text-xs text-faint">
              (apagado no contesta, aunque el WhatsApp esté vinculado)
            </span>
          </span>
        </label>

        <div className="mt-4">
          <Field label="Personalidad y reglas del vendedor">
            <textarea
              rows={6}
              className={input}
              value={vend.botPersona}
              onChange={(e) => setVend({ ...vend, botPersona: e.target.value })}
              placeholder="Vacío = usa la personalidad del rubro. Escribí cómo tiene que hablar, qué vende y qué NO puede prometer."
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className={btnPrimary}
            disabled={!!busy}
            onClick={() =>
              accion(
                "vend",
                () => api("setVendedor", { slug, ...vend }),
                "Configuración del bot guardada."
              )
            }
          >
            Guardar el bot
          </button>
          <span className="text-xs text-faint">
            La personalidad le gana a la del rubro. Para productos de salud, dejá escrito que no dé
            consejos médicos ni prometa resultados.
          </span>
        </div>
      </section>

      {/* Dispositivos */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Dispositivos vinculados</h3>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="Etiqueta del nuevo dispositivo">
            <input className={input} placeholder="Caja 1, celular de la dueña…" value={devLabel} onChange={(e) => setDevLabel(e.target.value)} />
          </Field>
          <button
            className={btnPrimary}
            disabled={!!busy}
            onClick={() =>
              accion("qr", async () => {
                const r = await api<{ qrImage: string; token: string; label: string; code?: string }>("createDevice", {
                  slug,
                  label: devLabel || "Dispositivo",
                });
                setQr(r);
                setDevLabel("");
              })
            }
          >
            Vincular dispositivo (QR)
          </button>
        </div>

        {qr && <QrPareo qr={qr} negocio={neg.nombre} onClose={() => setQr(null)} />}

        {devices.length === 0 ? (
          <p className="text-sm text-ink2">Sin dispositivos todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
                  <th className="py-2 pr-3">Etiqueta</th>
                  <th className="py-2 pr-3">Equipo</th>
                  <th className="py-2 pr-3">Último uso</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-b border-line/60">
                    <td className="py-2.5 pr-3 font-semibold text-ink">
                      {d.label || "—"}
                      <span className="ml-2 text-xs font-normal text-faint">{d.tokenHint}…</span>
                    </td>
                    <td className="py-2.5 pr-3 text-ink2">
                      {[d.modelo, d.plataforma, d.appVersion && `v${d.appVersion}`].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-ink2">{fecha(d.lastSeen, true)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-bold ${d.habilitado ? "text-success" : "text-error"}`}>
                        {d.habilitado ? "Habilitado" : "Bloqueado"}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-3">
                        <button
                          className="text-xs font-semibold text-ink2 hover:text-ink hover:underline"
                          disabled={!!busy}
                          onClick={() =>
                            accion("dev", () => api("blockDevice", { deviceId: d.id, blocked: d.habilitado }))
                          }
                        >
                          {d.habilitado ? "Bloquear" : "Habilitar"}
                        </button>
                        <ConfirmBtn
                          label="Eliminar"
                          confirm="¿Eliminar el pareo?"
                          onDo={() => accion("dev", () => api("deleteDevice", { deviceId: d.id }))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Usuarios del negocio */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Usuarios del negocio</h3>
        {emps.length === 0 ? (
          <p className="text-sm text-ink2">Sin usuarios.</p>
        ) : (
          <ul className="mb-4 space-y-1.5">
            {emps.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-ink">{e.name}</span>
                <span className="text-ink2">{e.email || "sin correo"}</span>
                <select
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                  value={e.role}
                  disabled={!!busy}
                  onChange={(ev) => accion("rol", () => api("setRole", { slug, employeeId: e.id, role: ev.target.value }))}
                >
                  {["Administrador", "Vendedora", "Repartidor"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                {!e.active && <span className="text-xs font-bold text-error">inactivo</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="grid items-end gap-3 sm:grid-cols-4">
          <Field label="Nombre">
            <input className={input} value={nuevoEmp.name} onChange={(e) => setNuevoEmp({ ...nuevoEmp, name: e.target.value })} />
          </Field>
          <Field label="Correo">
            <input className={input} value={nuevoEmp.email} onChange={(e) => setNuevoEmp({ ...nuevoEmp, email: e.target.value })} />
          </Field>
          <Field label="Contraseña (6+)">
            <input className={input} value={nuevoEmp.pass} onChange={(e) => setNuevoEmp({ ...nuevoEmp, pass: e.target.value })} />
          </Field>
          <button
            className={btnPrimary}
            disabled={!!busy || !nuevoEmp.name || !nuevoEmp.email || nuevoEmp.pass.length < 6}
            onClick={() =>
              accion(
                "emp",
                () => api("createEmployee", { slug, ...nuevoEmp }),
                "Usuario creado."
              ).then(() => setNuevoEmp({ name: "", email: "", pass: "", role: "Vendedora" }))
            }
          >
            Crear usuario
          </button>
        </div>
      </section>

      {/* Actividad */}
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Actividad reciente</h3>
        {acts.length === 0 ? (
          <p className="text-sm text-ink2">Sin actividad registrada.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {acts.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs text-faint">{fecha(a.fecha, true)}</span>
                <span className="font-semibold text-ink">{a.accion}</span>
                <span className="text-ink2">{a.usuario}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- Secciones del panel ----------

/** Inicio: resumen del parque de negocios y lo último que pasó. */
function InicioSection({
  negocios,
  onOpen,
}: {
  negocios: NegocioRow[];
  onOpen: (slug: string) => void;
}) {
  const [acts, setActs] = useState<ActividadRow[]>([]);
  useEffect(() => {
    api<{ actividad: ActividadRow[] }>("listActividad", {})
      .then((r) => setActs(r.actividad.slice(0, 9)))
      .catch(() => {});
  }, []);

  const kpis = useMemo(() => {
    const por = (e: string) => negocios.filter((n) => n.estado === e).length;
    return [
      { n: por("activo"), l: "Negocios activos" },
      { n: por("prueba"), l: "En prueba" },
      { n: por("suspendido") + por("baja"), l: "Suspendidos / baja" },
      { n: negocios.reduce((s, x) => s + (x.dispositivos ?? 0), 0), l: "Dispositivos vinculados" },
    ];
  }, [negocios]);

  const ultimos = useMemo(
    () => [...negocios].sort((a, b) => (b.fechaAlta ?? "").localeCompare(a.fechaAlta ?? "")).slice(0, 6),
    [negocios]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.l} className={`${card} pv-kpi`}>
            <div className="pv-kpi-n">{k.n}</div>
            <div className="pv-kpi-l">{k.l}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Últimos negocios</h3>
          {ultimos.length === 0 ? (
            <p className="text-sm text-ink2">Todavía no hay negocios.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {ultimos.map((n) => (
                <li
                  key={n.id}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-2 py-2.5 transition hover:bg-pinkHero"
                  onClick={() => onOpen(n.slug)}
                >
                  <div>
                    <div className="text-sm font-bold text-ink">{n.nombre}</div>
                    <div className="text-xs text-faint">/n/{n.slug} · {n.dispositivos ?? 0} disp.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-faint">{fecha(n.ultimoUso, true)}</span>
                    <EstadoBadge estado={n.estado} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Actividad reciente</h3>
          {acts.length === 0 ? (
            <p className="text-sm text-ink2">Sin actividad registrada.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {acts.map((a, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-faint">{fecha(a.fecha, true)}</span>
                  <span className="font-semibold text-[#FEBB03]">{a.accion}</span>
                  <span className="text-ink2">{a.usuario}</span>
                  {a.negocio && <span className="text-xs text-faint">· {a.negocio}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Vinculación QR: generar el QR de pareo y ver el parque completo de dispositivos. */
function QrSection({ negocios }: { negocios: NegocioRow[] }) {
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [qr, setQr] = useState<{ qrImage: string; token: string; label: string; code?: string } | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(() => {
    api<{ devices: DeviceRow[] }>("listAllDevices")
      .then((r) => setDevices(r.devices))
      .catch((e) => setErr((e as Error).message));
  }, []);
  useEffect(cargar, [cargar]);

  const accion = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      cargar();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const negocioDe = (slug: string) => negocios.find((n) => n.slug === slug)?.nombre ?? slug;

  return (
    <div className="space-y-5">
      <section className={card}>
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-faint">Vincular un dispositivo</h3>
        <p className="mb-4 text-sm text-ink2">
          Generá el QR y escanealo desde la app easy pos del cliente: el equipo queda pareado al
          negocio. El QR es de un solo uso visual — si se pierde, bloqueá el dispositivo y generá otro.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Negocio">
            <PickNegocio negocios={negocios} value={slug} onChange={setSlug} />
          </Field>
          <Field label="Etiqueta">
            <input
              className={input}
              placeholder="Caja 1, celular de la dueña…"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <button
            className={btnPrimary}
            disabled={busy || !slug}
            onClick={() =>
              accion(async () => {
                const r = await api<{ qrImage: string; token: string; label: string; code?: string }>(
                  "createDevice",
                  { slug, label: label || "Dispositivo" }
                );
                setQr(r);
                setLabel("");
              })
            }
          >
            Generar QR de pareo
          </button>
        </div>

        {qr && <QrPareo qr={qr} negocio={negocioDe(slug)} onClose={() => setQr(null)} />}
      </section>

      <section className={`${card} overflow-x-auto`}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">
          Dispositivos vinculados · todos los negocios
        </h3>
        {err && <p className="mb-3 rounded-xl bg-error/10 px-4 py-2 text-sm font-semibold text-error">{err}</p>}
        {devices.length === 0 ? (
          <p className="text-sm text-ink2">Sin dispositivos todavía.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
                <th className="py-2 pr-3">Negocio</th>
                <th className="py-2 pr-3">Etiqueta</th>
                <th className="py-2 pr-3">Equipo</th>
                <th className="py-2 pr-3">Último uso</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-line/60">
                  <td className="py-2.5 pr-3 font-semibold text-ink">{d.negocio}</td>
                  <td className="py-2.5 pr-3 text-ink2">
                    {d.label || "—"}
                    <span className="ml-2 text-xs text-faint">{d.tokenHint}…</span>
                  </td>
                  <td className="py-2.5 pr-3 text-ink2">
                    {[d.modelo, d.plataforma, d.appVersion && `v${d.appVersion}`].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-ink2">{fecha(d.lastSeen, true)}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`text-xs font-bold ${d.habilitado ? "text-success" : "text-error"}`}>
                      {d.habilitado ? "Habilitado" : "Bloqueado"}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-3">
                      <button
                        className="text-xs font-semibold text-ink2 hover:text-ink hover:underline"
                        disabled={busy}
                        onClick={() => accion(() => api("blockDevice", { deviceId: d.id, blocked: d.habilitado }))}
                      >
                        {d.habilitado ? "Bloquear" : "Habilitar"}
                      </button>
                      <ConfirmBtn
                        label="Eliminar"
                        confirm="¿Eliminar el pareo?"
                        onDo={() => accion(() => api("deleteDevice", { deviceId: d.id }))}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const bsF = (n: number) =>
  "Bs " + (Number(n) || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ReporteQrRow {
  nombre: string;
  slug: string;
  estado: string;
  ventas: number;
  total: number;
  qrVentas: number;
  qrTotal: number;
  error?: string;
}

/** Cobros QR: control de uso e ingresos del QR de cobro de la empresa. */
function CobrosSection() {
  const isoLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hoy = isoLocal(new Date());
  const [desde, setDesde] = useState(hoy.slice(0, 8) + "01"); // este mes
  const [hasta, setHasta] = useState(hoy);
  const [filas, setFilas] = useState<ReporteQrRow[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errRep, setErrRep] = useState("");

  const cargarReporte = useCallback(
    (d: string, h: string) => {
      setCargando(true);
      setErrRep("");
      api<{ negocios: ReporteQrRow[] }>("reporteQr", { desde: d, hasta: h })
        .then((r) => setFilas(r.negocios))
        .catch((e) => setErrRep((e as Error).message))
        .finally(() => setCargando(false));
    },
    []
  );
  useEffect(() => {
    cargarReporte(desde, hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rango = (d: string, h: string) => {
    setDesde(d);
    setHasta(h);
    cargarReporte(d, h);
  };
  const rapido = {
    ayer: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const ayer = isoLocal(d);
      rango(ayer, ayer);
    },
    hoy: () => rango(hoy, hoy),
    semana: () => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      rango(isoLocal(d), hoy);
    },
    mes: () => rango(hoy.slice(0, 8) + "01", hoy),
  };

  const tot = useMemo(
    () =>
      filas.reduce(
        (a, f) => ({
          total: a.total + f.total,
          qrTotal: a.qrTotal + f.qrTotal,
          qrVentas: a.qrVentas + f.qrVentas,
          ventas: a.ventas + f.ventas,
        }),
        { total: 0, qrTotal: 0, qrVentas: 0, ventas: 0 }
      ),
    [filas]
  );
  const pctQr = tot.total > 0 ? Math.round((tot.qrTotal / tot.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ---- Control de uso del QR de la empresa ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <button className={btnGhost} onClick={rapido.ayer}>Ayer</button>
        <button className={btnGhost} onClick={rapido.hoy}>Hoy</button>
        <button className={btnGhost} onClick={rapido.semana}>Semana</button>
        <button className={btnGhost} onClick={rapido.mes}>Mes</button>
        <input type="date" className={`${input} !w-auto`} value={desde} onChange={(e) => setDesde(e.target.value)} />
        <span className="text-xs text-faint">a</span>
        <input type="date" className={`${input} !w-auto`} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <button className={btnPrimary} disabled={cargando} onClick={() => cargarReporte(desde, hasta)}>
          {cargando ? "Cargando…" : "Ver"}
        </button>
      </div>

      {errRep && <p className="rounded-xl bg-error/10 px-4 py-2 text-sm font-semibold text-error">{errRep}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${card} pv-kpi`}>
          <div className="pv-kpi-n">{bsF(tot.qrTotal)}</div>
          <div className="pv-kpi-l">Ingresó por QR de la empresa</div>
        </div>
        <div className={`${card} pv-kpi`}>
          <div className="pv-kpi-n">{tot.qrVentas}</div>
          <div className="pv-kpi-l">Cobros con QR</div>
        </div>
        <div className={`${card} pv-kpi`}>
          <div className="pv-kpi-n">{bsF(tot.total)}</div>
          <div className="pv-kpi-l">Facturado total ({tot.ventas} ventas)</div>
        </div>
        <div className={`${card} pv-kpi`}>
          <div className="pv-kpi-n">{pctQr}%</div>
          <div className="pv-kpi-l">Del ingreso entró por QR</div>
        </div>
      </div>

      <section className={`${card} overflow-x-auto`}>
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-faint">Uso del QR por negocio</h3>
        <p className="mb-3 text-sm text-ink2">
          Todos los negocios de la plataforma cobran con el QR de la{" "}
          <b className="text-[#FEBB03]">empresa</b> (código de comercio{" "}
          <b className="text-[#FEBB03]">0564</b>). Facturas del {desde.split("-").reverse().join("/")} al{" "}
          {hasta.split("-").reverse().join("/")}, hora de Bolivia.
        </p>
        {filas.length === 0 ? (
          <p className="text-sm text-ink2">{cargando ? "Cargando…" : "Sin negocios activos."}</p>
        ) : (
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
                <th className="py-2 pr-3">Negocio</th>
                <th className="py-2 pr-3">Facturado</th>
                <th className="py-2 pr-3">Ingresó por QR</th>
                <th className="py-2 pr-3">Cobros QR</th>
                <th className="py-2">% QR</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.slug} className="border-b border-line/60">
                  <td className="py-2.5 pr-3">
                    <span className="font-bold text-ink">{f.nombre}</span>
                    {f.error && <span className="ml-2 text-xs font-semibold text-error">sin datos: {f.error}</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-ink2">{bsF(f.total)} <span className="text-xs text-faint">({f.ventas})</span></td>
                  <td className="py-2.5 pr-3 font-bold text-[#FEBB03]">{bsF(f.qrTotal)}</td>
                  <td className="py-2.5 pr-3 text-ink2">{f.qrVentas}</td>
                  <td className="py-2.5 text-ink2">{f.total > 0 ? Math.round((f.qrTotal / f.total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

    </div>
  );
}

/** Fila de un usuario: rol, estado y asignación de contraseña nueva. */
function UsuarioRow({
  slug,
  emp,
  busy,
  accion,
}: {
  slug: string;
  emp: EmployeeRow;
  busy: boolean;
  accion: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  const [abrir, setAbrir] = useState(false);
  const [pass, setPass] = useState("");
  const [ver, setVer] = useState(true);

  return (
    <li className="rounded-xl border border-line/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-ink">{emp.name}</span>
        <span className="text-ink2">{emp.email || "sin correo"}</span>
        <select
          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
          value={emp.role}
          disabled={busy}
          onChange={(ev) => accion(() => api("setRole", { slug, employeeId: emp.id, role: ev.target.value }))}
        >
          {["Administrador", "Vendedora", "Repartidor"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        {!emp.active && <span className="text-xs font-bold text-error">inactivo</span>}
        <button
          className="ml-auto text-xs font-semibold text-[#FEBB03] hover:underline"
          onClick={() => setAbrir((v) => !v)}
        >
          {abrir ? "Cerrar" : "Cambiar contraseña"}
        </button>
      </div>

      {abrir && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line/60 pt-3">
          <Field label="Nueva contraseña (6+)">
            <input
              className={`${input} min-w-[220px]`}
              type={ver ? "text" : "password"}
              value={pass}
              placeholder="la que le vas a dar al usuario"
              onChange={(e) => setPass(e.target.value)}
            />
          </Field>
          <button className={btnGhost} onClick={() => setVer((v) => !v)}>
            {ver ? "Ocultar" : "Ver"}
          </button>
          <button
            className={btnPrimary}
            disabled={busy || pass.length < 6}
            onClick={() =>
              accion(
                () => api("setEmployeePass", { slug, employeeId: emp.id, pass }),
                `Contraseña de ${emp.email} actualizada.`
              ).then(() => {
                setPass("");
                setAbrir(false);
              })
            }
          >
            Guardar contraseña
          </button>
          <span className="text-xs text-faint">
            Reemplaza la clave anterior. Anotá esta y entregásela al usuario.
          </span>
        </div>
      )}
    </li>
  );
}

/** Usuarios: cuentas de cada negocio — ver, crear, rol y asignar contraseña. */
function UsuariosSection({ negocios }: { negocios: NegocioRow[] }) {
  const [slug, setSlug] = useState("");
  const [emps, setEmps] = useState<EmployeeRow[]>([]);
  const [nuevo, setNuevo] = useState({ name: "", email: "", pass: "", role: "Vendedora" });
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState("");
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(() => {
    if (!slug) return setEmps([]);
    api<{ employees: EmployeeRow[] }>("listEmployees", { slug })
      .then((r) => setEmps(r.employees))
      .catch((e) => setErr((e as Error).message));
  }, [slug]);
  useEffect(cargar, [cargar]);

  const accion = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setErr("");
    setAviso("");
    try {
      await fn();
      cargar();
      if (ok) setAviso(ok);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className={card}>
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-faint">Usuarios del negocio</h3>
        <p className="mb-4 text-sm text-ink2">
          Las cuentas con las que el dueño y su equipo entran al CRM y a la app del negocio. Las
          contraseñas se guardan cifradas y no se pueden mostrar; si alguien la olvidó, asignale
          una nueva con «Cambiar contraseña» y entregásela.
        </p>
        <Field label="Negocio">
          <PickNegocio negocios={negocios} value={slug} onChange={setSlug} />
        </Field>
        {err && <p className="mt-3 rounded-xl bg-error/10 px-4 py-2 text-sm font-semibold text-error">{err}</p>}
        {aviso && <p className="mt-3 rounded-xl bg-success/10 px-4 py-2 text-sm font-semibold text-success">{aviso}</p>}

        {slug && (
          <>
            {emps.length === 0 ? (
              <p className="mt-4 text-sm text-ink2">Sin usuarios.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {emps.map((e) => (
                  <UsuarioRow key={e.id} slug={slug} emp={e} busy={busy} accion={accion} />
                ))}
              </ul>
            )}
            <div className="mt-4 grid items-end gap-3 border-t border-line pt-4 sm:grid-cols-4">
              <Field label="Nombre">
                <input className={input} value={nuevo.name} onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })} />
              </Field>
              <Field label="Correo">
                <input className={input} value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
              </Field>
              <Field label="Contraseña (6+)">
                <input className={input} value={nuevo.pass} onChange={(e) => setNuevo({ ...nuevo, pass: e.target.value })} />
              </Field>
              <button
                className={btnPrimary}
                disabled={busy || !nuevo.name || !nuevo.email || nuevo.pass.length < 6}
                onClick={() =>
                  accion(() => api("createEmployee", { slug, ...nuevo }), "Usuario creado.").then(() =>
                    setNuevo({ name: "", email: "", pass: "", role: "Vendedora" })
                  )
                }
              >
                Crear usuario
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Actividad global: quién hizo qué en todo el panel. */
function ActividadSection() {
  const [acts, setActs] = useState<ActividadRow[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ actividad: ActividadRow[] }>("listActividad", {})
      .then((r) => setActs(r.actividad))
      .catch((e) => setErr((e as Error).message));
  }, []);

  return (
    <section className={`${card} overflow-x-auto`}>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Historial del panel</h3>
      {err && <p className="mb-3 rounded-xl bg-error/10 px-4 py-2 text-sm font-semibold text-error">{err}</p>}
      {acts.length === 0 ? (
        <p className="text-sm text-ink2">Sin actividad registrada.</p>
      ) : (
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
              <th className="py-2 pr-3">Fecha</th>
              <th className="py-2 pr-3">Acción</th>
              <th className="py-2 pr-3">Usuario</th>
              <th className="py-2">Negocio</th>
            </tr>
          </thead>
          <tbody>
            {acts.map((a, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="py-2.5 pr-3 text-ink2">{fecha(a.fecha, true)}</td>
                <td className="py-2.5 pr-3 font-semibold text-[#FEBB03]">{a.accion}</td>
                <td className="py-2.5 pr-3 text-ink">{a.usuario || "—"}</td>
                <td className="py-2.5 text-ink2">{a.negocio || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---------- Shell: sidebar + secciones ----------

// ============================================================
//  Panel del Proveedor — helpers, gráficas y vistas nuevas
//  (Dashboard, Ventas, Negocios mejorado, Configuración).
// ============================================================

// Fecha local YYYY-MM-DD y rangos rápidos (hora de la PC del operador).
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function rangoRapido(cual: string): { desde: string; hasta: string } {
  const hoy = new Date();
  const d = new Date();
  if (cual === "ayer") { d.setDate(d.getDate() - 1); return { desde: isoLocal(d), hasta: isoLocal(d) }; }
  if (cual === "semana") { d.setDate(d.getDate() - 6); return { desde: isoLocal(d), hasta: isoLocal(hoy) }; }
  if (cual === "mes") return { desde: isoLocal(hoy).slice(0, 8) + "01", hasta: isoLocal(hoy) };
  return { desde: isoLocal(hoy), hasta: isoLocal(hoy) }; // hoy
}
const ddmmaa = (iso: string) => iso.split("-").reverse().join("/");

// Celda CSV segura (con guard anti-inyección de fórmulas de Excel).
function csvCel(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function descargarCSV(nombre: string, filas: (string | number)[][]) {
  const contenido = filas.map((f) => f.map(csvCel).join(",")).join("\n");
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------- Gráficas SVG (sin librerías) ----------

/** Línea suave con área para una serie temporal. */
function MiniLine({ points, alto = 150 }: { points: { x: string; y: number }[]; alto?: number }) {
  if (points.length === 0)
    return <div className="grid h-[150px] place-items-center text-sm text-faint">Sin datos en el período.</div>;
  const w = 640, h = alto, pad = 8;
  const max = Math.max(1, ...points.map((p) => p.y));
  const n = points.length;
  const px = (i: number) => (n === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1));
  const py = (y: number) => h - pad - (y / max) * (h - pad * 2 - 14);
  const line = points.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${px(n - 1).toFixed(1)},${h} L${px(0).toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: alto }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="pvArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pv-acc)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--pv-acc)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pvArea)" />
      <path d={line} fill="none" stroke="var(--pv-acc)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={i} cx={px(i)} cy={py(p.y)} r="2.5" fill="var(--pv-acc)" />
      ))}
    </svg>
  );
}

/** Donut de segmentos con leyenda. */
function MiniDonut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 52, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="16" />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * c;
            const el = (
              <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off}
                transform="rotate(-90 70 70)" strokeLinecap="butt" />
            );
            off += len;
            return el;
          })}
        <text x="70" y="66" textAnchor="middle" className="fill-[var(--pv-text)]" style={{ fontSize: 20, fontWeight: 800 }}>
          {total > 0 ? Math.round((segments[0]?.value / total) * 100) : 0}%
        </text>
        <text x="70" y="84" textAnchor="middle" className="fill-faint" style={{ fontSize: 10 }}>{segments[0]?.label}</text>
      </svg>
      <div className="space-y-1.5 text-sm">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-ink2">{s.label}</span>
            <b className="ml-auto tabular-nums text-ink">{bsF(s.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontales (ranking). */
function MiniHBars({ items }: { items: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-faint">Sin datos.</p>;
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold text-ink">{it.label}</span>
            <span className="tabular-nums text-ink2">{it.sub ?? bsF(it.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: "linear-gradient(90deg, var(--pv-acc-deep), var(--pv-acc))" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Barras verticales apiladas por día (QR/Efectivo/Otros). */
function MiniStacked({ days }: { days: { fecha: string; qr: number; efectivo: number; otros: number }[] }) {
  if (days.length === 0) return <p className="text-sm text-faint">Sin datos en el período.</p>;
  const max = Math.max(1, ...days.map((d) => d.qr + d.efectivo + d.otros));
  const cols: [keyof (typeof days)[0], string][] = [["qr", "#FEBB03"], ["efectivo", "#4ADE80"], ["otros", "#7C8AA5"]];
  return (
    <div className="flex h-40 items-end gap-2 overflow-x-auto pb-1">
      {days.map((d) => {
        const tot = d.qr + d.efectivo + d.otros;
        return (
          <div key={d.fecha} className="flex shrink-0 basis-12 flex-col items-center">
            <div className="flex w-7 flex-col-reverse overflow-hidden rounded-md" style={{ height: 120 }} title={`${ddmmaa(d.fecha)} · ${bsF(tot)}`}>
              {cols.map(([k, color]) => {
                const v = d[k] as number;
                return v > 0 ? <div key={k} style={{ height: `${(v / max) * 120}px`, background: color }} /> : null;
              })}
            </div>
            <span className="mt-1.5 text-[9.5px] text-faint">{d.fecha.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

// KPI grande para Dashboard/Ventas.
function DashKpi({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className={`${card} pv-kpi`}>
      {icon && <div className="pv-kpi-ic">{icon}</div>}
      <div className="pv-kpi-n">{value}</div>
      <div className="pv-kpi-l">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-faint">{hint}</div>}
    </div>
  );
}

// ---------- Barra de filtros de fecha compartida ----------
function BarraFechas({
  desde, hasta, onDesde, onHasta, onRango, cargando, onRefrescar, extra,
}: {
  desde: string; hasta: string;
  onDesde: (v: string) => void; onHasta: (v: string) => void;
  onRango: (cual: string) => void; cargando?: boolean; onRefrescar?: () => void; extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {extra}
      <button className={btnGhost} onClick={() => onRango("ayer")}>Ayer</button>
      <button className={btnGhost} onClick={() => onRango("hoy")}>Hoy</button>
      <button className={btnGhost} onClick={() => onRango("semana")}>Semana</button>
      <button className={btnGhost} onClick={() => onRango("mes")}>Mes</button>
      <input type="date" className={`${input} !w-auto`} value={desde} onChange={(e) => onDesde(e.target.value)} />
      <span className="text-xs text-faint">a</span>
      <input type="date" className={`${input} !w-auto`} value={hasta} onChange={(e) => onHasta(e.target.value)} />
      {onRefrescar && (
        <button className={btnGhost} disabled={cargando} onClick={onRefrescar}>
          {cargando ? "…" : "↻"}
        </button>
      )}
    </div>
  );
}

// ---------- Dashboard / Ventas ----------

interface DashData {
  desde: string;
  hasta: string;
  ventasTotales: number;
  ventasQR: number;
  numVentas: number;
  comisionGenerada: number;
  ticketPromedio: number;
  pagosPorMetodo: { qr: number; efectivo: number; otros: number };
  ventasPorDia: { fecha: string; total: number; qr: number; efectivo: number; otros: number }[];
  porComercio: { nombre: string; slug: string; total: number; qr: number }[];
}
interface EstadoPlat {
  activos: number; prueba: number; suspendidos: number; baja: number; total: number;
  altasPorMes: { mes: string; n: number }[];
  requiereAtencion: { tipo: string; nombre: string; slug: string }[];
}

function DashboardView({
  negocios,
  soloVentas,
  onOpen,
}: {
  negocios: NegocioRow[];
  soloVentas?: boolean;
  onOpen?: (slug: string) => void;
}) {
  const hoy = isoLocal(new Date());
  const [desde, setDesde] = useState(hoy.slice(0, 8) + "01");
  const [hasta, setHasta] = useState(hoy);
  const [slug, setSlug] = useState("");
  const [data, setData] = useState<DashData | null>(null);
  const [plat, setPlat] = useState<EstadoPlat | null>(null);
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState("");

  const cargar = useCallback(
    (d: string, h: string, s: string) => {
      setCargando(true);
      setErr("");
      api<DashData>("dashboard", { desde: d, hasta: h, slug: s || undefined })
        .then(setData)
        .catch((e) => setErr((e as Error).message))
        .finally(() => setCargando(false));
    },
    []
  );
  useEffect(() => {
    cargar(desde, hasta, slug);
    if (!soloVentas) api<EstadoPlat>("estadoPlataforma").then(setPlat).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rango = (cual: string) => {
    const r = rangoRapido(cual);
    setDesde(r.desde); setHasta(r.hasta); cargar(r.desde, r.hasta, slug);
  };
  const cambiarSlug = (s: string) => { setSlug(s); cargar(desde, hasta, s); };

  const donut = data
    ? [
        { label: "QR", value: data.pagosPorMetodo.qr, color: "#FEBB03" },
        { label: "Efectivo", value: data.pagosPorMetodo.efectivo, color: "#4ADE80" },
        { label: "Otros", value: data.pagosPorMetodo.otros, color: "#7C8AA5" },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BarraFechas
          desde={desde} hasta={hasta}
          onDesde={(v) => setDesde(v)} onHasta={(v) => setHasta(v)}
          onRango={rango} cargando={cargando} onRefrescar={() => cargar(desde, hasta, slug)}
          extra={
            <select className={`${input} !w-auto`} value={slug} onChange={(e) => cambiarSlug(e.target.value)}>
              <option value="">Todos los comercios</option>
              {negocios.map((n) => (
                <option key={n.id} value={n.slug}>{n.nombre}</option>
              ))}
            </select>
          }
        />
        <button className={btnGhost} onClick={() => data && exportarDash(data)}>Exportar CSV</button>
      </div>

      {err && <p className="rounded-xl bg-error/10 px-4 py-2 text-sm font-semibold text-error">{err}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashKpi label="Ventas totales" value={bsF(data?.ventasTotales ?? 0)} hint={`${data?.numVentas ?? 0} ventas`} />
        <DashKpi label="Ventas por QR" value={bsF(data?.ventasQR ?? 0)} hint="Cobrado con QR" />
        <DashKpi label="Comisión generada" value={bsF(data?.comisionGenerada ?? 0)} hint="Ingreso del proveedor" />
        <DashKpi label="Ticket promedio" value={bsF(data?.ticketPromedio ?? 0)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Ventas por día</h3>
          <MiniLine points={(data?.ventasPorDia ?? []).map((d) => ({ x: d.fecha, y: d.total }))} />
        </section>
        <section className={card}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Pagos por método</h3>
          <MiniDonut segments={donut} />
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {!slug && (
          <section className={card}>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Distribución por comercio</h3>
            <MiniHBars items={(data?.porComercio ?? []).slice(0, 8).map((c) => ({ label: c.nombre, value: c.total }))} />
          </section>
        )}
        <section className={`${card} ${slug ? "lg:col-span-2" : ""}`}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Pagos por día (QR · Efectivo · Otros)</h3>
          <MiniStacked days={data?.ventasPorDia ?? []} />
        </section>
      </div>

      {!soloVentas && plat && (
        <section className={card}>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-faint">Estado de la plataforma</h3>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="pv-mini"><div className="pv-mini-n">{plat.activos}</div><div className="pv-mini-l">Activos</div></div>
              <div className="pv-mini"><div className="pv-mini-n">{plat.prueba}</div><div className="pv-mini-l">En prueba</div></div>
              <div className="pv-mini"><div className="pv-mini-n">{plat.suspendidos}</div><div className="pv-mini-l">Suspendidos</div></div>
              <div className="pv-mini"><div className="pv-mini-n">{plat.total}</div><div className="pv-mini-l">Total</div></div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Altas por mes</div>
              <MiniHBars items={plat.altasPorMes.map((m) => ({ label: m.mes.slice(5), value: m.n, sub: `${m.n}` }))} />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Requiere atención</div>
              {plat.requiereAtencion.length === 0 ? (
                <p className="text-sm text-faint">Todo en orden.</p>
              ) : (
                <ul className="space-y-1.5">
                  {plat.requiereAtencion.map((r) => (
                    <li key={r.slug} className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-error" />
                      <button className="text-ink hover:underline" onClick={() => onOpen?.(r.slug)}>{r.nombre}</button>
                      <span className="text-xs text-faint">suspendido</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function exportarDash(d: DashData) {
  const filas: (string | number)[][] = [
    ["Reporte", `${ddmmaa(d.desde)} a ${ddmmaa(d.hasta)}`],
    [],
    ["Ventas totales", d.ventasTotales.toFixed(2)],
    ["Ventas por QR", d.ventasQR.toFixed(2)],
    ["Comisión generada", d.comisionGenerada.toFixed(2)],
    ["N° ventas", d.numVentas],
    [],
    ["Comercio", "Ventas", "QR"],
    ...d.porComercio.map((c) => [c.nombre, c.total.toFixed(2), c.qr.toFixed(2)]),
    [],
    ["Fecha", "Total", "QR", "Efectivo", "Otros"],
    ...d.ventasPorDia.map((x) => [x.fecha, x.total.toFixed(2), x.qr.toFixed(2), x.efectivo.toFixed(2), x.otros.toFixed(2)]),
  ];
  descargarCSV(`ventas_${d.desde}_a_${d.hasta}.csv`, filas);
}

// ---------- Negocios: tabla filtrable / ordenable / paginada ----------

function NegociosTabla({
  negocios,
  onOpen,
  onAlta,
}: {
  negocios: NegocioRow[];
  onOpen: (slug: string) => void;
  onAlta: () => void;
}) {
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activo" | "prueba" | "suspendido">("todos");
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<{ col: string; asc: boolean }>({ col: "fechaAlta", asc: false });
  const [pagina, setPagina] = useState(0);
  const PORPAG = 9;

  const filtradas = useMemo(() => {
    const f = q.trim().toLowerCase();
    let r = negocios.filter((n) => filtroEstado === "todos" || n.estado === filtroEstado);
    if (f) r = r.filter((n) => `${n.nombre} ${n.slug} ${n.rubro ?? ""} ${n.ciudad ?? ""} ${n.propietario ?? ""}`.toLowerCase().includes(f));
    const dir = orden.asc ? 1 : -1;
    r = [...r].sort((a, b) => {
      const av = (a[orden.col as keyof NegocioRow] ?? "") as string | number;
      const bv = (b[orden.col as keyof NegocioRow] ?? "") as string | number;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return r;
  }, [negocios, filtroEstado, q, orden]);

  const totalPag = Math.max(1, Math.ceil(filtradas.length / PORPAG));
  const pageSafe = Math.min(pagina, totalPag - 1);
  const enPagina = filtradas.slice(pageSafe * PORPAG, pageSafe * PORPAG + PORPAG);

  const sortCol = (col: string) =>
    setOrden((o) => ({ col, asc: o.col === col ? !o.asc : true }));
  const flecha = (col: string) => (orden.col === col ? (orden.asc ? " ↑" : " ↓") : "");

  const exportar = () => {
    descargarCSV(`negocios_${isoLocal(new Date())}.csv`, [
      ["Negocio", "Slug", "Rubro", "Ciudad", "Propietario", "Estado", "Dispositivos", "Comision %", "Cuenta", "Alta"],
      ...filtradas.map((n) => [
        n.nombre, n.slug, n.rubro ?? "", n.ciudad ?? "", n.propietario ?? "", n.estado,
        n.dispositivos ?? 0, n.comisionQr ?? 0, n.cuentaQr ?? "empresa", fecha(n.fechaAlta),
      ]),
    ]);
  };

  const ESTADOS_FILTRO: [typeof filtroEstado, string][] = [
    ["todos", "Todos"], ["activo", "Activos"], ["prueba", "En prueba"], ["suspendido", "Suspendidos"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {ESTADOS_FILTRO.map(([id, lbl]) => (
          <button key={id} className={filtroEstado === id ? btnPrimary : btnGhost} onClick={() => { setFiltroEstado(id); setPagina(0); }}>
            {lbl}
          </button>
        ))}
        <input className={`${input} max-w-xs`} placeholder="Buscar por nombre, rubro, ciudad…" value={q} onChange={(e) => { setQ(e.target.value); setPagina(0); }} />
        <div className="ml-auto flex gap-2">
          <button className={btnGhost} onClick={exportar}>Exportar CSV</button>
          <button className={btnPrimary} onClick={onAlta}>+ Activar comercio</button>
        </div>
      </div>

      <div className={`${card} overflow-x-auto p-0`}>
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
              <th className="cursor-pointer px-5 py-3" onClick={() => sortCol("nombre")}>Negocio{flecha("nombre")}</th>
              <th className="cursor-pointer px-3 py-3" onClick={() => sortCol("rubro")}>Rubro{flecha("rubro")}</th>
              <th className="cursor-pointer px-3 py-3" onClick={() => sortCol("ciudad")}>Ciudad{flecha("ciudad")}</th>
              <th className="cursor-pointer px-3 py-3" onClick={() => sortCol("estado")}>Estado{flecha("estado")}</th>
              <th className="cursor-pointer px-3 py-3" onClick={() => sortCol("dispositivos")}>Disp.{flecha("dispositivos")}</th>
              <th className="cursor-pointer px-3 py-3" onClick={() => sortCol("fechaAlta")}>Alta{flecha("fechaAlta")}</th>
            </tr>
          </thead>
          <tbody>
            {enPagina.map((n) => (
              <tr key={n.id} className="cursor-pointer border-b border-line/60 transition hover:bg-pinkHero" onClick={() => onOpen(n.slug)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FEBB03]/15 text-sm font-bold text-[#FEBB03]">
                      {(n.nombre || "?").charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div className="font-bold text-ink">{n.nombre}</div>
                      <div className="text-xs text-faint">{n.propietario && n.propietario !== "—" ? n.propietario : `/n/${n.slug}`}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-ink2">{n.rubro || "—"}</td>
                <td className="px-3 py-3 text-ink2">{n.ciudad || "—"}</td>
                <td className="px-3 py-3"><EstadoBadge estado={n.estado} /></td>
                <td className="px-3 py-3 text-ink2">{n.dispositivos ?? 0}</td>
                <td className="px-3 py-3 text-ink2">{fecha(n.fechaAlta)}</td>
              </tr>
            ))}
            {enPagina.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-faint">Nada coincide.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPag > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-faint">{filtradas.length} negocios · página {pageSafe + 1} de {totalPag}</span>
          <div className="flex gap-2">
            <button className={btnGhost} disabled={pageSafe === 0} onClick={() => setPagina(pageSafe - 1)}>← Anterior</button>
            <button className={btnGhost} disabled={pageSafe >= totalPag - 1} onClick={() => setPagina(pageSafe + 1)}>Siguiente →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Configuración (tema + acento) ----------
const ACENTOS: { id: string; nombre: string; color: string }[] = [
  { id: "amarillo", nombre: "Amarillo", color: "#FEBB03" },
  { id: "azul", nombre: "Azul", color: "#3B82F6" },
  { id: "verde", nombre: "Verde", color: "#22C55E" },
  { id: "violeta", nombre: "Violeta", color: "#8B5CF6" },
  { id: "rosa", nombre: "Rosa", color: "#EC4899" },
];

function ConfiguracionView({
  me, tema, setTema, acento, setAcento, dominio,
}: {
  me: PanelUser; tema: string; setTema: (t: string) => void; acento: string; setAcento: (a: string) => void; dominio: string;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Empresa</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span className="text-faint">Producto</span><span className="font-semibold text-ink">easy pos</span></li>
          <li className="flex justify-between"><span className="text-faint">Dominio de acceso</span><span className="font-semibold text-ink">@{dominio}</span></li>
          <li className="flex justify-between"><span className="text-faint">Sesión actual</span><span className="font-semibold text-ink">{me.email}</span></li>
        </ul>
      </section>
      <section className={card}>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">Apariencia</h3>
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold text-faint">Tema</div>
          <div className="flex gap-2">
            <button className={tema === "dark" ? btnPrimary : btnGhost} onClick={() => setTema("dark")}>Oscuro</button>
            <button className={tema === "light" ? btnPrimary : btnGhost} onClick={() => setTema("light")}>Claro</button>
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-faint">Color de acento</div>
          <div className="flex gap-3">
            {ACENTOS.map((a) => (
              <button key={a.id} title={a.nombre} onClick={() => setAcento(a.id)}
                className={`h-9 w-9 rounded-full transition ${acento === a.id ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : ""}`}
                style={{ background: a.color }} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

type SeccionId = "dashboard" | "ventas" | "negocios" | "qr" | "cobros" | "usuarios" | "actividad" | "config";

const SECCIONES: Record<SeccionId, { titulo: string; sub: string }> = {
  dashboard: { titulo: "Dashboard", sub: "Crecimiento de la plataforma · estado general" },
  ventas: { titulo: "Ventas", sub: "Ventas agregadas de todos los comercios" },
  negocios: { titulo: "Negocios", sub: "Altas, estados y ficha de cada comercio" },
  qr: { titulo: "Vinculación QR", sub: "Pareo de dispositivos con la app easy pos" },
  cobros: { titulo: "Cobros QR", sub: "Cuánto ingresa por el QR de la empresa, negocio por negocio" },
  usuarios: { titulo: "Usuarios", sub: "Cuentas de los negocios (CRM y app)" },
  actividad: { titulo: "Actividad", sub: "Historial de acciones del panel" },
  config: { titulo: "Configuración", sub: "Empresa y apariencia del panel" },
};

// Iconos mínimos (stroke = currentColor) para el menú.
const IC: Record<SeccionId, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  ventas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-6" />
    </svg>
  ),
  config: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  negocios: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9 5.5 4h13L20 9" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" />
    </svg>
  ),
  qr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM21 14v3M17 21h4M14 19v2" />
    </svg>
  ),
  cobros: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /><path d="M6.5 15h4" />
    </svg>
  ),
  usuarios: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
      <circle cx="17.5" cy="9.5" r="2.5" /><path d="M16 15.2c2.6.3 4.6 1.9 5.5 4.8" />
    </svg>
  ),
  actividad: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
    </svg>
  ),
};

export function PanelApp() {
  const [me, setMe] = useState<PanelUser | null | undefined>(undefined);
  const [negocios, setNegocios] = useState<NegocioRow[]>([]);
  const [sec, setSec] = useState<SeccionId>("dashboard");
  const [vista, setVista] = useState<{ t: "lista" } | { t: "alta" } | { t: "ficha"; slug: string }>({ t: "lista" });
  const [err, setErr] = useState("");
  const [tema, setTema] = useState("dark");
  const [acento, setAcento] = useState("amarillo");
  const [colapsado, setColapsado] = useState(false);
  const [splash, setSplash] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [alertas, setAlertas] = useState(false);
  const [menuUser, setMenuUser] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Preferencias (tema + acento) persistidas en el navegador.
  useEffect(() => {
    try {
      const t = localStorage.getItem("pv-theme"); if (t) setTema(t);
      const a = localStorage.getItem("pv-accent"); if (a) setAcento(a);
    } catch { /* sin storage */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("pv-theme", tema); } catch {} }, [tema]);
  useEffect(() => { try { localStorage.setItem("pv-accent", acento); } catch {} }, [acento]);
  useEffect(() => { const t = setTimeout(() => setSplash(false), 1500); return () => clearTimeout(t); }, []);

  const cargarLista = useCallback(async () => {
    try { setNegocios(await listBusinesses()); setErr(""); }
    catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => {
    fetch("/api/panel/me")
      .then(async (r) => setMe(r.ok ? ((await r.json()).user as PanelUser) : null))
      .catch(() => setMe(null));
  }, []);
  useEffect(() => { if (me) cargarLista(); }, [me, cargarLista]);

  const alertasList = useMemo(() => negocios.filter((n) => n.estado === "suspendido"), [negocios]);
  const matches = useMemo(() => {
    const f = buscar.trim().toLowerCase();
    if (!f) return [];
    return negocios.filter((n) => `${n.nombre} ${n.slug} ${n.ciudad ?? ""}`.toLowerCase().includes(f)).slice(0, 6);
  }, [buscar, negocios]);

  if (me === undefined)
    return <main className="grid min-h-screen place-items-center bg-[#0b0a07] text-sm text-white/40">Cargando…</main>;
  if (!me) return <PanelLogin onOk={setMe} />;

  const salir = async () => { await fetch("/api/panel/login", { method: "DELETE" }).catch(() => {}); setMe(null); };
  const abrirFicha = (slug: string) => { setSec("negocios"); setVista({ t: "ficha", slug }); setBuscar(""); setAlertas(false); };
  const refrescar = () => { cargarLista(); setReloadKey((k) => k + 1); };
  const meta = SECCIONES[sec];
  const dominio = me.email.split("@")[1] ?? "petroboxinc.com";

  return (
    <main className={`pv ${colapsado ? "pv-collapsed" : ""}`} data-theme={tema} data-accent={acento}>
      <style>{PV_CSS}</style>

      {splash && (
        <div className="pv-splash">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/easypos.png" alt="easy pos" />
        </div>
      )}

      {/* -------- Sidebar -------- */}
      <aside className="pv-side">
        <div className="pv-brand">
          <div className="pv-logo" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/easypos.png" alt="easy pos" className="pv-logo-img" />
          </div>
          <div className="pv-brand-sub">PANEL DEL PROVEEDOR</div>
        </div>
        <nav className="pv-nav">
          {(Object.keys(SECCIONES) as SeccionId[]).map((id) => (
            <button key={id} className={`pv-nav-item ${sec === id ? "act" : ""}`} title={SECCIONES[id].titulo}
              onClick={() => { setSec(id); if (id === "negocios") setVista({ t: "lista" }); setAlertas(false); }}>
              <span className="pv-nav-ic">{IC[id]}</span>
              <span className="pv-nav-label">{SECCIONES[id].titulo}</span>
            </button>
          ))}
        </nav>
        <div className="pv-side-foot"><span className="pv-dot" /> <span className="pv-nav-label">en línea</span></div>
      </aside>

      {/* -------- Contenido -------- */}
      <div className="pv-main">
        <header className="pv-top">
          <button className="pv-icbtn" title="Colapsar menú" aria-label="Colapsar" onClick={() => setColapsado((c) => !c)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="pv-top-t">{meta.titulo}</h1>
            <p className="pv-top-s">{meta.sub}</p>
          </div>
          <div className="pv-top-r">
            <div className="pv-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input placeholder="Buscar comercio…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              {matches.length > 0 && (
                <div className="pv-search-drop">
                  {matches.map((n) => (
                    <button key={n.id} onClick={() => abrirFicha(n.slug)}>
                      <b>{n.nombre}</b><span>{n.ciudad || `/n/${n.slug}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="pv-icbtn" title="Refrescar" aria-label="Refrescar" onClick={refrescar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 4v4h-4" /></svg>
            </button>
            <div className="pv-bellwrap">
              <button className="pv-icbtn" title="Requiere atención" aria-label="Alertas" onClick={() => setAlertas((a) => !a)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
                {alertasList.length > 0 && <span className="pv-badge">{alertasList.length}</span>}
              </button>
              {alertas && (
                <div className="pv-pop pv-alerts">
                  <div className="pv-pop-h">Requiere atención</div>
                  {alertasList.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-faint">Todo en orden.</p>
                  ) : (
                    <ul>
                      {alertasList.map((n) => (
                        <li key={n.id}>
                          <button onClick={() => abrirFicha(n.slug)}>
                            <span className="h-2 w-2 shrink-0 rounded-full bg-error" />
                            <span className="min-w-0"><b className="block truncate">{n.nombre}</b><span className="text-xs text-faint">comercio suspendido</span></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <button className="pv-icbtn" title="Tema" aria-label="Tema" onClick={() => setTema((t) => (t === "dark" ? "light" : "dark"))}>
              {tema === "dark" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
              )}
            </button>
            <div className="pv-userwrap">
              <button className="pv-avatar" onClick={() => setMenuUser((m) => !m)}>{(me.name || me.email).charAt(0).toUpperCase()}</button>
              {menuUser && (
                <div className="pv-pop pv-usermenu">
                  <div className="pv-pop-h pv-userhead">
                    <b>{me.name || "Usuario"}</b>
                    <span className="truncate text-xs text-faint">{me.email}</span>
                    <span className="pv-role">admin</span>
                  </div>
                  <button onClick={() => { setSec("config"); setMenuUser(false); }}>Configuración</button>
                  <button onClick={salir}>Cerrar sesión</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="pv-content">
          {err && <p className="mb-4 rounded-xl bg-error/10 px-4 py-2 text-sm font-semibold text-error">{err}</p>}

          {sec === "dashboard" && <DashboardView key={reloadKey} negocios={negocios} onOpen={abrirFicha} />}
          {sec === "ventas" && <DashboardView key={`v${reloadKey}`} negocios={negocios} soloVentas onOpen={abrirFicha} />}

          {sec === "negocios" &&
            (vista.t === "ficha" ? (
              <FichaNegocio slug={vista.slug} onBack={() => setVista({ t: "lista" })} onChanged={cargarLista} />
            ) : vista.t === "alta" ? (
              <AltaNegocio onDone={(slug) => { cargarLista(); setVista({ t: "ficha", slug }); }} onCancel={() => setVista({ t: "lista" })} />
            ) : (
              <NegociosTabla negocios={negocios} onOpen={(slug) => setVista({ t: "ficha", slug })} onAlta={() => setVista({ t: "alta" })} />
            ))}

          {sec === "qr" && <QrSection negocios={negocios} />}
          {sec === "cobros" && <CobrosSection />}
          {sec === "usuarios" && <UsuariosSection negocios={negocios} />}
          {sec === "actividad" && <ActividadSection />}
          {sec === "config" && <ConfiguracionView me={me} tema={tema} setTema={setTema} acento={acento} setAcento={setAcento} dominio={dominio} />}
        </div>
      </div>
    </main>
  );
}

// Tema oscuro del interior: identidad easy pos fija (negro + #FEBB03).
// Además de las clases pv-*, se remapean los tokens de color del CRM claro
// (text-ink, bg-surface, border-line…) que usan las fichas y tablas, para que
// TODO el subárbol del panel quede oscuro sin reescribir cada línea.
const PV_CSS = `
/* ====== Tema (claro/oscuro) + acento, por variables ====== */
.pv { --pv-acc: #FEBB03; --pv-acc-deep: #E0A100; --pv-on-acc: #17120F;
  --pv-surface: #141310; --pv-input-bg: rgba(255,255,255,.05); --pv-ghost-bg: rgba(255,255,255,.04);
  --pv-text: #F2EDE2; --pv-text2: #B3AB9C; --pv-faint: #837B6B; --pv-line: rgba(255,255,255,.10);
  --pv-side: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012));
  --pv-topbar: rgba(12,11,8,.75); --pv-pop: #1b1913;
  --pv-page: radial-gradient(90% 60% at 80% -10%, color-mix(in srgb, var(--pv-acc) 8%, transparent) 0%, transparent 55%),
             radial-gradient(70% 60% at 0% 110%, #12100a 0%, transparent 60%),
             linear-gradient(180deg, #0d0c09, #0a0906 55%, #080704);
  display: flex; min-height: 100vh; color-scheme: dark;
  font-family: var(--font-poppins), sans-serif; color: var(--pv-text); background: var(--pv-page); }

.pv[data-theme="light"] { color-scheme: light;
  --pv-surface: #FFFFFF; --pv-input-bg: #F5F3EF; --pv-ghost-bg: #F5F3EF;
  --pv-text: #1E1A14; --pv-text2: #5C554A; --pv-faint: #968E7E; --pv-line: rgba(0,0,0,.10);
  --pv-side: #FBF9F5; --pv-topbar: rgba(255,255,255,.82); --pv-pop: #FFFFFF;
  --pv-page: radial-gradient(90% 60% at 80% -10%, color-mix(in srgb, var(--pv-acc) 12%, transparent) 0%, transparent 55%),
             linear-gradient(180deg, #F3F1EC, #EFEDE7); }

.pv[data-accent="amarillo"] { --pv-acc: #FEBB03; --pv-acc-deep: #E0A100; --pv-on-acc: #17120F; }
.pv[data-accent="azul"]     { --pv-acc: #3B82F6; --pv-acc-deep: #2563EB; --pv-on-acc: #FFFFFF; }
.pv[data-accent="verde"]    { --pv-acc: #22C55E; --pv-acc-deep: #16A34A; --pv-on-acc: #06210F; }
.pv[data-accent="violeta"]  { --pv-acc: #8B5CF6; --pv-acc-deep: #7C3AED; --pv-on-acc: #FFFFFF; }
.pv[data-accent="rosa"]     { --pv-acc: #EC4899; --pv-acc-deep: #DB2777; --pv-on-acc: #FFFFFF; }

/* ---- Remapeo de los tokens claros del CRM al tema activo ---- */
.pv .text-ink { color: var(--pv-text); }
.pv .text-ink2 { color: var(--pv-text2); }
.pv .text-faint { color: var(--pv-faint); }
.pv .hover\\:text-ink:hover { color: var(--pv-text); }
.pv .text-pinkDeep, .pv .text-gold { color: var(--pv-acc); }
.pv .text-\\[\\#FEBB03\\] { color: var(--pv-acc); }
.pv .text-success { color: #22C55E; }
.pv .text-error { color: #EF5A6F; }
.pv .bg-surface { background: var(--pv-surface); }
.pv .bg-bg { background: transparent; }
.pv .bg-pinkHero, .pv .hover\\:bg-pinkHero:hover { background: color-mix(in srgb, var(--pv-acc) 8%, transparent); }
.pv .bg-error { background: #E0324E; }
.pv .bg-error\\/10 { background: rgba(224,50,78,.14); }
.pv .bg-success\\/10 { background: rgba(34,197,94,.14); }
.pv .bg-gold\\/10 { background: color-mix(in srgb, var(--pv-acc) 14%, transparent); }
.pv .bg-\\[\\#FEBB03\\]\\/15 { background: color-mix(in srgb, var(--pv-acc) 15%, transparent); }
.pv .bg-line\\/70 { background: var(--pv-line); }
.pv .border-line { border-color: var(--pv-line); }
.pv .border-line\\/60 { border-color: color-mix(in srgb, var(--pv-line) 60%, transparent); }
.pv .border-pink\\/60 { border-color: color-mix(in srgb, var(--pv-acc) 45%, transparent); }
.pv .shadow-soft { box-shadow: 0 14px 34px rgba(0,0,0,.18); }
.pv code { color: var(--pv-acc); }

/* ---- Sidebar ---- */
.pv-side { position: sticky; top: 0; display: flex; flex-direction: column; width: 232px;
  min-width: 232px; height: 100vh; padding: 18px 14px; border-right: 1px solid var(--pv-line);
  background: var(--pv-side); transition: width .18s ease, min-width .18s ease; }
.pv-brand { display: flex; flex-direction: column; align-items: center; gap: 13px; padding: 12px 6px 20px;
  border-bottom: 1px solid var(--pv-line); }
.pv-logo { position: relative; width: 96px; height: 96px; display: grid; place-items: center; transition: all .18s ease; }
.pv-logo::before { content: ''; position: absolute; inset: -16px; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--pv-acc) 30%, transparent), transparent 70%); filter: blur(8px); }
.pv-logo-img { position: relative; width: 100%; height: 100%; display: block; object-fit: contain;
  border-radius: 22px; filter: drop-shadow(0 8px 20px color-mix(in srgb, var(--pv-acc) 28%, transparent)); }
.pv-brand-sub { font-size: 9px; font-weight: 700; letter-spacing: 2.4px; color: var(--pv-faint);
  font-family: var(--font-poppins), sans-serif; text-align: center; }

.pv-nav { display: flex; flex-direction: column; gap: 3px; margin-top: 14px; flex: 1; }
.pv-nav-item { display: flex; align-items: center; gap: 11px; padding: 10.5px 12px; border-radius: 12px;
  font-size: 13.5px; font-weight: 600; color: var(--pv-text2); text-align: left; cursor: pointer;
  border: 1px solid transparent; background: transparent; transition: all .15s ease; white-space: nowrap; overflow: hidden; }
.pv-nav-item:hover { color: var(--pv-text); background: color-mix(in srgb, var(--pv-text) 6%, transparent); }
.pv-nav-item.act { color: var(--pv-acc); background: color-mix(in srgb, var(--pv-acc) 12%, transparent);
  border-color: color-mix(in srgb, var(--pv-acc) 24%, transparent); box-shadow: 0 6px 18px -8px color-mix(in srgb, var(--pv-acc) 40%, transparent); }
.pv-nav-ic { width: 18px; height: 18px; display: grid; place-items: center; flex-shrink: 0; }
.pv-nav-ic svg { width: 18px; height: 18px; }

.pv-side-foot { display: flex; align-items: center; gap: 7px; padding: 12px 8px 2px;
  font-size: 11.5px; color: var(--pv-faint); border-top: 1px solid var(--pv-line); }
.pv-dot { width: 8px; height: 8px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 8px rgba(34,197,94,.8); flex-shrink: 0; }

/* Colapsado: solo íconos */
.pv-collapsed .pv-side { width: 74px; min-width: 74px; padding: 18px 10px; }
.pv-collapsed .pv-nav-label, .pv-collapsed .pv-brand-sub { display: none; }
.pv-collapsed .pv-nav-item { justify-content: center; padding: 11px 0; }
.pv-collapsed .pv-logo { width: 46px; height: 46px; }
.pv-collapsed .pv-side-foot { justify-content: center; }

/* ---- Contenido / Topbar ---- */
.pv-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pv-top { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px;
  padding: 12px 22px; border-bottom: 1px solid var(--pv-line);
  background: var(--pv-topbar); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.pv-top-t { font-size: 19px; font-weight: 800; letter-spacing: -.3px; color: var(--pv-text); }
.pv-top-s { margin-top: 1px; font-size: 12px; color: var(--pv-faint); }
.pv-top-r { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.pv-icbtn { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 11px;
  border: 1px solid var(--pv-line); background: var(--pv-ghost-bg); color: var(--pv-text2); cursor: pointer; flex-shrink: 0;
  transition: all .15s ease; }
.pv-icbtn:hover { color: var(--pv-text); border-color: color-mix(in srgb, var(--pv-acc) 40%, transparent); }
.pv-icbtn svg { width: 18px; height: 18px; }

.pv-search { position: relative; }
.pv-search > svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--pv-faint); pointer-events: none; }
.pv-search input { width: 210px; max-width: 40vw; padding: 9px 12px 9px 32px; border-radius: 11px; font-size: 13px;
  border: 1px solid var(--pv-line); background: var(--pv-input-bg); color: var(--pv-text); outline: none; }
.pv-search input:focus { border-color: color-mix(in srgb, var(--pv-acc) 55%, transparent); }
.pv-search-drop { position: absolute; top: 46px; left: 0; right: 0; z-index: 40; padding: 6px;
  border-radius: 14px; border: 1px solid var(--pv-line); background: var(--pv-pop); box-shadow: 0 20px 50px rgba(0,0,0,.4); }
.pv-search-drop button { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%;
  padding: 8px 10px; border-radius: 9px; text-align: left; cursor: pointer; background: transparent; border: 0; }
.pv-search-drop button:hover { background: color-mix(in srgb, var(--pv-acc) 10%, transparent); }
.pv-search-drop b { font-size: 13px; color: var(--pv-text); }
.pv-search-drop span { font-size: 11px; color: var(--pv-faint); }

.pv-bellwrap, .pv-userwrap { position: relative; }
.pv-badge { position: absolute; top: -4px; right: -4px; min-width: 17px; height: 17px; padding: 0 4px;
  display: grid; place-items: center; border-radius: 999px; background: #E0324E; color: #fff; font-size: 10px; font-weight: 800; }
.pv-pop { position: absolute; top: 46px; right: 0; z-index: 40; width: 290px; overflow: hidden;
  border-radius: 16px; border: 1px solid var(--pv-line); background: var(--pv-pop); box-shadow: 0 24px 60px rgba(0,0,0,.45); }
.pv-pop-h { padding: 12px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
  color: var(--pv-faint); border-bottom: 1px solid var(--pv-line); }
.pv-alerts ul { max-height: 320px; overflow: auto; }
.pv-alerts li button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 14px;
  text-align: left; cursor: pointer; background: transparent; border: 0; border-bottom: 1px solid var(--pv-line); }
.pv-alerts li button:hover { background: color-mix(in srgb, var(--pv-acc) 8%, transparent); }
.pv-alerts b { font-size: 13px; color: var(--pv-text); }
.pv-usermenu { width: 240px; }
.pv-userhead { display: flex; flex-direction: column; gap: 2px; text-transform: none; letter-spacing: 0; }
.pv-userhead b { font-size: 14px; color: var(--pv-text); }
.pv-role { margin-top: 4px; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--pv-acc); }
.pv-usermenu > button { display: block; width: 100%; padding: 11px 14px; text-align: left; font-size: 13px; font-weight: 600;
  color: var(--pv-text2); background: transparent; border: 0; cursor: pointer; }
.pv-usermenu > button:hover { background: color-mix(in srgb, var(--pv-acc) 8%, transparent); color: var(--pv-text); }
.pv-avatar { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
  font-weight: 800; font-size: 14px; color: var(--pv-on-acc);
  background: linear-gradient(135deg, var(--pv-acc), var(--pv-acc-deep)); border: 0; flex-shrink: 0; }

.pv-content { padding: 22px 26px 60px; max-width: 1280px; width: 100%; }

/* ---- KPIs / mini ---- */
.pv-kpi { position: relative; overflow: hidden; }
.pv-kpi::after { content: ''; position: absolute; right: -18px; top: -18px; width: 70px; height: 70px;
  border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--pv-acc) 18%, transparent), transparent 70%); }
.pv-kpi-ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; margin-bottom: 10px;
  background: color-mix(in srgb, var(--pv-acc) 14%, transparent); color: var(--pv-acc); }
.pv-kpi-n { font-size: 27px; font-weight: 800; letter-spacing: -.5px; color: var(--pv-acc); line-height: 1.05; }
.pv-kpi-l { margin-top: 6px; font-size: 12px; font-weight: 600; color: var(--pv-text2); }
.pv-mini { border: 1px solid var(--pv-line); border-radius: 14px; padding: 12px; background: color-mix(in srgb, var(--pv-text) 3%, transparent); }
.pv-mini-n { font-size: 22px; font-weight: 800; color: var(--pv-text); line-height: 1; }
.pv-mini-l { margin-top: 3px; font-size: 11px; color: var(--pv-faint); }

/* ---- Splash ---- */
.pv-splash { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center;
  background: var(--pv-page); animation: pvSplashOut .5s ease 1.1s forwards; }
.pv-splash img { width: 128px; height: 128px; border-radius: 28px; object-fit: contain;
  box-shadow: 0 20px 60px color-mix(in srgb, var(--pv-acc) 40%, transparent); animation: pvSplashIn .6s cubic-bezier(.2,.8,.25,1.3) both; }
@keyframes pvSplashIn { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
@keyframes pvSplashOut { to { opacity: 0; visibility: hidden; } }
.pv-fill-\\[var\\(--pv-text\\)\\] { fill: var(--pv-text); }

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .pv { flex-direction: column; }
  .pv-side { position: static; width: 100%; min-width: 0; height: auto; flex-direction: column;
    border-right: 0; border-bottom: 1px solid var(--pv-line); padding: 12px 14px; }
  .pv-collapsed .pv-side { width: 100%; min-width: 0; padding: 12px 14px; }
  .pv-brand { flex-direction: row; padding: 4px 6px 12px; gap: 10px; }
  .pv-logo, .pv-collapsed .pv-logo { width: 40px; height: 40px; }
  .pv-nav { flex-direction: row; overflow-x: auto; margin-top: 10px; padding-bottom: 4px; }
  .pv-nav-item { white-space: nowrap; overflow: visible; }
  .pv-collapsed .pv-nav-label, .pv-collapsed .pv-brand-sub { display: inline; }
  .pv-side-foot { display: none; }
  /* Topbar en dos filas: título arriba, controles abajo (sin solaparse). */
  .pv-top { flex-wrap: wrap; row-gap: 10px; padding: 10px 14px; }
  .pv-top-s { display: none; }
  .pv-top > .min-w-0 { flex: 1 1 auto; order: 1; }
  .pv-top > .pv-icbtn:first-child { order: 0; }
  .pv-top-r { order: 2; width: 100%; margin-left: 0; justify-content: flex-end; }
  .pv-search { flex: 1; }
  .pv-search input { width: 100%; max-width: none; }
  .pv-content { padding: 16px 14px 44px; }
  .pv-pop { width: 260px; }
}
`;
