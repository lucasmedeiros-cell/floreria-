"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { bs, productById } from "@/lib/products";
import { useCart } from "@/context/StoreProvider";

export function MiniCart({
  onViewCart,
  onPay,
}: {
  onViewCart: () => void;
  onPay: () => void;
}) {
  const cart = useCart();
  const [show, setShow] = useState(false);
  const [item, setItem] = useState<string | null>(null);
  const [qty, setQty] = useState(0);
  const seen = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cart.addTick !== seen.current) {
      seen.current = cart.addTick;
      setItem(cart.lastAdded);
      setQty(cart.lastAddedQty);
      setShow(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShow(false), 4000);
    }
  }, [cart.addTick, cart.lastAdded, cart.lastAddedQty]);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  };

  const p = item ? productById(item) : null;

  return (
    <div className="pointer-events-none fixed right-3 top-[92px] z-[55] md:right-5 md:top-[120px]">
      <div
        className={`transition-all duration-300 ${
          show
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "translate-x-[120%] opacity-0"
        }`}
      >
        {p && (
          <div className="w-[322px] max-w-[calc(100vw-24px)] rounded-[18px] border border-line bg-white p-3.5 shadow-[0_6px_24px_rgba(0,0,0,0.12)]">
            <div className="flex items-center">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-greenOk text-white">
                <Check size={14} />
              </span>
              <span className="ml-2.5 text-[.82rem] font-bold text-ink">
                Agregado al carrito
              </span>
              <button onClick={hide} className="ml-auto p-0.5 text-faint">
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-xl">
                <Image src={p.image} alt={p.name} fill sizes="56px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[.82rem] font-semibold text-ink">
                  {qty} × {p.name}
                </p>
                <p className="text-[1.05rem] font-bold text-pink">
                  {bs(p.price * qty)}
                </p>
              </div>
            </div>
            <div className="mt-3.5 flex gap-2.5">
              <button
                onClick={() => {
                  hide();
                  onViewCart();
                }}
                className="flex-1 rounded-[10px] border border-pink py-2.5 text-[.82rem] font-semibold text-pink transition-colors hover:bg-pinkSoft"
              >
                Ver carrito
              </button>
              <button
                onClick={() => {
                  hide();
                  onPay();
                }}
                className="flex-1 rounded-[10px] bg-pink py-2.5 text-[.82rem] font-semibold text-white transition-colors hover:bg-pinkDeep"
              >
                Pagar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
