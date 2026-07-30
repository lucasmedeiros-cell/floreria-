"use client";

import { useLink } from "@/lib/negocioLink";
import { apiUrl } from "@/lib/apiBase";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  QrCode,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { MAX_PROMO_PAGES, type PromoPage } from "@/lib/promo";
import { useToast } from "@/context/StoreProvider";
import { Card, PromoPageForm } from "./PromoPageForm";
import { PromoQrDialog } from "./PromoQrDialog";

/**
 * Landings promocionales del negocio (varias).
 *
 * Arriba, la lista de landings con sus acciones (abrir, copiar enlace,
 * duplicar, hacer principal, borrar); abajo, el formulario de la que se está
 * editando. La PRINCIPAL es la primera de la lista y es la que responde en
 * `/promo`; las demás en `/promo/<slug>`.
 *
 * Todo vive en la base del negocio (`/api/promos`), no en el navegador.
 */
export function PromoEditor() {
  const link = useLink();
  const { showToast } = useToast();
  const [pages, setPages] = useState<PromoPage[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** Landing cuyo QR se está mostrando, con su enlace ya absoluto. */
  const [qr, setQr] = useState<{ page: PromoPage; url: string } | null>(null);

  /** Ruta pública de una landing: la principal vive en `/promo` a secas. */
  const pathOf = useCallback(
    (page: PromoPage, principal: boolean) =>
      link(principal ? "/promo" : `/promo/${page.slug}`),
    [link]
  );

  /** Llama a la API y devuelve el JSON, con el mensaje de error del servidor. */
  const call = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(apiUrl(path), init);
      const data = (await res.json().catch(() => null)) as
        | (T & { error?: string })
        | null;
      if (!res.ok) throw new Error(data?.error || "No se pudo completar la acción.");
      return data as T;
    },
    []
  );

  // Carga la lista guardada.
  useEffect(() => {
    let alive = true;
    call<{ pages: PromoPage[] }>("/api/promos")
      .then(({ pages }) => {
        if (!alive) return;
        setPages(pages);
        setEditingId((id) => id ?? pages[0]?.id ?? null);
      })
      .catch(() => alive && showToast("No se pudieron cargar las landings"));
    return () => {
      alive = false;
    };
  }, [call, showToast]);

  /** Cambiar de landing con cambios sin guardar los perdería: se avisa. */
  const leaveGuard = () =>
    !dirty ||
    window.confirm("Tienes cambios sin guardar en esta landing. ¿Descartarlos?");

  const select = (id: string) => {
    if (id === editingId || !leaveGuard()) return;
    setDirty(false);
    setEditingId(id);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  /** Crea una landing en blanco o, con `copyFromId`, duplica una existente. */
  const create = (copyFromId?: string) =>
    run(async () => {
      if (!leaveGuard()) return;
      const { page, pages } = await call<{ page: PromoPage; pages: PromoPage[] }>(
        "/api/promos",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copyFromId ? { copyFromId } : {}),
        }
      );
      setDirty(false);
      setPages(pages);
      setEditingId(page.id);
      showToast(copyFromId ? "Landing duplicada" : "Landing creada");
    });

  /**
   * Publica o despublica una landing desde la lista misma.
   *
   * El interruptor del formulario solo cambia el borrador: no publica nada
   * hasta que se pulsa "Guardar landing". Acá el cambio SÍ viaja a la base al
   * instante, que es lo que uno espera al pulsar sobre la etiqueta "Borrador"
   * de la lista.
   */
  const setEnabled = (page: PromoPage, enabled: boolean) =>
    run(async () => {
      if (page.id === editingId) {
        if (!leaveGuard()) return;
        setDirty(false);
      }
      const saved = await call<PromoPage>(`/api/promos/${page.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...page, enabled }),
      });
      setPages((ps) => (ps ? ps.map((p) => (p.id === saved.id ? saved : p)) : ps));
      showToast(enabled ? "Landing publicada" : "Landing en borrador");
    });

  const makePrincipal = (id: string) =>
    run(async () => {
      const { pages } = await call<{ pages: PromoPage[] }>(`/api/promos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ principal: true }),
      });
      setPages(pages);
      showToast("Ahora es la landing principal (/promo)");
    });

  const remove = (page: PromoPage) =>
    run(async () => {
      if (
        !window.confirm(
          `Se borrará la landing “${page.name}” y su enlace dejará de funcionar. ¿Continuar?`
        )
      )
        return;
      const { pages } = await call<{ pages: PromoPage[] }>(`/api/promos/${page.id}`, {
        method: "DELETE",
      });
      setPages(pages);
      if (editingId === page.id) {
        setDirty(false);
        setEditingId(pages[0]?.id ?? null);
      }
      showToast("Landing borrada");
    });

  /** Vuelve a dejar una sola landing, la promo por defecto del rubro. */
  const resetAll = () =>
    run(async () => {
      if (
        !window.confirm(
          "Se borrarán TODAS las landings (textos, precios e imágenes) y quedará solo la promoción por defecto de tu rubro. ¿Continuar?"
        )
      )
        return;
      await call("/api/promo", { method: "DELETE" });
      const { pages } = await call<{ pages: PromoPage[] }>("/api/promos");
      setDirty(false);
      setPages(pages);
      setEditingId(pages[0]?.id ?? null);
      showToast("Landings restablecidas a los valores de tu rubro");
    });

  /** Enlace absoluto: es lo que se copia y lo que se codifica en el QR. */
  const absoluteUrl = (page: PromoPage, principal: boolean) =>
    `${window.location.origin}${pathOf(page, principal)}`;

  const copyLink = async (page: PromoPage, principal: boolean) => {
    const url = absoluteUrl(page, principal);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(page.id);
      setTimeout(() => setCopiedId((c) => (c === page.id ? null : c)), 2000);
      showToast("Enlace copiado");
    } catch {
      // Sin permiso de portapapeles (http, navegador viejo): al menos se ve.
      window.prompt("Copia el enlace de la landing:", url);
    }
  };

  const onSaved = useCallback((saved: PromoPage) => {
    setDirty(false);
    setPages((ps) => (ps ? ps.map((p) => (p.id === saved.id ? saved : p)) : ps));
  }, []);

  if (!pages) {
    return (
      <div className="flex items-center gap-2 rounded-[18px] border border-line bg-surface p-5 text-[13px] text-ink2 shadow-soft">
        <Loader2 size={16} className="animate-spin" /> Cargando las landings…
      </div>
    );
  }

  const editing = pages.find((p) => p.id === editingId) ?? pages[0];
  const editingIsPrincipal = editing?.id === pages[0]?.id;

  return (
    <div className="flex flex-col gap-4">
      <Card icon={<Sparkles size={18} />} title="Landings promocionales">
        <p className="-mt-1 text-[12.5px] text-ink2">
          Páginas públicas que promocionan un producto. Puedes tener varias (una por campaña,
          producto o público) y compartir el enlace de cada una por WhatsApp o redes. La{" "}
          <span className="font-semibold text-ink">principal</span> es la que se abre en{" "}
          <span className="font-semibold text-ink">{link("/promo")}</span>.
        </p>

        <div className="flex flex-col gap-2">
          {pages.map((page, i) => {
            const principal = i === 0;
            const active = page.id === editing?.id;
            return (
              <div
                key={page.id}
                className={`rounded-xl border p-3 transition-colors ${
                  active ? "border-pink bg-surface2/60" : "border-line bg-surface2/30"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => select(page.id)}
                    className="mr-auto min-w-0 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{page.name}</span>
                      {principal && <Tag tone="pink">Principal</Tag>}
                      <Tag tone={page.enabled ? "green" : "muted"}>
                        {page.enabled ? "Publicada" : "Borrador"}
                      </Tag>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-faint">
                      <Link2 size={12} />
                      {pathOf(page, principal)}
                    </span>
                  </button>

                  <IconAction
                    title={
                      page.enabled
                        ? "Despublicar: el enlace deja de mostrar la oferta"
                        : "Publicar: el enlace pasa a mostrar la oferta"
                    }
                    disabled={busy}
                    onClick={() => setEnabled(page, !page.enabled)}
                    icon={
                      page.enabled ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} className="text-emerald-600" />
                      )
                    }
                  />
                  <IconAction
                    title="QR de la landing"
                    onClick={() => setQr({ page, url: absoluteUrl(page, principal) })}
                    icon={<QrCode size={15} />}
                  />
                  <IconAction
                    title="Copiar enlace"
                    onClick={() => copyLink(page, principal)}
                    icon={
                      copiedId === page.id ? (
                        <Check size={15} className="text-emerald-500" />
                      ) : (
                        <Copy size={15} />
                      )
                    }
                  />
                  <a
                    href={pathOf(page, principal)}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir landing"
                    className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink2 hover:text-ink"
                  >
                    <ExternalLink size={15} />
                  </a>
                  <IconAction
                    title="Duplicar"
                    disabled={busy || pages.length >= MAX_PROMO_PAGES}
                    onClick={() => create(page.id)}
                    icon={<CopyPlus size={15} />}
                  />
                  {!principal && (
                    <IconAction
                      title="Hacer principal (/promo)"
                      disabled={busy}
                      onClick={() => makePrincipal(page.id)}
                      icon={<Star size={15} />}
                    />
                  )}
                  {pages.length > 1 && (
                    <IconAction
                      title="Borrar landing"
                      disabled={busy}
                      danger
                      onClick={() => remove(page)}
                      icon={<Trash2 size={15} />}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            onClick={() => create()}
            disabled={busy || pages.length >= MAX_PROMO_PAGES}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-dashed border-line px-4 py-2.5 text-[12.5px] font-semibold text-ink2 hover:text-ink disabled:opacity-40"
          >
            <Plus size={15} /> Nueva landing
          </button>
          <span className="text-[11.5px] text-faint">
            {pages.length} de {MAX_PROMO_PAGES}
          </span>
          <button
            onClick={resetAll}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink2 hover:text-ink disabled:opacity-50"
          >
            <RotateCcw size={15} /> Restablecer todo
          </button>
        </div>
      </Card>

      {editing && (
        <PromoPageForm
          key={editing.id}
          page={editing}
          isPrincipal={editingIsPrincipal}
          publicPath={pathOf(editing, editingIsPrincipal)}
          onSaved={onSaved}
          onDirtyChange={setDirty}
        />
      )}

      {qr && (
        <PromoQrDialog
          url={qr.url}
          name={qr.page.name}
          slug={qr.page.slug}
          onClose={() => setQr(null)}
        />
      )}
    </div>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "pink" | "green" | "muted";
}) {
  const cls = {
    pink: "bg-pink/12 text-pink",
    green: "bg-emerald-500/12 text-emerald-600",
    muted: "bg-ink/[0.06] text-ink2",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

function IconAction({
  icon,
  title,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink2 disabled:opacity-40 ${
        danger ? "hover:text-red-500" : "hover:text-ink"
      }`}
    >
      {icon}
    </button>
  );
}
