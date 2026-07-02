"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { Product, bs } from "@/lib/products";
import { useCart, useToast } from "@/context/StoreProvider";

/** Tarjeta de producto — estilo ".pcard" del mockup, con foto real. */
export function ProductCard({
  product: p,
  index,
}: {
  product: Product;
  index: number;
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

  return (
    <div className="group flex flex-col rounded-[14px] border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
      {/* Foto */}
      <div className="relative mb-3.5 aspect-square overflow-hidden rounded-[10px]">
        <Image
          src={p.image}
          alt={p.name}
          fill
          sizes="(max-width:520px) 50vw,(max-width:860px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
      </div>

      {/* Nombre */}
      <div className="min-h-[38px] px-1 text-center text-[12.5px] font-semibold leading-snug text-ink">
        <span className="text-pink">{num}.</span> {p.id} · {p.name}
      </div>

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
          className={`grid h-[40px] w-[52px] place-items-center rounded-[10px] text-white transition-colors ${
            added ? "bg-greenOk" : "bg-pink hover:bg-pinkDeep"
          }`}
        >
          {added ? <Check size={20} /> : <ShoppingCart size={19} />}
        </button>
      </div>
    </div>
  );
}
