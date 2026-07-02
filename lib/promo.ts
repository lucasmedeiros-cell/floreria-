// ===== Landing promocional (oferta destacada) =====
// Configura aquí la promoción que se muestra en /promo.
// Cambia el producto, precios, textos y la fecha de vigencia.

export interface PromoStat {
  value: string;
  label: string;
}

export interface PromoHighlight {
  /** Nombre de un icono de lucide-react (ver ICONS en PromoLanding). */
  icon: string;
  title: string;
  text?: string;
}

export interface Promo {
  /** SKU del producto de referencia (opcional, solo informativo). */
  productId?: string;
  eyebrow: string;
  badge?: string;
  title: string;
  subtitle: string;
  productName: string;
  description: string;
  /** Precio en Bs. */
  price: number;
  /** Precio anterior en Bs (para mostrar descuento). */
  originalPrice?: number;
  /** Fecha ISO hasta la que dura la oferta (activa la cuenta regresiva). */
  validUntil?: string;
  image: string;
  /** Imagen secundaria (tarjeta flotante del hero). */
  imageAlt?: string;
  stats: PromoStat[];
  highlights: PromoHighlight[];
  ctaLabel: string;
  /** Mensaje con el que se abre WhatsApp al pulsar el CTA. */
  whatsappMessage: string;
}

/** Config editable de la landing (promo + interruptor de visibilidad). */
export interface PromoConfig extends Promo {
  /** Si está desactivada, /promo muestra un aviso en vez de la landing. */
  enabled: boolean;
}

export const kPromo: Promo = {
  productId: "R208",
  eyebrow: "Edición limitada",
  badge: "-23%",
  title: "Jardinera Premium de temporada",
  subtitle:
    "Peonías, rosas y eucalipto compuestos a mano en una jardinera de autor. Una pieza que enamora a primera vista.",
  productName: "Jardinera Premium",
  description:
    "Nuestra composición más pedida, ahora en edición limitada. Cada jardinera se arma el mismo día con flores frescas premium seleccionadas al amanecer, para que llegue impecable y perfume cada rincón. Ideal para aniversarios, cumpleaños o simplemente para decir «pienso en ti».",
  price: 1850,
  originalPrice: 2400,
  validUntil: "2026-07-15T23:59:59",
  image: "/images/r208.jpg",
  imageAlt: "/images/r206.jpg",
  stats: [
    { value: "+2.000", label: "Clientes felices" },
    { value: "4.9★", label: "Valoración" },
    { value: "Hoy", label: "Entrega el mismo día" },
    { value: "100%", label: "Flores frescas" },
  ],
  highlights: [
    {
      icon: "Flower2",
      title: "Flores premium",
      text: "Selección diaria de la mejor calidad.",
    },
    {
      icon: "Brush",
      title: "Diseño de autor",
      text: "Hecho a mano, nunca dos iguales.",
    },
    {
      icon: "Truck",
      title: "Entrega el mismo día",
      text: "Pedidos antes de las 15:00 en Santa Cruz.",
    },
    {
      icon: "Heart",
      title: "Tarjeta dedicatoria",
      text: "Incluimos tu mensaje de regalo.",
    },
    {
      icon: "Leaf",
      title: "Frescura garantizada",
      text: "Flores que duran, cuidadas hasta tu puerta.",
    },
    {
      icon: "ShieldCheck",
      title: "Pago seguro",
      text: "Compra protegida con EasyPay.",
    },
  ],
  ctaLabel: "Pedir por WhatsApp",
  whatsappMessage:
    "Hola FloresOnline 🌷, quiero pedir la *Jardinera Premium* de la promoción.",
};

/** Config por defecto (promo original + activada). Server-safe. */
export const defaultPromoConfig: PromoConfig = { ...kPromo, enabled: true };
