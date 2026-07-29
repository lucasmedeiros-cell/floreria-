"use client";

import { useState } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import { Product, bs, productPhotos } from "@/lib/products";
import { useBusiness, useCart, useToast } from "@/context/StoreProvider";
import { openWhatsapp, useBusinessWhatsapp } from "@/lib/whatsapp";
import { Icon } from "./Icon";
import { WhatsAppIcon } from "./WhatsAppIcon";

/**
 * Ficha del producto: TODAS sus fotos y toda su información.
 *
 * La usan la tienda y la landing. En la tienda se agrega al carrito; en la
 * landing no hay carrito a la vista, así que el pedido sale por WhatsApp con el
 * producto ya escrito (`onAdd` ausente ⇒ modo landing).
 */
export function ProductDetail({
  product: p,
  onClose,
  onAdd,
}: {
  product: Product;
  onClose: () => void;
  /** Agregar al carrito. Sin esto, el CTA es pedir por WhatsApp. */
  onAdd?: (qty: number) => void;
}) {
  const business = useBusiness();
  const waNumber = useBusinessWhatsapp();
  const [qty, setQty] = useState(1);
  const [foto, setFoto] = useState(0);

  const fotos = productPhotos(p);
  const actual = fotos[Math.min(foto, fotos.length - 1)] ?? "";
  const agotado = typeof p.stock === "number" && p.stock <= 0;

  const pedir = () =>
    openWhatsapp(
      `${business.greeting} Quiero pedir ${qty} × *${p.name}* (${p.id}) — ${bs(p.price)}.`,
      waNumber
    );

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-[860px] overflow-y-auto rounded-t-[22px] bg-white sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-7">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-ink2">
              {p.category}
            </span>
            <h2 className="mt-1 text-[22px] font-semibold leading-tight text-ink">{p.name}</h2>
            <p className="mt-0.5 text-[12px] text-faint">Código {p.id}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink2 hover:text-ink">
            <X size={22} />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-7">
          {/* ---- Fotos ---- */}
          <div>
            <div className="relative aspect-square overflow-hidden rounded-[16px] border border-line bg-bg">
              {actual ? (
                <Image
                  src={actual}
                  alt={p.name}
                  fill
                  sizes="(max-width:640px) 92vw, 40vw"
                  className="object-contain"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-ink2 opacity-70">
                  <Icon name={business.rubro.icon} size={80} />
                </div>
              )}
            </div>

            {fotos.length > 1 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {fotos.map((src, i) => (
                  <button
                    key={`${src.slice(0, 24)}-${i}`}
                    onClick={() => setFoto(i)}
                    aria-label={`Foto ${i + 1}`}
                    className={`relative h-14 w-14 overflow-hidden rounded-[10px] border-2 transition-colors ${
                      i === foto ? "border-pink" : "border-line hover:border-ink2"
                    }`}
                  >
                    <Image src={src} alt={`${p.name} ${i + 1}`} fill sizes="56px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---- Información ---- */}
          <div className="flex flex-col">
            <span className="text-[30px] font-semibold leading-none text-ink">{bs(p.price)}</span>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  agotado ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-700"
                }`}
              >
                {agotado ? "Sin stock" : "Disponible"}
              </span>
              {typeof p.stock === "number" && !agotado && (
                <span className="text-[12px] text-ink2">{p.stock} en existencia</span>
              )}
              {p.barcode && (
                <span className="text-[12px] text-faint">Código de barras {p.barcode}</span>
              )}
            </div>

            {p.desc?.trim() ? (
              <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-ink2">
                {p.desc}
              </p>
            ) : (
              <p className="mt-4 text-[13.5px] italic text-faint">
                Este producto todavía no tiene descripción.
              </p>
            )}

            <div className="mt-6 flex items-center gap-2.5">
              <div className="flex items-center overflow-hidden rounded-[10px] border border-line">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-11 w-11 place-items-center text-ink2 hover:text-ink"
                  aria-label="Quitar uno"
                >
                  <Minus size={16} />
                </button>
                <span className="w-9 text-center text-[15px] font-semibold text-ink">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="grid h-11 w-11 place-items-center text-ink2 hover:text-ink"
                  aria-label="Agregar uno"
                >
                  <Plus size={16} />
                </button>
              </div>

              {onAdd ? (
                <button
                  onClick={() => {
                    onAdd(qty);
                    onClose();
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-pink px-5 py-3 text-[13.5px] font-semibold text-ink"
                >
                  <ShoppingCart size={17} /> Agregar al carrito
                </button>
              ) : (
                <button
                  onClick={pedir}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-pink px-5 py-3 text-[13.5px] font-semibold text-ink"
                >
                  <WhatsAppIcon size={17} /> Pedir por WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Igual que ProductDetail, pero enganchado al carrito de la tienda. */
export function ProductDetailTienda({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const cart = useCart();
  const { showToast } = useToast();
  return (
    <ProductDetail
      product={product}
      onClose={onClose}
      onAdd={(qty) => {
        cart.add(product.id, qty);
        showToast(`${product.id} agregado al carrito`);
      }}
    />
  );
}
