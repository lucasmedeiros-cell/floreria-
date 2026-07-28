"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { useToast } from "@/context/StoreProvider";
import {
  dataUrlSize,
  imageFromTransfer,
  uploadImageFile,
} from "@/lib/imageUpload";

/**
 * Campo de imagen del CRM: se arrastra el archivo desde el escritorio (o se
 * hace clic, o se pega con Ctrl+V) y se sube; queda la vista previa con su peso.
 *
 * Sigue admitiendo escribir una ruta a mano (`/images/foto.jpg`) para las
 * imágenes que ya vienen del rubro o que están en `public/`: por eso el enlace
 * "Usar una ruta o enlace" en vez de quitar esa opción.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);

  const take = async (file: File | null) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      onChange(await uploadImageFile(file));
      showToast("Imagen subida");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setBusy(false);
    }
  };

  /** Soltar, pegar y elegir terminan todos acá. */
  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      take(imageFromTransfer(e.dataTransfer));
    },
    onPaste: (e: React.ClipboardEvent) => take(imageFromTransfer(e.clipboardData)),
  };

  const size = dataUrlSize(value);

  return (
    <div>
      <span className="text-[12px] font-semibold text-ink2">{label}</span>

      <div
        {...dropProps}
        className={`mt-1.5 rounded-xl border-2 border-dashed p-3 transition-colors ${
          over ? "border-pink bg-pink/[0.06]" : "border-line bg-surface2"
        }`}
      >
        {value.trim() === "" ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-1.5 px-3 py-6 text-center disabled:opacity-60"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink2">
              {busy ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
            </span>
            <span className="text-[13px] font-semibold text-ink">
              {busy ? "Subiendo…" : "Arrastra una imagen o haz clic para elegirla"}
            </span>
            <span className="text-[11.5px] text-faint">
              JPG, PNG o WebP · hasta 6 MB · también puedes pegarla con Ctrl+V
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              className="h-16 w-16 shrink-0 rounded-lg border border-line bg-surface object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-ink">
                {value.startsWith("data:")
                  ? `Imagen subida${size ? ` · ${size}` : ""}`
                  : value}
              </p>
              <p className="mt-0.5 text-[11px] text-faint">
                {busy
                  ? "Subiendo…"
                  : "Arrastra otra imagen para reemplazarla. Si no se ve, la ruta no existe."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              title="Cambiar imagen"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink2 hover:text-ink disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={busy}
              title="Quitar imagen"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink2 hover:text-red-500 disabled:opacity-40"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0] ?? null);
          // Se limpia para poder volver a elegir el MISMO archivo después.
          e.target.value = "";
        }}
      />

      {manual ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/images/promo.jpg"
          autoFocus
          className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-pink"
        />
      ) : (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ink2 hover:text-ink"
        >
          <Link2 size={13} /> Usar una ruta o enlace
        </button>
      )}

      {hint && <p className="mt-1 text-[11.5px] text-faint">{hint}</p>}
    </div>
  );
}
