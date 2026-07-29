"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Star, Trash2 } from "lucide-react";
import { useToast } from "@/context/StoreProvider";
import { dataUrlSize, uploadImageFile } from "@/lib/imageUpload";

/**
 * Varias fotos para un mismo elemento (hoy, un producto).
 *
 * Se pueden soltar VARIOS archivos de una vez, elegirlos o pegarlos con Ctrl+V;
 * se suben en fila y se agregan al final. La PRIMERA es la principal: es la que
 * se ve en la tarjeta del catálogo, en el ticket y en la app, así que hay un
 * botón para ascender cualquiera a esa posición.
 */
export function ImageGalleryField({
  label,
  values,
  onChange,
  hint,
  max = 6,
  maxSide,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  hint?: string;
  /** Tope de fotos. Más que esto no entra en la galería de la tienda. */
  max?: number;
  maxSide?: number;
}) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const [manual, setManual] = useState("");

  const libre = max - values.length;

  const take = async (files: File[]) => {
    if (files.length === 0 || busy > 0) return;
    if (libre <= 0) return showToast(`Solo se pueden subir ${max} fotos.`);

    const lote = files.slice(0, libre);
    if (files.length > lote.length) {
      showToast(`Se subirán ${lote.length}: el tope es de ${max} fotos.`);
    }

    setBusy(lote.length);
    const subidas: string[] = [];
    for (const file of lote) {
      try {
        subidas.push(await uploadImageFile(file, maxSide));
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "No se pudo subir una de las fotos."
        );
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (subidas.length > 0) {
      onChange([...values, ...subidas]);
      showToast(subidas.length === 1 ? "Foto subida" : `${subidas.length} fotos subidas`);
    }
  };

  /** Archivos de imagen de un arrastre o de un pegado (pueden ser varios). */
  const filesFrom = (dt: DataTransfer | null): File[] => {
    if (!dt) return [];
    const files = Array.from(dt.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) return files;
    return Array.from(dt.items ?? [])
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => !!f);
  };

  const quitar = (i: number) => onChange(values.filter((_, k) => k !== i));

  const principal = (i: number) =>
    onChange([values[i], ...values.filter((_, k) => k !== i)]);

  const agregarRuta = () => {
    const v = manual.trim();
    if (v === "") return;
    if (values.length >= max) return showToast(`Solo se pueden tener ${max} fotos.`);
    onChange([...values, v]);
    setManual("");
  };

  return (
    <div>
      <span className="text-[12px] font-semibold text-ink2">
        {label}
        {values.length > 0 && (
          <span className="ml-1.5 font-normal text-faint">
            {values.length} de {max}
          </span>
        )}
      </span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(filesFrom(e.dataTransfer));
        }}
        onPaste={(e) => take(filesFrom(e.clipboardData))}
        className={`mt-1.5 rounded-xl border-2 border-dashed p-3 transition-colors ${
          over ? "border-pink bg-pink/[0.06]" : "border-line bg-surface2"
        }`}
      >
        {values.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {values.map((src, i) => (
              <div
                key={`${src.slice(0, 24)}-${i}`}
                className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${label} ${i + 1}`} className="h-full w-full object-contain" />

                {i === 0 ? (
                  <span className="absolute left-1 top-1 rounded-full bg-pink px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink">
                    Principal
                  </span>
                ) : (
                  <button
                    type="button"
                    title="Hacer principal"
                    onClick={() => principal(i)}
                    className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink2 shadow-soft hover:text-ink"
                  >
                    <Star size={12} />
                  </button>
                )}

                <button
                  type="button"
                  title="Quitar foto"
                  onClick={() => quitar(i)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink2 shadow-soft hover:text-red-500"
                >
                  <Trash2 size={12} />
                </button>

                {dataUrlSize(src) && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-center text-[9.5px] font-medium text-white">
                    {dataUrlSize(src)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy > 0 || libre <= 0}
          className="flex w-full flex-col items-center gap-1.5 px-3 py-5 text-center disabled:opacity-60"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink2">
            {busy > 0 ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
          </span>
          <span className="text-[13px] font-semibold text-ink">
            {busy > 0
              ? `Subiendo ${busy} foto${busy === 1 ? "" : "s"}…`
              : libre <= 0
                ? `Llegaste al tope de ${max} fotos`
                : values.length === 0
                  ? "Arrastra las fotos o haz clic para elegirlas"
                  : "Arrastra más fotos o haz clic para agregarlas"}
          </span>
          <span className="text-[11.5px] text-faint">
            JPG, PNG o WebP · hasta 6 MB cada una · puedes soltar varias juntas
          </span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          take(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <div className="mt-2 flex items-center gap-2">
        <div className="flex flex-1 items-center overflow-hidden rounded-xl border border-line bg-surface2 focus-within:border-pink">
          <span className="pl-3 text-ink2">
            <Link2 size={14} />
          </span>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregarRuta())}
            placeholder="…o pega una ruta / enlace: /images/foto.jpg"
            className="w-full bg-transparent px-2.5 py-2.5 text-[13px] text-ink outline-none placeholder:text-faint"
          />
        </div>
        <button
          type="button"
          onClick={agregarRuta}
          disabled={manual.trim() === ""}
          className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink2 hover:text-ink disabled:opacity-40"
        >
          Agregar
        </button>
      </div>

      {hint && <p className="mt-1 text-[11.5px] text-faint">{hint}</p>}
    </div>
  );
}
