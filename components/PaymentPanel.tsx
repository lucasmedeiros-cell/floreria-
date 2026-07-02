"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Clock, Lock, QrCode, RefreshCw } from "lucide-react";
import { bs, kWhatsapp, productById } from "@/lib/products";
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

  // Snapshot del pedido (sobrevive al vaciado del carrito).
  const snapshot = useMemo(() => {
    const lines = cart.ids.map((id) => ({ p: productById(id), qty: cart.qty(id) }));
    const total = cart.total;
    const count = cart.count;
    const gloss = lines
      .map((e) => `${e.qty}x ${e.p.name}`)
      .join(", ")
      .slice(0, 120);
    return { lines, total, count, gloss };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- QR dinámico del BCP (BaaS) ----
  const [qr, setQr] = useState<{
    image: string;
    correlativo: string;
    qrId: number | null;
  } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  // Datos del pago confirmado (para dejar constancia en el pedido).
  const payInfo = useRef<{ operationNumber?: string | null; fecha?: string | null }>({});

  const genQR = useCallback(async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await fetch("/api/payments/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: snapshot.total, gloss: snapshot.gloss }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo generar el QR");
      setQr({ image: data.qrImage, correlativo: data.correlativo, qrId: data.qrId ?? null });
    } catch (e) {
      setQrError(e instanceof Error ? e.message : "No se pudo generar el QR");
    } finally {
      setQrLoading(false);
    }
  }, [snapshot.total, snapshot.gloss]);

  // Genera el QR al entrar al paso de pago.
  useEffect(() => {
    genQR();
  }, [genQR]);

  // Polling del estado del pago cada 3.5 s mientras el QR está visible.
  useEffect(() => {
    if (!qr || paid) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/payments/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correlativo: qr.correlativo, qrId: qr.qrId }),
        });
        const e = await res.json();
        if (e?.pagado) {
          payInfo.current = { operationNumber: e.operationNumber, fecha: e.fecha };
          setPaid(true);
        }
      } catch {
        /* reintenta en el próximo tick */
      }
    }, 3500);
    return () => clearInterval(id);
  }, [qr, paid]);

  const [sending, setSending] = useState(false);

  // Registra la venta en la base de datos (aparece en el CRM, canal "web").
  const registerSale = async () => {
    const today = new Date();
    const deliveryDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const body = {
      clientName: name.trim(),
      phone: phone.trim(),
      deliveryDate,
      payMethod: "QR / Transferencia",
      status: "programado",
      orderNotes:
        "Pedido de la tienda web · Pago QR BCP" +
        (payInfo.current.operationNumber
          ? ` · Op. ${payInfo.current.operationNumber}`
          : ""),
      items: snapshot.lines.map((e) => ({
        productId: e.p.id,
        name: e.p.name,
        detail: e.p.desc ?? "",
        qty: e.qty,
        unitPrice: e.p.price,
        discountPct: 0,
        image: e.p.image ?? null,
      })),
    };
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "No se pudo registrar el pedido");
    return data as { code: string };
  };

  const whatsapp = async () => {
    if (name.trim() === "") return showToast("Ingresa tu nombre completo");
    if (phone.trim() === "") return showToast("Ingresa tu número de teléfono");
    if (sending) return;

    setSending(true);
    let code = "";
    try {
      const created = await registerSale();
      code = created.code ?? "";
      showToast(`Pedido ${code} registrado ✅`);
    } catch {
      // Si la BD falla, no bloqueamos al cliente: seguimos por WhatsApp.
      showToast("Abriendo WhatsApp…");
    } finally {
      setSending(false);
    }

    const lines = snapshot.lines
      .map((e) => `• ${e.qty}x ${e.p.name} — ${bs(e.p.price * e.qty)}`)
      .join("\n");
    const msg =
      `¡Hola FloresOnline! 🌸\n\n` +
      `Acabo de hacer un pedido desde la tienda web y ya realicé el pago con QR ✅\n\n` +
      (code ? `🧾 *Pedido ${code}*\n\n` : "") +
      `🌷 *Mi pedido:*\n${lines}\n\n` +
      `💰 *Total pagado: ${bs(snapshot.total)}*\n\n` +
      `👤 ${name.trim()}\n` +
      `📱 ${phone.trim()}\n\n` +
      `¿Me pueden confirmar la entrega, por favor? ¡Muchas gracias! 💐`;
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
          Paga con la app de tu banco (QR BCP).
        </p>
        <div className="mt-2 flex items-center rounded-full bg-[#fafafa] px-4 py-2.5">
          <span className="text-[.85rem] text-ink2">Total a pagar&nbsp;&nbsp;</span>
          <span className="text-[.95rem] font-semibold text-ink">
            {bs(snapshot.total)}
          </span>
        </div>

        <div className="mt-[22px] grid h-[240px] w-[240px] place-items-center overflow-hidden rounded-[18px] bg-white p-[14px] shadow-[0_2px_16px_rgba(0,0,0,0.08)]">
          {qrLoading ? (
            <div className="flex flex-col items-center gap-2 text-faint">
              <RefreshCw size={26} className="animate-spin" />
              <span className="text-[.8rem]">Generando QR…</span>
            </div>
          ) : qrError ? (
            <div className="flex flex-col items-center gap-2 px-3 text-center">
              <AlertCircle size={26} className="text-pink" />
              <span className="text-[.78rem] text-ink2">{qrError}</span>
              <button
                onClick={genQR}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-pink px-3 py-1.5 text-[.78rem] text-pink"
              >
                <RefreshCw size={14} /> Reintentar
              </button>
            </div>
          ) : qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr.image}
              alt="QR de pago BCP"
              width={212}
              height={212}
              className="h-full w-full object-contain"
            />
          ) : null}
        </div>

        {process.env.NODE_ENV !== "production" && qr && (
          <button
            onClick={() => setPaid(true)}
            className="mt-[14px] rounded-full border border-dashed border-pink bg-white px-[18px] py-2 text-[.74rem] text-pink"
          >
            Simular pago confirmado (solo dev)
          </button>
        )}

        <div className="mt-auto pt-8 text-center">
          <div className="mx-auto flex justify-center text-pink [animation:pulse-soft_1.6s_ease-in-out_infinite]">
            <Clock size={30} />
          </div>
          <div className="mt-2 text-[.95rem] text-faint">
            {qr ? "Esperando confirmación del pago…" : "Preparando el cobro…"}
          </div>
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
        disabled={sending}
        className="mt-[26px] flex w-full items-center justify-center gap-2.5 rounded-[12px] bg-pink py-[15px] text-[.98rem] font-semibold text-white transition-colors hover:bg-pinkDeep disabled:opacity-60"
      >
        <WhatsAppIcon size={20} /> {sending ? "Registrando…" : "Continuar por WhatsApp"}
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
