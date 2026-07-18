"use client";

import { apiUrl } from "@/lib/apiBase";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Loader2, Palette, Save, Store, Tags } from "lucide-react";
import { RUBRO_LIST, type RubroId } from "@/lib/rubros";
import { businessFromRubro, type BusinessConfig } from "@/lib/business";
import { useBusiness, useProducts, useToast } from "@/context/StoreProvider";
import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/ui";

/**
 * Rubro + datos del negocio. Es el corazón de la adaptación multi-rubro: al
 * elegir un rubro se reescriben colores, textos de la tienda, categorías,
 * catálogo demo, landing y persona del bot; los datos propios (nombre, WhatsApp,
 * dirección) se conservan.
 */
export function NegocioEditor() {
  const router = useRouter();
  const { showToast } = useToast();
  const current = useBusiness();
  const products = useProducts();

  // La config del servidor (via StoreProvider) es el estado inicial del form.
  const [cfg, setCfg] = useState<BusinessConfig>(() => ({
    rubroId: current.rubroId,
    // Los módulos se editan en su propia tarjeta (ModulosEditor); acá viajan
    // tal cual para no pisarlos al guardar el resto del negocio.
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
  // El catálogo de ejemplo NO se carga solo: una instalación nueva arranca
  // vacía y el negocio carga sus productos (o los trae el pareo).
  const [loadDemo, setLoadDemo] = useState(false);

  const set = <K extends keyof BusinessConfig>(key: K, value: BusinessConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  /**
   * Cambiar de rubro trae el preset completo (marca, colores, textos, categorías)
   * pero respeta los datos de contacto y de pago, que son del negocio y no del rubro.
   */
  const pickRubro = (id: RubroId) => {
    if (id === cfg.rubroId) return;
    const preset = businessFromRubro(id);
    setCfg((c) => ({
      ...preset,
      configured: c.configured,
      whatsapp: c.whatsapp,
      phone: c.phone,
      address: c.address,
      hours: c.hours,
      deliveryCost: c.deliveryCost,
      payMethods: c.payMethods,
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/business"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // configured: guardar desde el panel ya cuenta como negocio configurado.
        body: JSON.stringify({ ...cfg, configured: true, loadDemoCatalog: loadDemo }),
      });
      if (!res.ok) throw new Error("save failed");
      const saved = await res.json();
      setCfg((c) => ({ ...c, configured: true }));
      showToast(
        saved.rubroChanged
          ? `Rubro aplicado: tienda, landing y panel actualizados${
              loadDemo ? " (con catálogo de ejemplo)" : ""
            }`
          : "Configuración guardada"
      );
      // El catálogo pudo cambiar en la BD (demo del rubro anterior / nuevo).
      await products.refresh();
      // Recarga los componentes de servidor para repintar con el rubro nuevo.
      router.refresh();
    } catch {
      showToast("No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const rubro = RUBRO_LIST.find((r) => r.id === cfg.rubroId) ?? RUBRO_LIST[0];

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Rubro ---------- */}
      <Card
        icon={<Store size={18} />}
        title="Rubro del negocio"
        hint="Define textos de la tienda, categorías, catálogo demo, landing y la persona del Vendedor 24/7."
      >
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {RUBRO_LIST.map((r) => {
            const active = r.id === cfg.rubroId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => pickRubro(r.id)}
                className={`relative flex flex-col items-start gap-2 rounded-[14px] border p-3.5 text-left transition-all ${
                  active
                    ? "border-pink bg-pinkSoft shadow-soft"
                    : "border-line bg-surface2 hover:border-pink/50"
                }`}
              >
                <span
                  className="grid h-9 w-9 place-items-center rounded-[10px] text-white"
                  style={{ background: r.colors.accent }}
                >
                  <Icon name={r.icon} size={18} />
                </span>
                <span className="text-[13.5px] font-semibold text-ink">{r.label}</span>
                <span className="text-[11.5px] leading-snug text-ink2">{r.hint}</span>
                {active && (
                  <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-pink text-onAccent">
                    <Check size={13} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface2 px-3.5 py-3">
          <input
            type="checkbox"
            checked={loadDemo}
            onChange={() => setLoadDemo((v) => !v)}
            className="mt-0.5 h-4 w-4 accent-pink"
          />
          <span className="text-[12.5px] leading-snug text-ink2">
            <b className="text-ink">Cargar catálogo de ejemplo del rubro</b> al guardar.
            Útil para probar; déjalo desmarcado si vas a cargar tus propios productos
            (el catálogo arranca vacío).
          </span>
        </label>

        {cfg.rubroId !== current.rubroId && (
          <p className="rounded-xl border border-pink/40 bg-pinkSoft px-3.5 py-2.5 text-[12.5px] text-ink2">
            Al guardar se aplicará el preset de <b className="text-ink">{rubro.label}</b>:
            la tienda, la landing y el panel cambian de colores y textos, las categorías
            pasan a ser las de este rubro y el bot pasa a vender {rubro.noun.many}.
            Se quitan los productos de ejemplo del rubro anterior; los que cargaste con
            tu propio SKU no se tocan.
          </p>
        )}
      </Card>

      {/* ---------- Marca: solo nombre y logo ----------
          Los colores son los de easy pos (fijos) y el resto de los textos salen
          del rubro; acá el negocio solo pone su nombre y su logo. */}
      <Card
        icon={<Palette size={18} />}
        title="Marca"
        hint="Los colores son los de easy pos. Aquí defines el nombre y el logo de tu tienda."
      >
        <Field label="Nombre comercial" value={cfg.name} onChange={(v) => set("name", v)} />
        <Field
          label="Logo (URL o ruta en /public). Vacío = icono del rubro"
          value={cfg.logoUrl}
          onChange={(v) => set("logoUrl", v)}
          placeholder="/images/mi-logo.png"
        />
        {cfg.logoUrl.trim() !== "" && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface2 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.logoUrl} alt="Logo" className="h-12 w-12 rounded-lg object-contain" />
            <span className="text-[12.5px] text-ink2">Vista previa del logo</span>
          </div>
        )}
      </Card>

      {/* ---------- Categorías ---------- */}
      <Card
        icon={<Tags size={18} />}
        title="Categorías del catálogo"
        hint="Separadas por coma. Se usan en la tienda, el registro de productos y el pie de página."
      >
        <Field
          label="Categorías"
          value={cfg.categories.join(", ")}
          onChange={(v) => set("categories", v.split(",").map((c) => c.trim()).filter(Boolean))}
          placeholder="Herramientas, Construcción, Electricidad"
        />
      </Card>

      {/* ---------- Contacto y pagos ---------- */}
      <Card icon={<CreditCard size={18} />} title="Contacto y pagos">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="WhatsApp" value={cfg.whatsapp} onChange={(v) => set("whatsapp", v)} placeholder="59170000000" />
          <Field label="Teléfono" value={cfg.phone} onChange={(v) => set("phone", v)} />
        </div>
        <Field label="Dirección" value={cfg.address} onChange={(v) => set("address", v)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Horario" value={cfg.hours} onChange={(v) => set("hours", v)} />
          <Field label="Referencia de pago" value={cfg.payReference} onChange={(v) => set("payReference", v)} />
        </div>
        <Field
          label="Costo de envío por defecto (Bs)"
          type="number"
          value={String(cfg.deliveryCost)}
          onChange={(v) => set("deliveryCost", Number(v) || 0)}
        />
        <div className="flex flex-col gap-1 pt-1">
          {Object.keys(cfg.payMethods).map((m) => (
            <label key={m} className="flex cursor-pointer items-center justify-between py-1.5">
              <span className="text-[13.5px] text-ink">{m}</span>
              <input
                type="checkbox"
                checked={cfg.payMethods[m]}
                onChange={() =>
                  set("payMethods", { ...cfg.payMethods, [m]: !cfg.payMethods[m] })
                }
                className="h-5 w-9 accent-pink"
              />
            </label>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryButton
          label={saving ? "Guardando…" : "Guardar negocio"}
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
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  );
}

