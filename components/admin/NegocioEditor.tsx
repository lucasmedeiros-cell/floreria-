"use client";

import { apiUrl } from "@/lib/apiBase";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Save, Store } from "lucide-react";
import { type BusinessConfig } from "@/lib/business";
import { useBusiness, useProducts, useToast } from "@/context/StoreProvider";
import { PrimaryButton } from "@/components/ui";
import { ImageUploadField } from "./ImageUploadField";

/**
 * Mi negocio — lo poco que hay que completar para que la tienda web y la landing
 * salgan con la cara del comercio: nombre, logo, categorías y los datos de
 * contacto y pago.
 *
 * El rubro NO se elige acá: viene definido desde la central al dar de alta el
 * negocio. Todo lo que el comercio no tiene por qué decidir (colores, textos de
 * la tienda, persona del bot) sale de ese rubro o de la marca de easy pos. Los campos que ya
 * no se editan acá (costo de envío, referencia de pago) siguen guardados tal
 * cual: viajan en `cfg` y se reescriben sin tocarlos.
 */
export function NegocioEditor() {
  const router = useRouter();
  const { showToast } = useToast();
  const current = useBusiness();
  const products = useProducts();

  // La config del servidor (via StoreProvider) es el estado inicial del form.
  const [cfg, setCfg] = useState<BusinessConfig>(() => ({
    rubroId: current.rubroId,
    modules: current.modules,
    configured: current.configured,
    name: current.name,
    nameLight: current.nameLight,
    tagline: current.tagline,
    logoUrl: current.logoUrl,
    whatsapp: current.whatsapp,
    phone: current.phone,
    address: current.address,
    hours: current.hours,
    payReference: current.payReference,
    deliveryCost: current.deliveryCost,
    payMethods: current.payMethods,
    categories: current.categories,
    colors: current.colors,
    hero: current.hero,
    about: current.about,
  }));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof BusinessConfig>(key: K, value: BusinessConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/business"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // configured: guardar desde el CRM ya cuenta como negocio configurado.
        body: JSON.stringify({ ...cfg, configured: true }),
      });
      if (!res.ok) throw new Error("save failed");
      setCfg((c) => ({ ...c, configured: true }));
      showToast("Configuración guardada");
      await products.refresh();
      // Recarga los componentes de servidor para repintar con los datos nuevos.
      router.refresh();
    } catch {
      showToast("No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Mi negocio: nombre y logo ---------- */}
      <Card
        icon={<Store size={18} />}
        title="Mi negocio"
        hint="El nombre y el logo son los que ve tu cliente en la tienda web y en la landing."
      >
        <Field label="Nombre comercial" value={cfg.name} onChange={(v) => set("name", v)} />

        <ImageUploadField
          label="Logo del negocio"
          value={cfg.logoUrl}
          onChange={(v) => set("logoUrl", v)}
          // El logo se pinta a 44-52 px; 512 alcanza de sobra y no engorda la
          // config del negocio, que viaja en cada carga de la tienda.
          maxSide={512}
          hint="Arrastralo, pegalo con Ctrl+V o hacé clic para elegirlo. Sale en la tienda web, en la landing y en el menú del CRM. Sin logo se usa el icono del rubro; un PNG o WebP con fondo transparente queda mejor."
        />
      </Card>

      {/* ---------- Contacto, pagos y categorías ---------- */}
      <Card
        icon={<CreditCard size={18} />}
        title="Contacto y pagos"
        hint="Lo que se muestra en la tienda y por dónde te escriben o te pagan."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="WhatsApp"
            value={cfg.whatsapp}
            onChange={(v) => set("whatsapp", v)}
            placeholder="59170000000"
          />
          <Field label="Teléfono" value={cfg.phone} onChange={(v) => set("phone", v)} />
        </div>
        <Field label="Dirección" value={cfg.address} onChange={(v) => set("address", v)} />
        <Field label="Horario" value={cfg.hours} onChange={(v) => set("hours", v)} />
        <Field
          label="Categorías del catálogo"
          value={cfg.categories.join(", ")}
          onChange={(v) =>
            set(
              "categories",
              v.split(",").map((c) => c.trim()).filter(Boolean)
            )
          }
          placeholder="Herramientas, Construcción, Electricidad"
        />

        <div className="flex flex-col gap-1 pt-1">
          <span className="text-[12px] font-semibold text-ink2">Formas de pago que aceptás</span>
          {Object.keys(cfg.payMethods).map((m) => (
            <label key={m} className="flex cursor-pointer items-center justify-between py-1.5">
              <span className="text-[13.5px] text-ink">{m}</span>
              <input
                type="checkbox"
                checked={cfg.payMethods[m]}
                onChange={() => set("payMethods", { ...cfg.payMethods, [m]: !cfg.payMethods[m] })}
                className="h-5 w-9 accent-pink"
              />
            </label>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryButton
          label={saving ? "Guardando…" : "Guardar"}
          icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          onClick={save}
        />
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <span className="text-ink">{icon}</span>
        {title}
      </h3>
      {hint && <p className="mt-1 text-[12.5px] text-ink2">{hint}</p>}
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  rows?: number;
}) {
  const cls =
    "mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink";
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink2">{label}</span>
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}
