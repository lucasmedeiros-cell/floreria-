"use client";

import { useState } from "react";
import { Save, Store, CreditCard } from "lucide-react";
import { kPayReference, kWhatsapp } from "@/lib/products";
import { useToast } from "@/context/StoreProvider";
import { PrimaryButton } from "@/components/ui";
import { PromoEditor } from "./PromoEditor";
import { AnimationEditor } from "./AnimationEditor";

export function ConfiguracionPage() {
  const { showToast } = useToast();

  // Datos del negocio
  const [name, setName] = useState("FloresOnline");
  const [address, setAddress] = useState("Av. Las Palmas, Santa Cruz de la Sierra");
  const [whatsapp, setWhatsapp] = useState(kWhatsapp);
  const [payRef, setPayRef] = useState(kPayReference);
  const [delivery, setDelivery] = useState("20");

  // Métodos de pago
  const [pays, setPays] = useState<Record<string, boolean>>({
    Efectivo: true,
    "QR / Transferencia": true,
    Tarjeta: false,
  });

  const save = () => showToast("Configuración guardada");

  return (
    <div className="h-full overflow-y-auto px-7 pb-10 pt-6">
      <div className="flex items-start">
        <div className="flex-1">
          <h1 className="text-[30px] font-semibold text-ink">Configuración</h1>
          <p className="mt-1 text-[13px] text-ink2">Datos del negocio, pagos, entregas y página pública</p>
        </div>
        <PrimaryButton label="Guardar cambios" icon={<Save size={18} />} onClick={save} />
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {/* Datos del negocio */}
        <Card icon={<Store size={18} />} title="Datos del negocio">
          <Field label="Nombre comercial" value={name} onChange={setName} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="59170000000" />
            <Field label="Referencia de pago" value={payRef} onChange={setPayRef} />
          </div>
          <Field label="Dirección" value={address} onChange={setAddress} />
          <Field label="Costo de envío por defecto (Bs)" value={delivery} onChange={setDelivery} type="number" />
        </Card>

        {/* Métodos de pago */}
        <Card icon={<CreditCard size={18} />} title="Métodos de pago">
          <div className="flex flex-col gap-1">
            {Object.keys(pays).map((m) => (
              <Toggle key={m} label={m} checked={pays[m]} onChange={() => setPays((p) => ({ ...p, [m]: !p[m] }))} />
            ))}
          </div>
        </Card>

        {/* Animaciones de inicio */}
        <AnimationEditor />

        {/* Landing promocional (un producto) */}
        <PromoEditor />
      </div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <span className="text-pink">{icon}</span>
        {title}
      </h3>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", rows }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; rows?: number }) {
  const cls = "mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink";
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink2">{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
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
