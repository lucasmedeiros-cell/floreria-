"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Clock, Lock, QrCode } from "lucide-react";
import { bs, kPayReference, kWhatsapp, productById } from "@/lib/products";
import { useCart, useToast } from "@/context/StoreProvider";
import { openWhatsapp } from "@/lib/whatsapp";
import { WhatsAppIcon } from "./WhatsAppIcon";

/**
 * Flujo de pago (QR → confirmación → datos) que se renderiza EN LÍNEA dentro
 * del panel del carrito, no como ventana emergente.
 */
export function PaymentPanel({ onDone }: { onDone: () => void }) {
  const cart = useCart();
  const { showToast } = useToast();
  const [paid, setPaid] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const auto = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snapshot del pedido (sobrevive al vaciado del carrito).
  const snapshot = useMemo(() => {
    const lines = cart.ids.map((id) => ({ p: productById(id), qty: cart.qty(id) }));
    const total = cart.total;
    const count = cart.count;
    const payload = `${kPayReference}|TOTAL=${total}|ITEMS=${count}|TS=${Date.now()}`;
    return { lines, total, count, payload };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    auto.current = setTimeout(() => setPaid(true), 8000);
    return () => {
      if (auto.current) clearTimeout(auto.current);
    };
  }, []);

  const confirm = () => {
    if (auto.current) clearTimeout(auto.current);
    setPaid(true);
  };

  const whatsapp = () => {
    if (name.trim() === "") return showToast("Ingresa tu nombre completo");
    if (phone.trim() === "") return showToast("Ingresa tu número de teléfono");
    const lines = snapshot.lines
      .map((e) => `• ${e.qty}x ${e.p.name} — ${bs(e.p.price * e.qty)}`)
      .join("\n");
    const msg =
      `*Nuevo pedido — FloresOnline* 🌷\n` +
      `Pago confirmado por EasyPay ✅\n\n` +
      `${lines}\n\n` +
      `*Total: ${bs(snapshot.total)}*\n\n` +
      `Cliente: ${name.trim()}\n` +
      `Teléfono: ${phone.trim()}`;
    showToast("Abriendo WhatsApp…");
    openWhatsapp(msg, kWhatsapp);
    cart.clear();
    onDone();
  };

  if (!paid) {
    return (
      <div className="flex flex-col items-center">
        <div className="mx-auto mb-4 mt-8 text-pink">
          <QrCode size={46} />
        </div>
        <h2 className="text-center text-[1.55rem] font-semibold leading-tight text-ink">
          Escanea el QR
          <br />
          para pagar
        </h2>
        <p className="mt-2.5 text-center text-[.9rem] text-faint">
          Escanea el código con tu celular.
        </p>
        <div className="mt-2 flex items-center rounded-full bg-[#fafafa] px-4 py-2.5">
          <span className="text-[.85rem] text-ink2">Total a pagar&nbsp;&nbsp;</span>
          <span className="text-[.95rem] font-semibold text-ink">
            {bs(snapshot.total)}
          </span>
        </div>
        <div className="mt-[22px] grid h-[240px] w-[240px] place-items-center rounded-[18px] bg-[#fafafa] p-[22px]">
          <QRCodeCanvas
            value={snapshot.payload}
            size={196}
            fgColor="#111111"
            bgColor="#fafafa"
          />
        </div>
        <button
          onClick={confirm}
          className="mt-[18px] rounded-full border border-dashed border-pink bg-white px-[18px] py-2 text-[.78rem] text-pink"
        >
          Simular pago confirmado (demo)
        </button>
        <div className="mt-auto pt-10 text-center">
          <div className="mx-auto flex justify-center text-pink [animation:pulse-soft_1.6s_ease-in-out_infinite]">
            <Clock size={30} />
          </div>
          <div className="mt-2 text-[.95rem] text-faint">Esperando pago</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="pop-in mx-auto mb-[22px] mt-[46px] grid h-[84px] w-[84px] place-items-center rounded-full border-[3px] border-greenOk text-greenOk">
        <Check size={44} />
      </div>
      <h2 className="text-center text-[1.45rem] font-semibold text-ink">
        Pago recibido
      </h2>
      <p className="mx-auto mt-2 max-w-[240px] text-center text-[.9rem] text-faint">
        ¡Gracias! Tu pago fue procesado correctamente.
      </p>
      <div className="my-[26px] h-px bg-line" />
      <h3 className="mb-[18px] text-[1.15rem] font-semibold text-ink">
        Completa tus datos
      </h3>
      <label className="mb-2 block text-[.85rem] text-ink2">Nombre completo</label>
      <Field value={name} onChange={setName} placeholder="Ingresa tu nombre completo" />
      <label className="mb-2 mt-[18px] block text-[.85rem] text-ink2">
        Número de teléfono
      </label>
      <Field value={phone} onChange={setPhone} placeholder="Ej. 71234567" type="tel" />
      <button
        onClick={whatsapp}
        className="mt-[26px] flex w-full items-center justify-center gap-2.5 rounded-[12px] bg-pink py-[15px] text-[.98rem] font-semibold text-white transition-colors hover:bg-pinkDeep"
      >
        <WhatsAppIcon size={20} /> Continuar por WhatsApp
      </button>
      <div className="mt-[18px] flex items-center justify-center gap-[7px] text-[.82rem] text-faint">
        <Lock size={14} />
        <span>Tus datos están seguros con nosotros.</span>
      </div>
    </div>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      className="w-full rounded-[12px] border border-line px-4 py-3.5 text-[.9rem] text-ink outline-none transition-colors focus:border-pink"
    />
  );
}
