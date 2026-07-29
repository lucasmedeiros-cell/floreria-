"use client";

import { useState } from "react";
import { Check, Images, Minus, Plus, ShoppingCart } from "lucide-react";
import { Product, bs, productPhotos } from "@/lib/products";
import { useCart, useToast } from "@/context/StoreProvider";
import { ProductImage } from "./ProductImage";

/**
 * Tarjeta de producto — estilo ".pcard" del mockup. Sin foto cae al placeholder
 * del rubro; con varias, avisa cuántas hay y abre la ficha completa al tocarla.
 */
export function ProductCard({
  product: p,
  index,
  onOpen,
}: {
  product: Product;
  index: number;
  /** Abre la ficha del producto (fotos + información). */
  onOpen?: () => void;
}) {
  const cart = useCart();
  const { showToast } = useToast();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const add = () => {
    cart.add(p.id, qty);
    setAdded(true);
    setQty(1);
    showToast(`${p.id} agregado al carrito`);
    setTimeout(() => setAdded(false), 700);
  };

  const num = String(index + 1).padStart(2, "0");
  const fotos = productPhotos(p);
  const agotado = typeof p.stock === "number" && p.stock <= 0;

  return (
    <div className="group flex flex-col rounded-[14px] border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
      {/* Foto: abre la ficha con todas las fotos y la información completa. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver ${p.name}`}
        className="relative mb-3.5 aspect-square overflow-hidden rounded-[10px]"
      >
        <ProductImage
          src={fotos[0] ?? ""}
          alt={p.name}
          sizes="(max-width:520px) 50vw,(max-width:860px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          iconSize={40}
        />
        {fotos.length > 1 && (
          <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
            <Images size={11} /> {fotos.length}
          </span>
        )}
        {agotado && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            Sin stock
          </span>
        )}
      </button>

      {/* Nombre */}
      <button
        type="button"
        onClick={onOpen}
        className="min-h-[38px] px-1 text-center text-[12.5px] font-semibold leading-snug text-ink hover:underline"
      >
        <span className="text-ink">{num}.</span> {p.id} · {p.name}
      </button>

      {/* Descripción corta: lo que el negocio cargó como palabras clave. */}
      {p.desc?.trim() && (
        <p className="mt-1 line-clamp-2 px-1 text-center text-[11.5px] leading-snug text-ink2">
          {p.desc}
        </p>
      )}

      {/* Precio */}
      <div className="my-3 text-center text-[18px] font-semibold text-ink">
        {bs(p.price)}
      </div>

      {/* Stepper + agregar */}
      <div className="mt-auto flex items-center gap-2.5">
        <div className="flex flex-1 items-center overflow-hidden rounded-[10px] border border-line">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="grid h-[38px] w-[34px] place-items-center bg-[#fafafa] text-ink2 transition-colors hover:bg-[#f0f0f0]"
            aria-label="Quitar"
          >
            <Minus size={15} />
          </button>
          <span className="flex-1 text-center text-[14px] font-medium text-ink">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            className="grid h-[38px] w-[34px] place-items-center bg-[#fafafa] text-ink2 transition-colors hover:bg-[#f0f0f0]"
            aria-label="Agregar uno"
          >
            <Plus size={15} />
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          aria-label={`Agregar ${p.name} al carrito`}
          className={`grid h-[40px] w-[52px] place-items-center rounded-[10px] transition-colors ${
            added ? "bg-greenOk text-white" : "bg-pink text-onAccent hover:bg-pinkDeep"
          }`}
        >
          {added ? <Check size={20} /> : <ShoppingCart size={19} />}
        </button>
      </div>
    </div>
  );
}
