"use client";

import Image from "next/image";
import { ChevronRight, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { bs, productById } from "@/lib/products";
import { useCart } from "@/context/StoreProvider";

export function CartDrawer({
  open,
  onClose,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  /** Abre WhatsApp con el resumen del pedido. */
  onContinue: () => void;
}) {
  const cart = useCart();
  const ids = cart.ids;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-[rgba(20,20,20,0.32)] transition-opacity duration-[250ms] ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-[70] flex h-full w-[92vw] max-w-[430px] flex-col bg-white shadow-[-12px_0_40px_rgba(0,0,0,0.14)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 pt-[22px]">
          <button
            onClick={onClose}
            className="text-[1.4rem] leading-none text-ink2"
            aria-label="Cerrar"
          >
            <X size={26} />
          </button>
        </div>

        {/* ===== Carrito ===== */}
        <div className="flex items-center justify-between px-6 pt-3.5">
          <h3 className="text-[1.45rem] font-semibold text-ink">
            Carrito de Compras
          </h3>
          <span className="relative text-pink">
            <ShoppingCart size={30} />
            <span className="absolute -right-2 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-pink text-[.7rem] font-semibold text-white">
              {cart.count}
            </span>
          </span>
        </div>

        {ids.length > 0 && (
          <button
            onClick={cart.clear}
            className="px-6 pb-3.5 pt-1.5 text-right text-[.82rem] font-medium text-pink"
          >
            Vaciar Carrito
          </button>
        )}

        <div className="flex-1 overflow-y-auto px-6 pt-1">
          {ids.length === 0 ? (
            <div className="grid h-full place-items-center px-10 text-center text-[.9rem] text-faint">
              <p>
                Tu carrito está vacío.
                <br />
                Agrega un arreglo para empezar 🌷
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 pb-2">
              {ids.map((id) => (
                <CartItem key={id} id={id} />
              ))}
            </div>
          )}
        </div>

        {/* Continuar el pedido por WhatsApp */}
        <div className="px-6 pb-6 pt-4">
          <button
            onClick={onContinue}
            disabled={ids.length === 0}
            className="flex w-full items-center gap-3 rounded-[14px] bg-pink px-4 py-3.5 text-white transition-colors hover:bg-pinkDeep disabled:cursor-not-allowed disabled:opacity-50"
          >
            <WhatsAppIcon size={22} />
            <span className="flex-1 text-left text-[1rem] font-semibold">
              Continuar con el pedido
            </span>
            <span className="text-[1rem] font-semibold">{bs(cart.total)}</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </aside>
    </>
  );
}

function CartItem({ id }: { id: string }) {
  const cart = useCart();
  const p = productById(id);
  const q = cart.qty(id);
  return (
    <div className="flex items-center gap-3.5 rounded-[14px] border border-line p-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[10px]">
        <Image src={p.image} alt={p.name} fill sizes="64px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[.82rem] font-semibold leading-tight text-ink">
          {p.name}
        </p>
        <p className="truncate text-[.74rem] text-faint">{p.desc}</p>
        <p className="mt-1.5 text-[.9rem] font-semibold text-ink">
          {bs(p.price * q)}
        </p>
      </div>
      <div className="flex items-center overflow-hidden rounded-[10px] border border-line">
        <button
          onClick={() => cart.change(id, -1)}
          className="grid h-[34px] w-[30px] place-items-center bg-[#fafafa] text-ink2"
          aria-label="Quitar uno"
        >
          <Minus size={14} />
        </button>
        <span className="w-[34px] text-center text-[.85rem] font-medium">{q}</span>
        <button
          onClick={() => cart.change(id, 1)}
          className="grid h-[34px] w-[30px] place-items-center bg-[#fafafa] text-ink2"
          aria-label="Agregar uno"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
