import { kWhatsapp } from "./products";

export function openWhatsapp(text: string, phone: string = kWhatsapp) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

export function openWhatsappRaw(phone: string) {
  window.open(`https://wa.me/${phone}`, "_blank");
}
