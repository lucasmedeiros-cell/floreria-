import { useEffect, useState } from "react";
import { kWhatsapp } from "./products";

/**
 * Abre WhatsApp con el texto prellenado. A prueba de bloqueadores de popups:
 * intenta abrir en pestaña nueva y, si el navegador la bloquea (window.open
 * devuelve null), navega en la MISMA pestaña — que nunca se bloquea.
 */
export function openWhatsapp(text: string, phone: string = kWhatsapp) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  openUrl(url);
}

export function openWhatsappRaw(phone: string) {
  openUrl(`https://wa.me/${phone}`);
}

function openUrl(url: string) {
  let win: Window | null = null;
  try {
    win = window.open(url, "_blank");
  } catch {
    win = null;
  }
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* noop */
    }
  } else {
    // Popup bloqueado (o entorno que lo impide): abrir en la misma pestaña.
    window.location.href = url;
  }
}

/**
 * Número de WhatsApp del negocio para la tienda: el mismo al que está vinculado
 * el Vendedor 24/7 (Baileys), así el cliente cae en el WhatsApp que atiende el
 * bot. Se prefetchea al montar (para que el clic abra WhatsApp de forma
 * síncrona y no lo bloquee el navegador). Si no hay número vinculado, usa el de
 * respaldo (kWhatsapp).
 */
export function useBusinessWhatsapp(): string {
  const [phone, setPhone] = useState(kWhatsapp);
  useEffect(() => {
    let alive = true;
    fetch("/api/whatsapp/number")
      .then((r) => r.json())
      .then((d: { phone?: string | null }) => {
        if (alive && d?.phone) setPhone(d.phone);
      })
      .catch(() => {
        /* sin conexión del vendedor: se mantiene el número de respaldo */
      });
    return () => {
      alive = false;
    };
  }, []);
  return phone;
}
