"use client";

import { apiUrl } from "@/lib/apiBase";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { PromoHighlight, PromoPage, PromoStat } from "@/lib/promo";
import { promoSlugify } from "@/lib/promo";
import { useProducts, useToast } from "@/context/StoreProvider";
import { PrimaryButton } from "@/components/ui";
import { Icon, ICON_NAMES } from "@/components/Icon";
import { ImageUploadField } from "./ImageUploadField";

/**
 * Formulario de UNA landing promocional (un producto destacado).
 *
 * No guarda nada en el navegador: al guardar viaja a `/api/promos/<id>` y queda
 * en la base del negocio, así que la landing pública lo ve al instante. El
 * servidor devuelve la config ya saneada (slug único incluido) y con eso se
 * repinta el formulario, para que lo que se ve acá sea lo que ve el cliente.
 *
 * Los valores por defecto salen del RUBRO del negocio, no de una plantilla
 * fija: por eso el borrador arranca de lo que mandó el servidor.
 */
export function PromoPageForm({
  page,
  isPrincipal,
  publicPath,
  onSaved,
  onDirtyChange,
}: {
  page: PromoPage;
  isPrincipal: boolean;
  /** Ruta pública ya resuelta al negocio (`/n/<slug>/promo/oferta`). */
  publicPath: string;
  onSaved: (saved: PromoPage) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { showToast } = useToast();
  const { products } = useProducts();
  const [cfg, setCfg] = useState<PromoPage>(page);
  const [saving, setSaving] = useState(false);

  // Cambió la landing elegida (o se guardó): el borrador arranca de nuevo.
  useEffect(() => setCfg(page), [page]);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(page);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const set = useCallback(
    <K extends keyof PromoPage>(key: K, value: PromoPage[K]) =>
      setCfg((c) => ({ ...c, [key]: value })),
    []
  );

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

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/promos/${cfg.id}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = (await res.json().catch(() => null)) as
        | (PromoPage & { error?: string })
        | null;
      if (!res.ok) throw new Error(data?.error);
      onSaved(data as PromoPage);
      showToast("Landing guardada");
    } catch (err) {
      showToast(
        err instanceof Error && err.message
          ? err.message
          : "No se pudo guardar. Revisa tu sesión."
      );
    } finally {
      setSaving(false);
    }
  };

  const dtLocal = (iso?: string | null) => (iso ? iso.slice(0, 16) : "");

  const setStat = (i: number, patch: Partial<PromoStat>) =>
    set(
      "stats",
      cfg.stats.map((s, k) => (k === i ? { ...s, ...patch } : s))
    );

  const setHighlight = (i: number, patch: Partial<PromoHighlight>) =>
    set(
      "highlights",
      cfg.highlights.map((h, k) => (k === i ? { ...h, ...patch } : h))
    );

  // Lo que se verá en la URL al guardar (el servidor numera si ya está tomado).
  const slugPreview = promoSlugify(cfg.slug) || promoSlugify(cfg.name) || "landing";

  return (
    <div className="flex flex-col gap-4">
      {/* Despublicada, el enlace muestra "Promoción no disponible". Hay que
          verlo ANTES de abrirlo o de compartirlo, no después. */}
      {!cfg.enabled && (
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-amber-400/50 bg-amber-400/10 px-5 py-4">
          <AlertTriangle size={18} className="shrink-0 text-amber-600" />
          <p className="min-w-[220px] flex-1 text-[12.5px] text-ink">
            <span className="font-semibold">Esta landing está despublicada.</span> Quien
            abra el enlace verá “Promoción no disponible”.
          </p>
          <button
            onClick={() => set("enabled", true)}
            className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-surface"
          >
            Publicar
          </button>
        </div>
      )}

      <Card icon={<Sparkles size={18} />} title="Esta landing">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Nombre (solo para ti)"
            value={cfg.name}
            onChange={(v) => set("name", v)}
            placeholder="Oferta de fin de mes"
          />
          <label className="block">
            <span className="text-[12px] font-semibold text-ink2">
              Dirección de la página
            </span>
            <div className="mt-1.5 flex items-center overflow-hidden rounded-xl border border-line bg-surface2 focus-within:border-pink">
              <span className="shrink-0 pl-3.5 text-[13px] text-faint">/promo/</span>
              <input
                value={cfg.slug}
                onChange={(e) => set("slug", e.target.value)}
                onBlur={() => set("slug", slugPreview)}
                placeholder={promoSlugify(cfg.name) || "oferta"}
                className="w-full bg-transparent px-1.5 py-3 text-[14px] text-ink outline-none placeholder:text-faint"
              />
            </div>
          </label>
        </div>
        <p className="-mt-1 text-[11.5px] text-faint">
          {isPrincipal ? (
            <>
              Es la landing principal: se abre en{" "}
              <span className="font-semibold text-ink2">{publicPath}</span> (y también en{" "}
              <span className="font-semibold text-ink2">/promo/{slugPreview}</span>).
            </>
          ) : (
            <>
              Se publicará en{" "}
              <span className="font-semibold text-ink2">{publicPath}</span>. Si cambias la
              dirección, los enlaces que ya compartiste dejan de funcionar.
            </>
          )}
        </p>

        <div className="my-1 h-px bg-line" />

        <Toggle
          label="Landing publicada"
          hint={
            cfg.enabled
              ? "Publicada: cualquiera que abra el enlace ve la oferta."
              : "Borrador: el enlace muestra “Promoción no disponible”."
          }
          checked={cfg.enabled}
          onChange={() => set("enabled", !cfg.enabled)}
        />
      </Card>

      <Card icon={<Sparkles size={18} />} title="Producto y textos">
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
        <p className="-mt-1 text-[11.5px] text-faint">
          El descuento (−%) sale solo si el precio anterior es mayor al precio. Déjalo vacío para
          no mostrarlo.
        </p>
        <label className="block">
          <span className="text-[12px] font-semibold text-ink2">
            Válido hasta (cuenta regresiva, opcional)
          </span>
          <input
            type="datetime-local"
            value={dtLocal(cfg.validUntil)}
            onChange={(e) => set("validUntil", e.target.value || null)}
            className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none focus:border-pink"
          />
        </label>
      </Card>

      {/* ---- Cifras de la franja negra ---- */}
      <Card icon={<Sparkles size={18} />} title="Cifras destacadas">
        <p className="-mt-1 text-[12.5px] text-ink2">
          La franja oscura bajo la portada. Se ven mejor de a cuatro.
        </p>
        {cfg.stats.map((s, i) => (
          <Row key={i} onRemove={() => set("stats", cfg.stats.filter((_, k) => k !== i))}>
            <Field label="Cifra" value={s.value} onChange={(v) => setStat(i, { value: v })} placeholder="+8.000" />
            <Field label="Texto" value={s.label} onChange={(v) => setStat(i, { label: v })} placeholder="Clientes atendidos" />
          </Row>
        ))}
        <AddButton
          label="Agregar cifra"
          disabled={cfg.stats.length >= 8}
          onClick={() => set("stats", [...cfg.stats, { value: "", label: "" }])}
        />
      </Card>

      {/* ---- Tarjetas de beneficios ---- */}
      <Card icon={<Sparkles size={18} />} title="Beneficios">
        <p className="-mt-1 text-[12.5px] text-ink2">
          Las tarjetas de “Por qué comprarnos”. Las que no tengan título no se publican.
        </p>
        {cfg.highlights.map((h, i) => (
          <Row
            key={i}
            onRemove={() => set("highlights", cfg.highlights.filter((_, k) => k !== i))}
          >
            <label className="block">
              <span className="text-[12px] font-semibold text-ink2">Icono</span>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border border-line bg-surface2 text-ink">
                  <Icon name={h.icon} size={20} />
                </span>
                <select
                  value={ICON_NAMES.includes(h.icon) ? h.icon : "Store"}
                  onChange={(e) => setHighlight(i, { icon: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none focus:border-pink"
                >
                  {ICON_NAMES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <Field label="Título" value={h.title} onChange={(v) => setHighlight(i, { title: v })} />
            <div className="sm:col-span-2">
              <Field
                label="Texto"
                value={h.text ?? ""}
                onChange={(v) => setHighlight(i, { text: v })}
                rows={2}
              />
            </div>
          </Row>
        ))}
        <AddButton
          label="Agregar beneficio"
          disabled={cfg.highlights.length >= 9}
          onClick={() =>
            set("highlights", [...cfg.highlights, { icon: "Store", title: "", text: "" }])
          }
        />
      </Card>

      <Card icon={<Sparkles size={18} />} title="Imágenes y llamado a la acción">
        <div className="grid gap-3 sm:grid-cols-2">
          <ImageUploadField
            label="Imagen principal"
            value={cfg.image}
            onChange={(v) => set("image", v)}
            hint="Sin imagen se muestra el icono de tu rubro. Un PNG o WebP con fondo transparente hace que el producto “flote” sobre el círculo."
          />
          <ImageUploadField
            label="Imagen secundaria (opcional)"
            value={cfg.imageAlt ?? ""}
            onChange={(v) => set("imageAlt", v)}
          />
        </div>
        <Field label="Texto del botón (CTA)" value={cfg.ctaLabel} onChange={(v) => set("ctaLabel", v)} />
        <Field
          label="Mensaje de WhatsApp del CTA"
          value={cfg.whatsappMessage}
          onChange={(v) => set("whatsappMessage", v)}
          rows={2}
        />
      </Card>

      {/* Barra de guardado: pegada abajo, porque el formulario es largo y los
          cambios no se publican hasta que se guarda. */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-[18px] border border-line bg-surface/95 px-4 py-3 shadow-soft backdrop-blur">
        <PrimaryButton
          label={saving ? "Guardando…" : "Guardar landing"}
          icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          onClick={save}
          disabled={saving || !dirty}
        />
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-[13px] font-semibold text-ink shadow-soft"
        >
          <ExternalLink size={16} /> Abrir landing
        </a>
        <span className="text-[11.5px] text-faint">
          {dirty ? "Tienes cambios sin guardar." : "Todo guardado y publicado."}
        </span>
      </div>
    </div>
  );
}

export function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
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

/** Fila editable de una lista (cifra o beneficio), con su botón de quitar. */
function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface2/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <button
        onClick={onRemove}
        className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink2 hover:text-red-500"
      >
        <Trash2 size={14} /> Quitar
      </button>
    </div>
  );
}

function AddButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-fit items-center gap-2 rounded-full border border-dashed border-line px-4 py-2.5 text-[12.5px] font-semibold text-ink2 hover:text-ink disabled:opacity-40"
    >
      <Plus size={15} /> {label}
    </button>
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
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink2">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[14px] text-ink outline-none placeholder:text-faint focus:border-pink"
      />
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
      <span>
        <span className="block text-[13.5px] text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[11.5px] text-faint">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-9 shrink-0 accent-pink" />
    </label>
  );
}
