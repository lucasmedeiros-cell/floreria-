"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Eye,
  EyeOff,
  Info,
  LogIn,
  Mail,
  Lock,
  User,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/context/StoreProvider";
import { FlowerMark, Wordmark } from "@/components/Brand";
import { PrimaryButton } from "@/components/ui";

type Mode = "login" | "register";

export function AdminLogin() {
  const [mode, setMode] = useState<Mode>("login");
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[1fr_1.05fr]">
      <BrandPanel />
      {mode === "login" ? (
        <LoginForm onRegister={() => setMode("register")} />
      ) : (
        <RegisterForm onLogin={() => setMode("login")} />
      )}
    </div>
  );
}

// ===================== Iniciar sesión =====================
function LoginForm({ onRegister }: { onRegister: () => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState("ana@floresonline.com");
  const [pass, setPass] = useState("demo1234");
  const [obscure, setObscure] = useState(false);

  const [busy, setBusy] = useState(false);
  const canSubmit = email.trim() !== "" && pass !== "" && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    await auth.login(email, pass);
    setBusy(false);
  };

  return (
    <FormShell>
      <Header
        title="Iniciar sesión"
        subtitle="Accede para crear y gestionar pedidos."
      />

      <form onSubmit={submit} noValidate className="mt-6">
        <Field
          id="login-email"
          label="Correo"
          icon={<Mail size={19} />}
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={setEmail}
          placeholder="tucorreo@floresonline.com"
        />

        <Field
          id="login-pass"
          label="Contraseña"
          icon={<Lock size={19} />}
          type={obscure ? "text" : "password"}
          autoComplete="current-password"
          value={pass}
          onChange={setPass}
          placeholder="••••••••"
          className="mt-4"
          suffix={<RevealToggle obscure={obscure} onToggle={() => setObscure((o) => !o)} />}
        />

        {auth.error && <ErrorBanner msg={auth.error} />}

        <div className="mt-6">
          <PrimaryButton
            type="submit"
            label={busy ? "Ingresando…" : "Ingresar al panel"}
            icon={<LogIn size={18} />}
            expand
            disabled={!canSubmit}
          />
        </div>
      </form>

      <GhostButton
        icon={<UserPlus size={18} className="text-pink" />}
        label="Crear una cuenta nueva"
        onClick={onRegister}
      />

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface2 p-3">
        <Info size={16} className="mt-px shrink-0 text-pink" />
        <span className="text-[11.5px] leading-relaxed text-ink2">
          Demo: los datos ya están cargados, solo toca “Ingresar al panel”.
        </span>
      </div>

      <BackToStore />
    </FormShell>
  );
}

// ===================== Registro =====================
function RegisterForm({ onLogin }: { onLogin: () => void }) {
  const auth = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [obscure, setObscure] = useState(false);

  const passOk = pass.length >= 6;
  const matchOk = confirm !== "" && confirm === pass;
  const canSubmit =
    name.trim() !== "" && email.trim() !== "" && passOk && matchOk;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) auth.register({ name, email, pass, confirm });
  };

  return (
    <FormShell>
      <Header
        title="Crear cuenta"
        subtitle="Registra un nuevo miembro del equipo para gestionar pedidos."
      />

      <form onSubmit={submit} noValidate className="mt-6">
        <Field
          id="reg-name"
          label="Nombre completo"
          icon={<User size={19} />}
          autoComplete="name"
          autoFocus
          value={name}
          onChange={setName}
          placeholder="Nombre y apellido"
        />

        <Field
          id="reg-email"
          label="Correo"
          icon={<Mail size={19} />}
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="tucorreo@floresonline.com"
          className="mt-4"
        />

        <Field
          id="reg-pass"
          label="Contraseña"
          icon={<Lock size={19} />}
          type={obscure ? "text" : "password"}
          autoComplete="new-password"
          value={pass}
          onChange={setPass}
          placeholder="Mínimo 6 caracteres"
          className="mt-4"
          suffix={<RevealToggle obscure={obscure} onToggle={() => setObscure((o) => !o)} />}
          hint={
            pass !== "" && !passOk
              ? { tone: "warn", text: "Usa al menos 6 caracteres." }
              : undefined
          }
        />

        <Field
          id="reg-confirm"
          label="Confirmar contraseña"
          icon={<Lock size={19} />}
          type={obscure ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Repite la contraseña"
          className="mt-4"
          suffix={
            matchOk ? <Check size={18} className="text-success" /> : undefined
          }
          hint={
            confirm !== "" && !matchOk
              ? { tone: "warn", text: "Las contraseñas no coinciden." }
              : undefined
          }
        />

        {auth.error && <ErrorBanner msg={auth.error} />}

        <div className="mt-6">
          <PrimaryButton
            type="submit"
            label="Crear cuenta e ingresar"
            icon={<UserPlus size={18} />}
            expand
            disabled={!canSubmit}
          />
        </div>
      </form>

      <GhostButton
        icon={<LogIn size={18} className="text-pink" />}
        label="Ya tengo una cuenta"
        onClick={onLogin}
      />

      <BackToStore />
    </FormShell>
  );
}

// ===================== Compartidos =====================
function FormShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-7">
      {/* Fondo rosa oscuro con imagen floral */}
      <Image
        src="/images/hero.jpg"
        alt=""
        fill
        priority
        sizes="55vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-pinkDeep/95 via-pink/85 to-pinkDeep/90" />

      {/* Tarjeta del formulario */}
      <div className="relative w-full max-w-[420px] rounded-[26px] border border-white/60 bg-white p-7 shadow-[0_30px_70px_-20px_rgba(140,10,50,0.55)] sm:p-9">
        <div className="mb-5 flex justify-center lg:hidden">
          <FlowerMark size={52} />
        </div>
        {children}
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <p className="text-[.72rem] font-semibold tracking-[3px] text-pink">
        PANEL DE GESTIÓN
      </p>
      <h1 className="mt-2 text-[32px] font-semibold leading-tight text-ink">
        {title}
      </h1>
      <p className="mt-2 text-[13.5px] text-ink2">{subtitle}</p>
    </>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-pinkHero lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Halos decorativos suaves */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-pink/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-pinkDeep/10 blur-3xl" />

      {/* Marca */}
      <div className="relative flex items-center gap-3">
        <FlowerMark size={44} />
        <Wordmark />
      </div>

      {/* Tarjeta de muestra */}
      <div className="relative my-8 max-w-[300px] rounded-[18px] border border-line bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-semibold tracking-[2px] text-pink">
            PED-1043
          </span>
          <span className="rounded-full bg-pinkSoft px-2.5 py-0.5 text-[10.5px] font-semibold text-pink">
            Programado
          </span>
        </div>
        <p className="mt-2 text-[17px] font-semibold text-ink">María Fernández</p>
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink2">
          <Clock size={13} /> Hoy · 15:00 · 2 ítems
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
          <span className="text-[11.5px] text-ink2">Total</span>
          <span className="text-[15px] font-bold text-pink">Bs 185,00</span>
        </div>
      </div>

      <div className="relative">
        <p className="text-[.72rem] font-semibold tracking-[3px] text-pink">
          PEDIDOS Y ENTREGAS
        </p>
        <h2 className="mt-3 whitespace-pre-line text-[38px] font-semibold leading-[1.1] text-ink">
          Gestiona cada pedido{"\n"}con simplicidad.
        </h2>
        <div className="mt-6 flex flex-col gap-2.5">
          {[
            "Registra el pedido con fecha, hora y ubicación",
            "Asigna un repartidor y una prioridad",
            "Controla el estado hasta la entrega",
          ].map((t) => (
            <div key={t} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-pink">
                <Check size={12} className="text-white" />
              </span>
              <span className="text-[13px] text-ink2">{t}</span>
            </div>
          ))}
        </div>
        <p className="mt-9 text-[11.5px] text-faint">
          © 2026 FloresOnline · Arte floral en cada detalle
        </p>
      </div>
    </div>
  );
}

// ---- Campo de formulario reutilizable ----
function Field({
  id,
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  autoFocus,
  suffix,
  hint,
  className = "",
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  suffix?: React.ReactNode;
  hint?: { tone: "warn"; text: string };
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[12.5px] font-medium text-ink2"
      >
        {label}
      </label>
      <div
        className={`flex items-center gap-2.5 rounded-xl border bg-surface px-4 py-3.5 transition-colors focus-within:ring-2 focus-within:ring-pink/20 ${
          hint ? "border-[#C0334E]/50" : "border-line focus-within:border-pink"
        }`}
      >
        <span className="text-faint">{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={hint ? true : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
        />
        {suffix}
      </div>
      {hint && (
        <p
          id={`${id}-hint`}
          className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[#C0334E]"
        >
          <AlertCircle size={13} /> {hint.text}
        </p>
      )}
    </div>
  );
}

function RevealToggle({
  obscure,
  onToggle,
}: {
  obscure: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={obscure ? "Mostrar contraseña" : "Ocultar contraseña"}
      aria-pressed={obscure}
      className="text-faint transition-colors hover:text-ink2"
    >
      {obscure ? <Eye size={19} /> : <EyeOff size={19} />}
    </button>
  );
}

function GhostButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-[26px] py-[13px] text-[13px] font-semibold text-ink transition-colors hover:border-pink hover:text-pink"
    >
      {icon}
      {label}
    </button>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      role="alert"
      className="mt-4 flex items-center gap-2 rounded-xl border border-[#C0334E]/25 bg-[#C0334E]/10 px-3.5 py-2.5 text-[#C0334E]"
    >
      <AlertCircle size={16} className="shrink-0" />
      <span className="text-[12.5px] font-medium">{msg}</span>
    </div>
  );
}

function BackToStore() {
  return (
    <Link
      href="/"
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-[26px] py-[13px] text-[13px] font-semibold text-ink transition-colors hover:border-pink hover:text-pink"
    >
      <ArrowLeft size={18} className="text-pink" /> Volver a la tienda
    </Link>
  );
}
