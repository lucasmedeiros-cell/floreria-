import { apiUrl } from "./apiBase";
import { useEffect, useState } from "react";
import { waNumber } from "./business";
import { useBusiness } from "@/context/StoreProvider";

/**
 * Abre WhatsApp con el texto prellenado. A prueba de bloqueadores de popups:
 * intenta abrir en pestaña nueva y, si el navegador la bloquea (window.open
 * devuelve null), navega en la MISMA pestaña — que nunca se bloquea.
 *
 * Sin número (negocio recién dado de alta, sin teléfono cargado) se abre
 * WhatsApp con el mensaje escrito para que el cliente elija el contacto: antes
 * había un número de respaldo en el código y el pedido se lo llevaba un tercero.
 */
export function openWhatsapp(text: string, phone?: string) {
  const destino = waNumber(phone);
  const url = `https://wa.me/${destino}?text=${encodeURIComponent(text)}`;
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
 * Número de WhatsApp del negocio para la tienda y la landing, por orden:
 *
 *   1. El del NEGOCIO — el de Configuración del CRM o, si ahí no hay, el que
 *      cargó el panel de easy pos al darlo de alta (ver lib/businessStore.ts).
 *   2. El del Vendedor 24/7 (Baileys), cuando el negocio no tiene ninguno: así
 *      el cliente al menos cae en el WhatsApp que atiende el bot.
 *
 * El del negocio va PRIMERO a propósito: es el que su dueño escribió, y antes
 * ganaba el del bot y los pedidos se iban a otro teléfono.
 *
 * Se consulta al montar para que el clic abra WhatsApp de forma síncrona y el
 * navegador no lo bloquee. Sin ningún número, se devuelve vacío y el enlace
 * abre WhatsApp sin destinatario en vez de escribirle a un desconocido.
 */
export function useBusinessWhatsapp(prefer: "negocio" | "vendedor" = "negocio"): string {
  const business = useBusiness();
  const propio = waNumber(business.whatsapp);
  const [phone, setPhone] = useState(prefer === "vendedor" ? "" : propio);

  useEffect(() => {
    // Con `vendedor` se pregunta siempre: quien lo eligió quiere que el pedido
    // caiga en el WhatsApp que atiende el bot, aunque el negocio tenga otro.
    if (prefer !== "vendedor" && propio) return;
    let alive = true;
    fetch(apiUrl("/api/whatsapp/number"))
      .then((r) => r.json())
      .then((d: { phone?: string | null }) => {
        if (alive && d?.phone) setPhone(waNumber(d.phone));
      })
      .catch(() => {
        /* sin número del vendedor: queda el del negocio */
      });
    return () => {
      alive = false;
    };
  }, [propio, prefer]);

  return phone || propio;
}
