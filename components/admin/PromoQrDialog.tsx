"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download, ExternalLink, Printer, X } from "lucide-react";
import { PrimaryButton } from "@/components/ui";
import { useToast } from "@/context/StoreProvider";

/** Lado del QR que se genera. Se muestra chico, pero se descarga en alta. */
const QR_PX = 1024;

/**
 * QR del enlace de una landing, para pegarlo en el local, en un volante o en
 * una publicación.
 *
 * El canvas se dibuja a 1024 px aunque en pantalla se vea a 220: así lo que se
 * descarga sirve para imprimir, que es para lo que se pide un QR. Nivel de
 * corrección "M": aguanta un poco de tinta corrida sin agrandar el código.
 */
export function PromoQrDialog({
  url,
  name,
  slug,
  onClose,
}: {
  /** URL absoluta de la landing (la que se codifica). */
  url: string;
  name: string;
  slug: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const boxRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const canvas = () =>
    boxRef.current?.querySelector("canvas") as HTMLCanvasElement | null;

  const download = () => {
    const c = canvas();
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `qr-${slug || "landing"}.png`;
    a.click();
    showToast("QR descargado");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast("Enlace copiado");
    } catch {
      window.prompt("Copia el enlace de la landing:", url);
    }
  };

  /** Imprime solo el QR y el enlace, en una ventana aparte. */
  const print = () => {
    const c = canvas();
    if (!c) return;
    const win = window.open("", "_blank", "width=520,height=680");
    if (!win) {
      showToast("El navegador bloqueó la ventana de impresión.");
      return;
    }
    win.document.write(
      `<title>QR · ${name}</title>` +
        `<body style="font-family:system-ui,sans-serif;text-align:center;padding:32px">` +
        `<h1 style="font-size:20px;margin:0 0 6px">${name}</h1>` +
        `<p style="font-size:12px;color:#666;margin:0 0 20px;word-break:break-all">${url}</p>` +
        // El print va en el onload de la imagen: si se lanza antes de que
        // cargue, sale una hoja en blanco.
        `<img src="${c.toDataURL("image/png")}" style="width:340px;height:340px"` +
        ` onload="window.focus();window.print()" />` +
        `</body>`
    );
    win.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-5"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-[420px] overflow-y-auto rounded-[20px] bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold text-ink">QR de la landing</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-ink2">{name}</p>
          </div>
          <button onClick={onClose} className="text-ink2 hover:text-ink" aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        <div ref={boxRef} className="mt-4 grid place-items-center rounded-[16px] border border-line bg-white p-5">
          <QRCodeCanvas
            value={url}
            size={QR_PX}
            level="M"
            marginSize={2}
            style={{ width: 220, height: 220 }}
          />
        </div>

        <p className="mt-3 break-all rounded-xl bg-surface2 px-3 py-2 text-center text-[11.5px] text-ink2">
          {url}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <PrimaryButton label="Descargar PNG" icon={<Download size={17} />} onClick={download} />
          <button
            onClick={copy}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[12.5px] font-semibold text-ink shadow-soft"
          >
            {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
            Copiar enlace
          </button>
          <button
            onClick={print}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[12.5px] font-semibold text-ink shadow-soft"
          >
            <Printer size={15} /> Imprimir
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink2 hover:text-ink"
          >
            <ExternalLink size={15} /> Abrir
          </a>
        </div>

        <p className="mt-3 text-[11.5px] text-faint">
          El QR apunta a esta landing. Si cambias su dirección, vuelve a generarlo: el
          anterior deja de funcionar.
        </p>
      </div>
    </div>
  );
}
