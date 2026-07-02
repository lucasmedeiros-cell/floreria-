"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
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
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-2">
      <SidePanel />
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
  const [obscure, setObscure] = useState(true);

  const submit = () => auth.login(email, pass);

  return (
    <div className="flex min-h-screen items-center justify-center px-7 py-7">
      <div className="w-full max-w-[380px]">
        <div className="mb-4 flex justify-center lg:hidden">
          <FlowerMark size={52} />
        </div>
        <p className="eyebrow text-[12px] font-semibold text-pink">Panel de gestión</p>
        <h1 className="mt-2 text-[34px] font-semibold text-ink">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-[13.5px] text-ink2">
          Accede para crear y gestionar pedidos.
        </p>

        <label className="mb-1.5 mt-6 block text-[12.5px] font-medium text-ink2">
          Correo
        </label>
        <FieldWrap icon={<Mail size={19} />}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@floresonline.com"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
        </FieldWrap>

        <label className="mb-1.5 mt-4 block text-[12.5px] font-medium text-ink2">
          Contraseña
        </label>
        <FieldWrap
          icon={<Lock size={19} />}
          suffix={
            <button onClick={() => setObscure((o) => !o)} className="text-faint">
              {obscure ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          }
        >
          <input
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            type={obscure ? "password" : "text"}
            placeholder="••••••••"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
        </FieldWrap>

        {auth.error && <ErrorLine msg={auth.error} />}

        <div className="mt-6">
          <PrimaryButton
            label="Ingresar al panel"
            icon={<LogIn size={18} />}
            expand
            onClick={submit}
          />
        </div>

        <button
          onClick={onRegister}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-[26px] py-[13px] text-[13px] font-semibold text-ink shadow-soft transition-all duration-100 active:translate-y-[2px]"
        >
          <UserPlus size={18} className="text-pink" />
          Crear una cuenta nueva
        </button>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface2 p-3">
          <Info size={16} className="text-pink" />
          <span className="text-[11.5px] text-ink2">
            Demo: los datos ya están cargados, solo toca “Ingresar”.
          </span>
        </div>

        <BackToStore />
      </div>
    </div>
  );
}

// ===================== Registro =====================
function RegisterForm({ onLogin }: { onLogin: () => void }) {
  const auth = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [obscure, setObscure] = useState(true);

  const submit = () => auth.register({ name, email, pass, confirm });

  return (
    <div className="flex min-h-screen items-center justify-center px-7 py-7">
      <div className="w-full max-w-[380px]">
        <div className="mb-4 flex justify-center lg:hidden">
          <FlowerMark size={52} />
        </div>
        <p className="eyebrow text-[12px] font-semibold text-pink">Panel de gestión</p>
        <h1 className="mt-2 text-[34px] font-semibold text-ink">
          Crear cuenta
        </h1>
        <p className="mt-2 text-[13.5px] text-ink2">
          Registra un nuevo miembro del equipo para gestionar pedidos.
        </p>

        <label className="mb-1.5 mt-6 block text-[12.5px] font-medium text-ink2">
          Nombre completo
        </label>
        <FieldWrap icon={<User size={19} />}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre y apellido"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
        </FieldWrap>

        <label className="mb-1.5 mt-4 block text-[12.5px] font-medium text-ink2">
          Correo
        </label>
        <FieldWrap icon={<Mail size={19} />}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@floresonline.com"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
        </FieldWrap>

        <label className="mb-1.5 mt-4 block text-[12.5px] font-medium text-ink2">
          Contraseña
        </label>
        <FieldWrap
          icon={<Lock size={19} />}
          suffix={
            <button onClick={() => setObscure((o) => !o)} className="text-faint">
              {obscure ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          }
        >
          <input
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            type={obscure ? "password" : "text"}
            placeholder="Mínimo 6 caracteres"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
        </FieldWrap>

        <label className="mb-1.5 mt-4 block text-[12.5px] font-medium text-ink2">
          Confirmar contraseña
        </label>
        <FieldWrap icon={<Lock size={19} />}>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            type={obscure ? "password" : "text"}
            placeholder="Repite la contraseña"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
        </FieldWrap>

        {auth.error && <ErrorLine msg={auth.error} />}

        <div className="mt-6">
          <PrimaryButton
            label="Crear cuenta e ingresar"
            icon={<UserPlus size={18} />}
            expand
            onClick={submit}
          />
        </div>

        <button
          onClick={onLogin}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-[26px] py-[13px] text-[13px] font-semibold text-ink shadow-soft transition-all duration-100 active:translate-y-[2px]"
        >
          <LogIn size={18} className="text-pink" />
          Ya tengo una cuenta
        </button>

        <BackToStore />
      </div>
    </div>
  );
}

// ===================== Compartidos =====================
function SidePanel() {
  return (
    <div className="hidden bg-pinkHero p-12 lg:flex lg:flex-col">
      <div className="flex items-center gap-3">
        <FlowerMark size={44} />
        <Wordmark />
      </div>
      <div className="flex-1" />
      <p className="text-[.72rem] font-semibold tracking-[3px] text-pink">
        PEDIDOS Y ENTREGAS
      </p>
      <h2 className="mt-3.5 whitespace-pre-line text-[40px] font-medium leading-tight text-ink">
        Gestiona cada pedido{"\n"}con simplicidad.
      </h2>
      <p className="mt-4 max-w-[360px] text-[14px] leading-relaxed text-ink2">
        Crea pedidos para tus clientes, agenda entregas y hazles seguimiento desde
        un solo lugar.
      </p>
      <div className="mt-7 flex flex-col gap-3">
        {[
          "Registra el pedido con fecha, hora y ubicación",
          "Asigna un repartidor y una prioridad",
          "Controla el estado hasta la entrega",
        ].map((t) => (
          <div key={t} className="flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-pink" />
            <span className="text-[13px] text-ink2">{t}</span>
          </div>
        ))}
      </div>
      <div className="flex-1" />
      <p className="text-[11.5px] text-faint">
        © 2026 FloresOnline · Arte floral en cada detalle
      </p>
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <div className="mt-3 flex items-center gap-1.5 text-[#C0334E]">
      <AlertCircle size={16} />
      <span className="text-[12.5px]">{msg}</span>
    </div>
  );
}

function BackToStore() {
  return (
    <div className="mt-5 flex justify-center">
      <Link href="/" className="flex items-center gap-1.5 text-[12.5px] text-ink2">
        <ArrowLeft size={16} /> Volver a la tienda
      </Link>
    </div>
  );
}

function FieldWrap({
  icon,
  suffix,
  children,
}: {
  icon: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 focus-within:border-pink">
      <span className="text-faint">{icon}</span>
      {children}
      {suffix}
    </div>
  );
}
