"use client";

import { useLink } from "@/lib/negocioLink";
import { apiUrl } from "@/lib/apiBase";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { defaultPromoConfig, type PromoConfig } from "@/lib/promo";
import { useProducts, useToast } from "@/context/StoreProvider";
import { PrimaryButton } from "@/components/ui";

/** Editor de la landing promocional (/promo) — un solo producto destacado. */
export function PromoEditor() {
  const link = useLink();
  const { showToast } = useToast();
  const { products } = useProducts();
  const [cfg, setCfg] = useState<PromoConfig>(defaultPromoConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carga la config guardada desde la base de datos.
  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/promo"))
      .then((r) => r.json())
      .then((data: PromoConfig) => {
        if (alive) setCfg({ ...defaultPromoConfig, ...data });
      })
      .catch(() => showToast("No se pudo cargar la configuración"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [showToast]);

  const set = <K extends keyof PromoConfig>(key: K, value: PromoConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  /** Al elegir un producto se autocompletan nombre, precio, imagen y descripción. */
  const pickProduct = (id: string) => {
    if (!id) {
      set("productId", undefined);
      return;
    }
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setCfg((c) => ({
      ...c,
      productId: p.id,
      productName: p.name,
      title: p.name,
      price: p.price,
      image: p.image,
      description: p.desc,
    }));
  };

  const persist = async (data: PromoConfig, msg: string) => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/promo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const saved = (await res.json()) as PromoConfig;
      setCfg({ ...defaultPromoConfig, ...saved });
      showToast(msg);
    } catch {
      showToast("No se pudo guardar. Revisa tu sesión.");
    } finally {
      setSaving(false);
    }
  };

  const save = () => persist(cfg, "Landing promocional guardada");

  const reset = () =>
    persist(defaultPromoConfig, "Landing restablecida a los valores por defecto");

  const dtLocal = (iso?: string) => (iso ? iso.slice(0, 16) : "");

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[18px] border border-line bg-surface p-5 text-[13px] text-ink2 shadow-soft">
        <Loader2 size={16} className="animate-spin" /> Cargando configuración de la landing…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card icon={<Sparkles size={18} />} title="Landing promocional (un producto)">
        <p className="-mt-1 text-[12.5px] text-ink2">
          Página pública en <span className="font-semibold text-ink">/promo</span> que promociona un
          solo producto. Elige el producto y ajusta los textos, precios y vigencia.
        </p>

        <Toggle
          label="Landing promocional activa"
          checked={cfg.enabled}
          onChange={() => set("enabled", !cfg.enabled)}
        />

        <div className="my-1 h-px bg-line" />

        {/* Producto destacado */}
        <label className="block">
          <span className="text-[12px] font-semibold text-ink2">Producto destacado</span>
          <select
            value={cfg.productId ?? ""}
            onChange={(e) => pickProduct(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none focus:border-pink"
          >
            <option value="">— Personalizado (sin vincular) —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Etiqueta superior (eyebrow)" value={cfg.eyebrow} onChange={(v) => set("eyebrow", v)} />
          <Field label="Insignia / badge" value={cfg.badge ?? ""} onChange={(v) => set("badge", v)} placeholder="-23%" />
        </div>

        <Field label="Título (hero)" value={cfg.title} onChange={(v) => set("title", v)} />
        <Field label="Subtítulo" value={cfg.subtitle} onChange={(v) => set("subtitle", v)} rows={2} />
        <Field label="Nombre del producto" value={cfg.productName} onChange={(v) => set("productName", v)} />
        <Field label="Descripción" value={cfg.description} onChange={(v) => set("description", v)} rows={4} />
      </Card>

      <Card icon={<Sparkles size={18} />} title="Precio y vigencia">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Precio (Bs)" value={cfg.price} onChange={(v) => set("price", v ?? 0)} />
          <NumberField
            label="Precio anterior (Bs, opcional)"
            value={cfg.originalPrice}
            onChange={(v) => set("originalPrice", v)}
          />
        </div>
        <label className="block">
          <span className="text-[12px] font-semibold text-ink2">
            Válido hasta (cuenta regresiva, opcional)
          </span>
          <input
            type="datetime-local"
            value={dtLocal(cfg.validUntil)}
            onChange={(e) => set("validUntil", e.target.value || undefined)}
            className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none focus:border-pink"
          />
        </label>
      </Card>

      <Card icon={<Sparkles size={18} />} title="Imágenes y llamado a la acción">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Imagen principal" value={cfg.image} onChange={(v) => set("image", v)} placeholder="/images/promo.jpg (vacío = placeholder del rubro)" />
          <Field label="Imagen secundaria (opcional)" value={cfg.imageAlt ?? ""} onChange={(v) => set("imageAlt", v)} placeholder="/images/promo-2.jpg" />
        </div>
        <Field label="Texto del botón (CTA)" value={cfg.ctaLabel} onChange={(v) => set("ctaLabel", v)} />
        <Field
          label="Mensaje de WhatsApp del CTA"
          value={cfg.whatsappMessage}
          onChange={(v) => set("whatsappMessage", v)}
          rows={2}
        />

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <PrimaryButton
            label={saving ? "Guardando…" : "Guardar landing"}
            icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            onClick={save}
            disabled={saving}
          />
          <a
            href={link("/promo")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-[13px] font-semibold text-ink shadow-soft"
          >
            <ExternalLink size={16} /> Abrir landing
          </a>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink2 hover:text-ink"
          >
            <RotateCcw size={15} /> Restablecer
          </button>
        </div>
        <p className="text-[11.5px] text-faint">
          Los cambios se guardan en este navegador. Abre la landing para revisarla tras guardar.
        </p>
      </Card>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <span className="text-ink">{icon}</span>
        {title}
      </h3>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </div>
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink2">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink"
      />
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
