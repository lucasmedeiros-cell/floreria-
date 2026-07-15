// ============================================================
//  Rubros (verticales de negocio)
// ------------------------------------------------------------
//  Un "rubro" es un preset completo del sistema: colores, textos de la tienda,
//  categorías, catálogo demo, landing promocional y persona del Vendedor 24/7.
//  Al elegir un rubro en el CRM (Configuración → Rubro del negocio) la web, la
//  landing y el panel se adaptan sin tocar código.
//
//  Este archivo es data pura (sin acceso a BD ni al DOM): lo importan tanto el
//  servidor como el cliente. Para agregar un rubro nuevo basta con copiar un
//  bloque de RUBROS y ajustarlo — nada más lo referencia por id.
// ============================================================

import type { Product } from "./products";

export type RubroId =
  | "generico"
  | "floreria"
  | "ferreteria"
  | "repuestos"
  | "minimarket"
  | "farmacia"
  | "restaurante"
  | "boutique"
  | "tecnologia";

/** Paleta del rubro. Se inyecta como variables CSS y la usa todo Tailwind. */
export interface RubroColors {
  /** Color principal (botones, links, acentos). */
  accent: string;
  /** Variante oscura (hover). */
  accentDeep: string;
  /** Tinte suave (fondos de chips e iconos). */
  soft: string;
  /** Tinte muy suave (fondo del hero y de las intros). */
  hero: string;
}

export interface RubroStep {
  /** Nombre de un icono (ver components/Icon.tsx). */
  icon: string;
  title: string;
  text: string;
}

export interface RubroTrust {
  icon: string;
  title: string;
  sub: string;
}

export interface RubroPromo {
  eyebrow: string;
  badge: string;
  title: string;
  subtitle: string;
  productName: string;
  description: string;
  price: number;
  originalPrice: number;
  ctaLabel: string;
  stats: { value: string; label: string }[];
  highlights: { icon: string; title: string; text: string }[];
  /** SKU del catálogo demo del rubro que ilustra la promo. */
  productId: string;
}

export interface Rubro {
  id: RubroId;
  /** Nombre del rubro tal como se lista en el CRM ("Ferretería"). */
  label: string;
  /** Descripción corta para el selector de rubros. */
  hint: string;
  /** Icono del rubro (ver components/Icon.tsx). Se usa como logo por defecto. */
  icon: string;

  // ---- Marca por defecto ----
  /** Nombre comercial sugerido. */
  brandName: string;
  /** Parte inicial del nombre que se pinta en font-light ("Flores" de FloresOnline). */
  brandLight: string;
  /** Bajada de la marca, bajo el logo. */
  tagline: string;
  /** Emoji que acompaña los mensajes de WhatsApp. */
  emoji: string;

  // ---- Look ----
  colors: RubroColors;
  /** La animación de inicio: pétalos (floral) o el logo del rubro. */
  intro: "petals" | "mark";
  /** El hero usa la fuente manuscrita para la segunda línea (solo rubros "cálidos"). */
  heroScript: boolean;

  // ---- Copy de la tienda ----
  hero: {
    eyebrow: string;
    title: string;
    /** Segunda línea del título (script o negrita, según heroScript). */
    highlight: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  /** Cómo llamar a un producto en esta vertical ("arreglo", "repuesto", "plato"). */
  noun: { one: string; many: string };
  steps: [RubroStep, RubroStep, RubroStep];
  trust: [RubroTrust, RubroTrust, RubroTrust, RubroTrust];
  about: string;

  // ---- Catálogo ----
  categories: string[];
  catalog: Product[];

  // ---- Landing /promo ----
  promo: RubroPromo;

  // ---- Vendedor 24/7 (bot de WhatsApp) ----
  bot: {
    /** Persona del asistente (primera línea del system prompt). */
    persona: string;
    /** Instrucciones específicas del rubro para el cierre de venta. */
    guidance: string;
  };
}

// ============================================================
//  Presets
// ============================================================

/**
 * Rubro por defecto de una instalación NUEVA de easy pos: neutro y vacío.
 * Es el estado "sin parear": no hay catálogo, ni marca, ni textos de un rubro
 * concreto. Sirve para que el sistema arranque limpio y el negocio se configure
 * (o se vincule) desde el panel.
 */
const generico: Rubro = {
  id: "generico",
  label: "Sin definir",
  hint: "Instalación nueva: elige el rubro del negocio para configurarlo",
  icon: "Store",
  brandName: "Tu negocio",
  brandLight: "",
  tagline: "CONFIGURA TU TIENDA EN EL PANEL",
  emoji: "🛍️",
  // Gris neutro: no compromete la identidad de ningún rubro.
  colors: { accent: "#3A3F4B", accentDeep: "#2A2E38", soft: "#ECEEF2", hero: "#F6F7F9" },
  intro: "mark",
  heroScript: false,
  hero: {
    eyebrow: "TIENDA ONLINE",
    title: "Tu negocio",
    highlight: "en línea",
    subtitle:
      "Configura el rubro, la marca y el catálogo desde el panel para que esta página tome la identidad de tu negocio.",
    ctaPrimary: "VER CATÁLOGO",
    ctaSecondary: "CONTACTAR",
  },
  noun: { one: "producto", many: "productos" },
  steps: [
    { icon: "ShoppingCart", title: "Elige tus productos", text: "Agrega al carrito lo que necesitas." },
    { icon: "QrCode", title: "Paga con QR", text: "Escanea el código y paga seguro con EasyPay." },
    { icon: "Truck", title: "Recibe tu pedido", text: "Coordinamos la entrega contigo." },
  ],
  trust: [
    { icon: "Truck", title: "Entrega", sub: "coordinada" },
    { icon: "BadgeCheck", title: "Productos", sub: "de calidad" },
    { icon: "ShieldCheck", title: "Compra segura", sub: "y confiable" },
    { icon: "WhatsApp", title: "Atención por", sub: "WhatsApp" },
  ],
  about: "Configura la descripción de tu negocio desde el panel.",
  categories: ["General"],
  // Vacío a propósito: una instalación nueva no trae productos.
  catalog: [],
  promo: {
    productId: "",
    eyebrow: "Promoción",
    badge: "",
    title: "Tu producto destacado",
    subtitle: "Configura la promoción desde el panel para publicar esta landing.",
    productName: "Producto destacado",
    description:
      "Elige un producto del catálogo y escribe su descripción desde Configuración → Landing promocional.",
    price: 0,
    originalPrice: 0,
    ctaLabel: "Pedir por WhatsApp",
    stats: [
      { value: "—", label: "Clientes" },
      { value: "—", label: "Valoración" },
      { value: "—", label: "Entrega" },
      { value: "—", label: "Calidad" },
    ],
    highlights: [
      { icon: "Store", title: "Configura tu landing", text: "Desde el panel, en Configuración." },
      { icon: "ShieldCheck", title: "Pago seguro", text: "Compra protegida con EasyPay." },
      { icon: "Truck", title: "Entrega coordinada", text: "Define tus tiempos de entrega." },
    ],
  },
  bot: {
    persona:
      "un negocio. Atiendes por WhatsApp de forma cordial y clara, ayudando al cliente y cerrando la venta.",
    guidance:
      "Sugiere productos del catálogo con su precio y ofrece tomar el pedido.",
  },
};

const floreria: Rubro = {
  id: "floreria",
  label: "Florería",
  hint: "Arreglos, ramos y regalos con entrega el mismo día",
  icon: "Flower2",
  brandName: "FloresOnline",
  brandLight: "Flores",
  tagline: "ARTE FLORAL EN CADA DETALLE",
  emoji: "🌷",
  colors: { accent: "#E8366B", accentDeep: "#D81B60", soft: "#FCE9EF", hero: "#FDF1F4" },
  intro: "petals",
  heroScript: true,
  hero: {
    eyebrow: "EXPRESA LO QUE SIENTES",
    title: "Flores que cuentan",
    highlight: "historias",
    subtitle:
      "Arreglos únicos para cada ocasión, con flores frescas y entrega el mismo día en Santa Cruz.",
    ctaPrimary: "VER COLECCIONES",
    ctaSecondary: "RESERVAR",
  },
  noun: { one: "arreglo", many: "arreglos" },
  steps: [
    { icon: "ShoppingCart", title: "Elige tus arreglos", text: "Agrega al carrito los arreglos que más te gusten." },
    { icon: "QrCode", title: "Paga con QR", text: "Escanea el código y paga seguro con EasyPay." },
    { icon: "Truck", title: "Recíbelo hoy", text: "Entrega el mismo día en Santa Cruz de la Sierra." },
  ],
  trust: [
    { icon: "Truck", title: "Envíos a", sub: "Santa Cruz" },
    { icon: "Sparkles", title: "Flores frescas", sub: "de calidad" },
    { icon: "ShieldCheck", title: "Compra segura", sub: "y confiable" },
    { icon: "WhatsApp", title: "Atención por", sub: "WhatsApp" },
  ],
  about: "Arreglos florales de autor con entrega el mismo día en Santa Cruz de la Sierra.",
  categories: ["Rosas", "Ramos", "Girasoles", "Exóticas"],
  catalog: [
    { id: "R208", name: "Jardinera Premium", desc: "Peonías, rosas y eucalipto en jardinera de autor.", price: 1850, image: "/images/r208.jpg", category: "Ramos", featured: true },
    { id: "R211", name: "Peonías de Lujo", desc: "Peonías magenta de tallo largo, frescura premium.", price: 1200, image: "/images/r211.jpg", category: "Ramos" },
    { id: "R209", name: "Tulipanes Holandeses", desc: "Tulipanes de temporada, color vibrante y frescos.", price: 540, image: "/images/r209.jpg", category: "Ramos" },
    { id: "R206", name: "Rosas Rojas Premium", desc: "Rosas rojas y protea en composición editorial.", price: 950, image: "/images/r206.jpg", category: "Rosas", featured: true },
    { id: "R204", name: "Mensaje de Amor", desc: "Rosa roja de tallo largo para decir te amo.", price: 600, image: "/images/r204.jpg", category: "Rosas" },
    { id: "R210", name: "Rosa Eterna", desc: "Rosa rosada en florero de cristal soplado.", price: 520, image: "/images/r210.jpg", category: "Rosas" },
    { id: "R207", name: "Jardín Exótico Mix", desc: "Rosas multicolor, una explosión de color única.", price: 1100, image: "/images/r207.jpg", category: "Exóticas", featured: true },
    { id: "R205", name: "Calas Naturalistas", desc: "Calas rosadas de líneas puras y elegantes.", price: 850, image: "/images/r205.jpg", category: "Exóticas" },
    { id: "R201", name: "Lirio Estelar", desc: "Lirio rosado de pétalos amplios y perfumados.", price: 465, image: "/images/r201.jpg", category: "Exóticas" },
    { id: "R212", name: "Girasoles Radiantes", desc: "Girasol gigante que ilumina cualquier espacio.", price: 480, image: "/images/r212.jpg", category: "Girasoles" },
    { id: "R203", name: "Campo de Girasoles", desc: "Brazada de girasoles frescos recién cortados.", price: 420, image: "/images/r203.jpg", category: "Girasoles" },
    { id: "R202", name: "Flores de Campo", desc: "Flores silvestres amarillas, estilo campestre.", price: 400, image: "/images/r202.jpg", category: "Girasoles" },
  ],
  promo: {
    productId: "R208",
    eyebrow: "Edición limitada",
    badge: "-23%",
    title: "Jardinera Premium de temporada",
    subtitle:
      "Peonías, rosas y eucalipto compuestos a mano en una jardinera de autor. Una pieza que enamora a primera vista.",
    productName: "Jardinera Premium",
    description:
      "Nuestra composición más pedida, ahora en edición limitada. Cada jardinera se arma el mismo día con flores frescas premium seleccionadas al amanecer, para que llegue impecable y perfume cada rincón.",
    price: 1850,
    originalPrice: 2400,
    ctaLabel: "Pedir por WhatsApp",
    stats: [
      { value: "+2.000", label: "Clientes felices" },
      { value: "4.9★", label: "Valoración" },
      { value: "Hoy", label: "Entrega el mismo día" },
      { value: "100%", label: "Flores frescas" },
    ],
    highlights: [
      { icon: "Flower2", title: "Flores premium", text: "Selección diaria de la mejor calidad." },
      { icon: "Brush", title: "Diseño de autor", text: "Hecho a mano, nunca dos iguales." },
      { icon: "Truck", title: "Entrega el mismo día", text: "Pedidos antes de las 15:00 en Santa Cruz." },
      { icon: "Heart", title: "Tarjeta dedicatoria", text: "Incluimos tu mensaje de regalo." },
      { icon: "Leaf", title: "Frescura garantizada", text: "Flores que duran, cuidadas hasta tu puerta." },
      { icon: "ShieldCheck", title: "Pago seguro", text: "Compra protegida con EasyPay." },
    ],
  },
  bot: {
    persona:
      "una florería. Atiendes por WhatsApp de forma amable, cálida y cercana, ayudando a elegir el arreglo ideal y a cerrar el pedido.",
    guidance:
      "Si el cliente menciona una ocasión (cumpleaños, aniversario, condolencias) o un tipo de flor, sugiere arreglos del catálogo que encajen.",
  },
};

const ferreteria: Rubro = {
  id: "ferreteria",
  label: "Ferretería",
  hint: "Herramientas, materiales de construcción y electricidad",
  icon: "Wrench",
  brandName: "FerreTotal",
  brandLight: "Ferre",
  tagline: "TODO PARA TU OBRA Y TU CASA",
  emoji: "🔧",
  colors: { accent: "#F97316", accentDeep: "#EA580C", soft: "#FFEDD5", hero: "#FFF7ED" },
  intro: "mark",
  heroScript: false,
  hero: {
    eyebrow: "HERRAMIENTAS Y MATERIALES",
    title: "Todo para tu obra",
    highlight: "en un solo lugar",
    subtitle:
      "Herramientas, materiales y accesorios de marcas confiables, con stock real y entrega el mismo día.",
    ctaPrimary: "VER CATÁLOGO",
    ctaSecondary: "COTIZAR",
  },
  noun: { one: "producto", many: "productos" },
  steps: [
    { icon: "ShoppingCart", title: "Arma tu pedido", text: "Agrega al carrito las herramientas y materiales que necesitas." },
    { icon: "QrCode", title: "Paga con QR", text: "Escanea el código y paga seguro con EasyPay." },
    { icon: "Truck", title: "Retira o recibe", text: "Retira en tienda o te lo llevamos a la obra." },
  ],
  trust: [
    { icon: "Truck", title: "Entrega a", sub: "obra y domicilio" },
    { icon: "BadgeCheck", title: "Marcas", sub: "garantizadas" },
    { icon: "ShieldCheck", title: "Compra segura", sub: "y confiable" },
    { icon: "WhatsApp", title: "Cotiza por", sub: "WhatsApp" },
  ],
  about: "Herramientas, materiales de construcción y electricidad con stock real y entrega el mismo día.",
  categories: ["Herramientas", "Construcción", "Electricidad", "Plomería", "Pinturas"],
  catalog: [
    { id: "FT101", name: "Taladro percutor 850W", desc: "Taladro percutor con maletín, mandril 13mm, velocidad variable.", price: 690, image: "", category: "Herramientas", featured: true },
    { id: "FT102", name: "Amoladora angular 4½\"", desc: "Amoladora 900W con disco de corte incluido.", price: 480, image: "", category: "Herramientas" },
    { id: "FT103", name: "Juego de llaves combinadas", desc: "Set de 12 llaves de 8 a 22mm en acero cromo vanadio.", price: 260, image: "", category: "Herramientas" },
    { id: "FT104", name: "Cemento IP-30 (50kg)", desc: "Bolsa de cemento portland para obra gruesa y fina.", price: 62, image: "", category: "Construcción", featured: true },
    { id: "FT105", name: "Carretilla reforzada", desc: "Carretilla de obra 90L con llanta neumática.", price: 420, image: "", category: "Construcción" },
    { id: "FT106", name: "Malla de fierro 6mm", desc: "Panel de malla electrosoldada para losa y contrapiso.", price: 175, image: "", category: "Construcción" },
    { id: "FT107", name: "Rollo de cable 2.5mm (100m)", desc: "Cable unipolar de cobre para instalaciones domiciliarias.", price: 340, image: "", category: "Electricidad" },
    { id: "FT108", name: "Foco LED 12W (pack x6)", desc: "Focos LED luz fría, bajo consumo, rosca E27.", price: 96, image: "", category: "Electricidad" },
    { id: "FT109", name: "Tubo PVC 1/2\" (x6m)", desc: "Tubería de PVC presión para agua fría.", price: 38, image: "", category: "Plomería" },
    { id: "FT110", name: "Grifería para lavamanos", desc: "Monomando cromado con instalación estándar.", price: 210, image: "", category: "Plomería" },
    { id: "FT111", name: "Látex interior blanco (4L)", desc: "Pintura látex lavable de alta cobertura.", price: 185, image: "", category: "Pinturas", featured: true },
    { id: "FT112", name: "Set de rodillos y brochas", desc: "Kit completo para pintar paredes y cielos rasos.", price: 78, image: "", category: "Pinturas" },
  ],
  promo: {
    productId: "FT101",
    eyebrow: "Oferta de temporada",
    badge: "-28%",
    title: "Taladro percutor 850W con maletín",
    subtitle:
      "Potencia profesional para perforar concreto, madera y metal. Incluye maletín y juego de brocas.",
    productName: "Taladro percutor 850W",
    description:
      "El taladro más pedido de la ferretería, ahora con descuento. Motor de 850W, percusión para concreto, velocidad variable y giro reversible. Incluye maletín rígido, juego de brocas y garantía de 12 meses.",
    price: 690,
    originalPrice: 960,
    ctaLabel: "Cotizar por WhatsApp",
    stats: [
      { value: "+5.000", label: "Clientes atendidos" },
      { value: "12 meses", label: "Garantía" },
      { value: "Hoy", label: "Entrega a obra" },
      { value: "100%", label: "Marcas originales" },
    ],
    highlights: [
      { icon: "Wrench", title: "Marcas originales", text: "Herramientas con respaldo del fabricante." },
      { icon: "BadgeCheck", title: "Garantía real", text: "12 meses contra defectos de fábrica." },
      { icon: "Truck", title: "Entrega a obra", text: "Pedidos antes de las 15:00 llegan hoy." },
      { icon: "Package", title: "Stock verificado", text: "Lo que ves en la web está en tienda." },
      { icon: "Percent", title: "Precio mayorista", text: "Descuentos por volumen para constructoras." },
      { icon: "ShieldCheck", title: "Pago seguro", text: "Compra protegida con EasyPay." },
    ],
  },
  bot: {
    persona:
      "una ferretería. Atiendes por WhatsApp de forma directa, práctica y resolutiva, ayudando a encontrar la herramienta o el material correcto y a cerrar la venta.",
    guidance:
      "Si el cliente describe un trabajo (una obra, una reparación, una instalación), sugiere del catálogo las herramientas y materiales que necesita y ofrece cotizarlo. Pregunta cantidades cuando se trate de materiales de obra.",
  },
};

const repuestos: Rubro = {
  id: "repuestos",
  label: "Repuestos automotrices",
  hint: "Autopartes, lubricantes y accesorios por marca y modelo",
  icon: "Car",
  brandName: "AutoPartes",
  brandLight: "Auto",
  tagline: "REPUESTOS QUE SÍ CALZAN",
  emoji: "🔩",
  colors: { accent: "#2563EB", accentDeep: "#1D4ED8", soft: "#DBEAFE", hero: "#EFF6FF" },
  intro: "mark",
  heroScript: false,
  hero: {
    eyebrow: "AUTOPARTES Y LUBRICANTES",
    title: "El repuesto exacto",
    highlight: "para tu vehículo",
    subtitle:
      "Repuestos originales y alternativos con stock real. Dinos marca, modelo y año, y te confirmamos compatibilidad.",
    ctaPrimary: "VER REPUESTOS",
    ctaSecondary: "CONSULTAR",
  },
  noun: { one: "repuesto", many: "repuestos" },
  steps: [
    { icon: "Search", title: "Busca tu repuesto", text: "Busca por código, pieza o modelo de vehículo." },
    { icon: "QrCode", title: "Paga con QR", text: "Escanea el código y paga seguro con EasyPay." },
    { icon: "Truck", title: "Retira o recibe", text: "Retira en tienda o te lo enviamos al taller." },
  ],
  trust: [
    { icon: "Car", title: "Compatibilidad", sub: "verificada" },
    { icon: "BadgeCheck", title: "Repuestos", sub: "originales" },
    { icon: "ShieldCheck", title: "Compra segura", sub: "y confiable" },
    { icon: "WhatsApp", title: "Consulta por", sub: "WhatsApp" },
  ],
  about: "Repuestos originales y alternativos, lubricantes y accesorios con compatibilidad verificada.",
  categories: ["Motor", "Frenos", "Suspensión", "Lubricantes", "Accesorios"],
  catalog: [
    { id: "AP201", name: "Kit de distribución", desc: "Correa, tensor y poleas. Consultar compatibilidad por modelo.", price: 890, image: "", category: "Motor", featured: true },
    { id: "AP202", name: "Filtro de aire de motor", desc: "Filtro de alto flujo, repuesto directo de fábrica.", price: 95, image: "", category: "Motor" },
    { id: "AP203", name: "Bujías de iridio (juego x4)", desc: "Mayor durabilidad y mejor arranque en frío.", price: 260, image: "", category: "Motor" },
    { id: "AP204", name: "Pastillas de freno delanteras", desc: "Juego cerámico de baja emisión de polvo.", price: 320, image: "", category: "Frenos", featured: true },
    { id: "AP205", name: "Discos de freno ventilados (par)", desc: "Discos rectificables, alta disipación de calor.", price: 640, image: "", category: "Frenos" },
    { id: "AP206", name: "Líquido de frenos DOT 4", desc: "Botella de 500ml, punto de ebullición alto.", price: 55, image: "", category: "Frenos" },
    { id: "AP207", name: "Amortiguadores delanteros (par)", desc: "Amortiguadores a gas, tren delantero.", price: 980, image: "", category: "Suspensión" },
    { id: "AP208", name: "Rótulas de suspensión", desc: "Par de rótulas inferiores con grasera.", price: 240, image: "", category: "Suspensión" },
    { id: "AP209", name: "Aceite sintético 5W-30 (4L)", desc: "Aceite full sintético para motores a gasolina.", price: 280, image: "", category: "Lubricantes", featured: true },
    { id: "AP210", name: "Filtro de aceite", desc: "Filtro con válvula antirretorno.", price: 65, image: "", category: "Lubricantes" },
    { id: "AP211", name: "Batería 12V 75Ah", desc: "Batería libre de mantenimiento con 12 meses de garantía.", price: 750, image: "", category: "Accesorios" },
    { id: "AP212", name: "Juego de alfombras", desc: "Alfombras de goma a medida, antideslizantes.", price: 180, image: "", category: "Accesorios" },
  ],
  promo: {
    productId: "AP204",
    eyebrow: "Promo del mes",
    badge: "-25%",
    title: "Cambio de pastillas de freno",
    subtitle:
      "Juego cerámico delantero con instalación incluida. Frenado silencioso y sin polvo en las llantas.",
    productName: "Pastillas de freno delanteras",
    description:
      "Pastillas cerámicas de primera línea, compatibles con la mayoría de los modelos. Incluyen instalación en nuestro taller y revisión gratuita de discos. Frenado firme, silencioso y con menor desgaste del disco.",
    price: 320,
    originalPrice: 430,
    ctaLabel: "Consultar por WhatsApp",
    stats: [
      { value: "+8.000", label: "Repuestos vendidos" },
      { value: "12 meses", label: "Garantía" },
      { value: "Hoy", label: "Entrega al taller" },
      { value: "100%", label: "Compatibilidad verificada" },
    ],
    highlights: [
      { icon: "Car", title: "Compatibilidad verificada", text: "Confirmamos marca, modelo y año antes de vender." },
      { icon: "BadgeCheck", title: "Repuestos originales", text: "Originales y alternativos de primera línea." },
      { icon: "Wrench", title: "Instalación incluida", text: "Nuestro taller lo monta el mismo día." },
      { icon: "Truck", title: "Envío al taller", text: "Llevamos el repuesto donde lo necesites." },
      { icon: "Package", title: "Stock real", text: "Lo que ves en la web está en tienda." },
      { icon: "ShieldCheck", title: "Pago seguro", text: "Compra protegida con EasyPay." },
    ],
  },
  bot: {
    persona:
      "una tienda de repuestos automotrices. Atiendes por WhatsApp de forma técnica pero clara, ayudando a identificar el repuesto correcto y a cerrar la venta.",
    guidance:
      "SIEMPRE pregunta marca, modelo y año del vehículo antes de confirmar un repuesto: la compatibilidad es lo más importante. Si el cliente describe una falla, sugiere del catálogo los repuestos que suelen resolverla.",
  },
};

const minimarket: Rubro = {
  id: "minimarket",
  label: "Minimarket / Almacén",
  hint: "Abarrotes, bebidas y limpieza con delivery rápido",
  icon: "ShoppingBasket",
  brandName: "MiMarket",
  brandLight: "Mi",
  tagline: "TU ALMACÉN, A UN MENSAJE",
  emoji: "🛒",
  colors: { accent: "#16A34A", accentDeep: "#15803D", soft: "#DCFCE7", hero: "#F0FDF4" },
  intro: "mark",
  heroScript: false,
  hero: {
    eyebrow: "ABARROTES Y BEBIDAS",
    title: "Tu compra del día",
    highlight: "en minutos",
    subtitle:
      "Abarrotes, bebidas y artículos de limpieza con precios de barrio y entrega rápida a tu puerta.",
    ctaPrimary: "VER PRODUCTOS",
    ctaSecondary: "PEDIR",
  },
  noun: { one: "producto", many: "productos" },
  steps: [
    { icon: "ShoppingCart", title: "Arma tu canasta", text: "Agrega al carrito todo lo que necesitas." },
    { icon: "QrCode", title: "Paga con QR", text: "Escanea el código y paga seguro con EasyPay." },
    { icon: "Truck", title: "Recíbelo hoy", text: "Entrega rápida en tu zona." },
  ],
  trust: [
    { icon: "Truck", title: "Delivery", sub: "en tu zona" },
    { icon: "Percent", title: "Precios", sub: "de barrio" },
    { icon: "ShieldCheck", title: "Compra segura", sub: "y confiable" },
    { icon: "WhatsApp", title: "Pedidos por", sub: "WhatsApp" },
  ],
  about: "Abarrotes, bebidas y limpieza con precios de barrio y entrega rápida a domicilio.",
  categories: ["Abarrotes", "Bebidas", "Limpieza", "Snacks", "Lácteos"],
  catalog: [
    { id: "MM301", name: "Arroz grano de oro (5kg)", desc: "Arroz de primera calidad, bolsa de 5 kilos.", price: 45, image: "", category: "Abarrotes", featured: true },
    { id: "MM302", name: "Aceite de girasol (900ml)", desc: "Aceite vegetal para cocina diaria.", price: 18, image: "", category: "Abarrotes" },
    { id: "MM303", name: "Azúcar refinada (2kg)", desc: "Bolsa de azúcar blanca refinada.", price: 16, image: "", category: "Abarrotes" },
    { id: "MM304", name: "Fideo tallarín (500g)", desc: "Pasta de sémola de trigo.", price: 8, image: "", category: "Abarrotes" },
    { id: "MM305", name: "Gaseosa 2L", desc: "Botella familiar bien fría.", price: 14, image: "", category: "Bebidas", featured: true },
    { id: "MM306", name: "Agua mineral (pack x6)", desc: "Botellas de 2 litros sin gas.", price: 30, image: "", category: "Bebidas" },
    { id: "MM307", name: "Cerveza lata (pack x6)", desc: "Pack de seis latas de 350ml.", price: 48, image: "", category: "Bebidas" },
    { id: "MM308", name: "Detergente en polvo (1kg)", desc: "Detergente multiuso para ropa.", price: 26, image: "", category: "Limpieza" },
    { id: "MM309", name: "Lavandina (1L)", desc: "Desinfectante y blanqueador.", price: 9, image: "", category: "Limpieza" },
    { id: "MM310", name: "Papel higiénico (pack x4)", desc: "Rollos doble hoja.", price: 22, image: "", category: "Limpieza" },
    { id: "MM311", name: "Galletas surtidas", desc: "Paquete familiar de galletas dulces.", price: 12, image: "", category: "Snacks", featured: true },
    { id: "MM312", name: "Leche entera (1L)", desc: "Leche larga vida en caja.", price: 10, image: "", category: "Lácteos" },
  ],
  promo: {
    productId: "MM301",
    eyebrow: "Canasta de la semana",
    badge: "-20%",
    title: "Canasta básica familiar",
    subtitle:
      "Arroz, aceite, azúcar y fideo: lo esencial de la semana, a precio de mayorista y con entrega el mismo día.",
    productName: "Canasta básica familiar",
    description:
      "La compra del mes resuelta en un solo pedido. Incluye arroz de 5kg, aceite de girasol, azúcar y fideo, todo de primera calidad y a precio de mayorista. Te lo llevamos a tu puerta el mismo día.",
    price: 89,
    originalPrice: 112,
    ctaLabel: "Pedir por WhatsApp",
    stats: [
      { value: "+3.000", label: "Familias atendidas" },
      { value: "30 min", label: "Entrega promedio" },
      { value: "Hoy", label: "Delivery en tu zona" },
      { value: "100%", label: "Productos frescos" },
    ],
    highlights: [
      { icon: "Percent", title: "Precio de mayorista", text: "Más barato que comprar por unidad." },
      { icon: "Truck", title: "Delivery rápido", text: "Entregamos en tu zona el mismo día." },
      { icon: "Package", title: "Stock diario", text: "Reponemos todos los días." },
      { icon: "BadgeCheck", title: "Productos frescos", text: "Vencimientos controlados." },
      { icon: "ShoppingCart", title: "Pedido mínimo bajo", text: "Sin monto mínimo alto para pedir." },
      { icon: "ShieldCheck", title: "Pago seguro", text: "Compra protegida con EasyPay." },
    ],
  },
  bot: {
    persona:
      "un minimarket de barrio. Atiendes por WhatsApp de forma rápida, cordial y sin vueltas, tomando el pedido y coordinando el delivery.",
    guidance:
      "Toma el pedido producto por producto y confirma cantidades. Ofrece completar la canasta con productos del catálogo que suelen pedirse juntos.",
  },
};

const farmacia: Rubro = {
  id: "farmacia",
  label: "Farmacia",
  hint: "Medicamentos, cuidado personal y dermocosmética",
  icon: "Pill",
  brandName: "FarmaSalud",
  brandLight: "Farma",
  tagline: "TU SALUD, BIEN ATENDIDA",
  emoji: "💊",
  colors: { accent: "#0EA5E9", accentDeep: "#0284C7", soft: "#E0F2FE", hero: "#F0F9FF" },
  intro: "mark",
  heroScript: false,
  hero: {
    eyebrow: "MEDICAMENTOS Y CUIDADO PERSONAL",
    title: "Tu farmacia de confianza",
    highlight: "a domicilio",
    subtitle:
      "Medicamentos, cuidado personal y dermocosmética con atención farmacéutica y entrega el mismo día.",
    ctaPrimary: "VER PRODUCTOS",
    ctaSecondary: "CONSULTAR",
  },
  noun: { one: "producto", many: "productos" },
  steps: [
    { icon: "ShoppingCart", title: "Elige tus productos", text: "Agrega al carrito lo que necesitas." },
    { icon: "QrCode", title: "Paga con QR", text: "Escanea el código y paga seguro con EasyPay." },
    { icon: "Truck", title: "Recíbelo hoy", text: "Entrega discreta el mismo día." },
  ],
  trust: [
    { icon: "Truck", title: "Entrega", sub: "el mismo día" },
    { icon: "BadgeCheck", title: "Productos", sub: "certificados" },
    { icon: "ShieldCheck", title: "Compra segura", sub: "y confiable" },
    { icon: "WhatsApp", title: "Consulta por", sub: "WhatsApp" },
  ],
  about: "Medicamentos, cuidado personal y dermocosmética con atención farmacéutica y entrega el mismo día.",
  categories: ["Medicamentos", "Cuidado personal", "Dermocosmética", "Vitaminas", "Bebés"],
  catalog: [
    { id: "FS401", name: "Paracetamol 500mg (x20)", desc: "Analgésico y antipirético. Venta libre.", price: 25, image: "", category: "Medicamentos", featured: true },
    { id: "FS402", name: "Ibuprofeno 400mg (x20)", desc: "Antiinflamatorio de venta libre.", price: 32, image: "", category: "Medicamentos" },
    { id: "FS403", name: "Suero fisiológico (500ml)", desc: "Solución estéril para limpieza e hidratación.", price: 18, image: "", category: "Medicamentos" },
    { id: "FS404", name: "Alcohol en gel (500ml)", desc: "Antibacterial con glicerina.", price: 22, image: "", category: "Cuidado personal" },
    { id: "FS405", name: "Termómetro digital", desc: "Lectura en 10 segundos, alarma de fiebre.", price: 55, image: "", category: "Cuidado personal" },
    { id: "FS406", name: "Protector solar FPS 50", desc: "Protección UVA/UVB, textura no grasa.", price: 145, image: "", category: "Dermocosmética", featured: true },
    { id: "FS407", name: "Crema hidratante facial", desc: "Hidratación 24h para piel sensible.", price: 120, image: "", category: "Dermocosmética" },
    { id: "FS408", name: "Vitamina C 1000mg (x30)", desc: "Refuerza las defensas, un comprimido al día.", price: 78, image: "", category: "Vitaminas", featured: true },
    { id: "FS409", name: "Multivitamínico (x60)", desc: "Complejo vitamínico y mineral diario.", price: 130, image: "", category: "Vitaminas" },
    { id: "FS410", name: "Pañales talla M (x40)", desc: "Pañales hipoalergénicos con doble absorción.", price: 95, image: "", category: "Bebés" },
    { id: "FS411", name: "Toallitas húmedas (x80)", desc: "Toallitas sin alcohol para piel del bebé.", price: 28, image: "", category: "Bebés" },
    { id: "FS412", name: "Tensiómetro digital", desc: "Medidor de presión arterial de brazo.", price: 320, image: "", category: "Cuidado personal" },
  ],
  promo: {
    productId: "FS406",
    eyebrow: "Cuidado de la piel",
    badge: "-22%",
    title: "Protector solar FPS 50",
    subtitle:
      "Protección alta UVA/UVB con textura ligera y no grasa. El más recomendado por dermatólogos.",
    productName: "Protector solar FPS 50",
    description:
      "Protección solar de amplio espectro para uso diario, resistente al agua y apta para piel sensible. Textura ligera que no deja residuo blanco ni tapa los poros. Ideal para el clima de Santa Cruz.",
    price: 145,
    originalPrice: 186,
    ctaLabel: "Consultar por WhatsApp",
    stats: [
      { value: "+6.000", label: "Clientes atendidos" },
      { value: "Farmacéutico", label: "Atención profesional" },
      { value: "Hoy", label: "Entrega a domicilio" },
      { value: "100%", label: "Productos certificados" },
    ],
    highlights: [
      { icon: "BadgeCheck", title: "Productos certificados", text: "Registro sanitario vigente." },
      { icon: "Heart", title: "Atención farmacéutica", text: "Te orientamos antes de comprar." },
      { icon: "Truck", title: "Entrega discreta", text: "Pedidos antes de las 15:00 llegan hoy." },
      { icon: "Package", title: "Stock permanente", text: "Reposición diaria de lo esencial." },
      { icon: "Percent", title: "Precios accesibles", text: "Descuentos en tratamientos prolongados." },
      { icon: "ShieldCheck", title: "Pago seguro", text: "Compra protegida con EasyPay." },
    ],
  },
  bot: {
    persona:
      "una farmacia. Atiendes por WhatsApp de forma cordial, prudente y profesional, ayudando a encontrar el producto y a cerrar el pedido.",
    guidance:
      "NUNCA diagnostiques ni recomiendes medicamentos con receta: si el cliente describe síntomas, sugiere consultar a un profesional y ofrece los productos de venta libre del catálogo. Para medicamentos con receta, pide la receta antes de confirmar el pedido.",
  },
};

const restaurante: Rubro = {
  id: "restaurante",
  label: "Restaurante",
  hint: "Menú del día, platos a la carta y delivery",
  icon: "UtensilsCrossed",
  brandName: "SaborCasero",
  brandLight: "Sabor",
  tagline: "COMIDA CASERA, TODOS LOS DÍAS",
  emoji: "🍽️",
  colors: { accent: "#DC2626", accentDeep: "#B91C1C", soft: "#FEE2E2", hero: "#FEF2F2" },
  intro: "mark",
  heroScript: true,
  hero: {
    eyebrow: "COCINA CASERA",
    title: "Comida que sabe a",
    highlight: "casa",
    subtitle:
      "Platos caseros preparados al momento, con ingredientes frescos y delivery en toda la ciudad.",
    ctaPrimary: "VER EL MENÚ",
    ctaSecondary: "PEDIR",
  },
  noun: { one: "plato", many: "platos" },
  steps: [
    { icon: "ShoppingCart", title: "Elige tus platos", text: "Arma tu pedido desde el menú del día." },
    { icon: "QrCode", title: "Paga con QR", text: "Escanea el código y paga seguro con EasyPay." },
    { icon: "Truck", title: "Recíbelo caliente", text: "Delivery en 40 minutos o retira en el local." },
  ],
  trust: [
    { icon: "Truck", title: "Delivery en", sub: "40 minutos" },
    { icon: "Sparkles", title: "Ingredientes", sub: "frescos del día" },
    { icon: "ShieldCheck", title: "Compra segura", sub: "y confiable" },
    { icon: "WhatsApp", title: "Pedidos por", sub: "WhatsApp" },
  ],
  about: "Comida casera preparada al momento, con ingredientes frescos y delivery en toda la ciudad.",
  categories: ["Almuerzos", "A la carta", "Parrilla", "Bebidas", "Postres"],
  catalog: [
    { id: "SC501", name: "Almuerzo completo", desc: "Sopa, segundo, ensalada y refresco del día.", price: 30, image: "", category: "Almuerzos", featured: true },
    { id: "SC502", name: "Sopa de maní", desc: "Sopa tradicional con papa frita y carne.", price: 22, image: "", category: "Almuerzos" },
    { id: "SC503", name: "Milanesa con arroz", desc: "Milanesa de pollo, arroz graneado y ensalada.", price: 35, image: "", category: "A la carta" },
    { id: "SC504", name: "Pique macho", desc: "Carne, salchicha, papas fritas, huevo y locoto.", price: 65, image: "", category: "A la carta", featured: true },
    { id: "SC505", name: "Silpancho", desc: "Carne apanada, arroz, papa, huevo y ensalada criolla.", price: 40, image: "", category: "A la carta" },
    { id: "SC506", name: "Parrillada para dos", desc: "Costilla, chorizo, pollo y guarniciones.", price: 120, image: "", category: "Parrilla", featured: true },
    { id: "SC507", name: "Churrasco de lomo", desc: "Lomo a la parrilla con yuca y ensalada.", price: 75, image: "", category: "Parrilla" },
    { id: "SC508", name: "Pollo a la brasa (1/4)", desc: "Con papas fritas y ensalada.", price: 32, image: "", category: "Parrilla" },
    { id: "SC509", name: "Jugo natural (1L)", desc: "Jugo del día exprimido al momento.", price: 15, image: "", category: "Bebidas" },
    { id: "SC510", name: "Gaseosa 2L", desc: "Botella familiar bien fría.", price: 14, image: "", category: "Bebidas" },
    { id: "SC511", name: "Flan casero", desc: "Flan de vainilla con caramelo.", price: 12, image: "", category: "Postres" },
    { id: "SC512", name: "Torta de chocolate", desc: "Porción generosa, receta de la casa.", price: 18, image: "", category: "Postres" },
  ],
  promo: {
    productId: "SC506",
    eyebrow: "Promo del fin de semana",
    badge: "-25%",
    title: "Parrillada para dos personas",
    subtitle:
      "Costilla, chorizo, pollo y guarniciones a la parrilla. Para compartir, con delivery caliente a tu casa.",
    productName: "Parrillada para dos",
    description:
      "Nuestra parrillada más pedida: costilla, chorizo criollo y pollo a la brasa, acompañados de yuca, papa y ensalada criolla. Se prepara al momento y sale caliente para que llegue perfecta a tu mesa.",
    price: 120,
    originalPrice: 160,
    ctaLabel: "Pedir por WhatsApp",
    stats: [
      { value: "+10.000", label: "Pedidos entregados" },
      { value: "4.8★", label: "Valoración" },
      { value: "40 min", label: "Delivery promedio" },
      { value: "100%", label: "Ingredientes frescos" },
    ],
    highlights: [
      { icon: "UtensilsCrossed", title: "Preparado al momento", text: "Nada precocido, todo del día." },
      { icon: "Sparkles", title: "Ingredientes frescos", text: "Compramos en el mercado cada mañana." },
      { icon: "Truck", title: "Delivery caliente", text: "Empaque térmico, llega como recién hecho." },
      { icon: "Heart", title: "Receta de la casa", text: "Sazón casera, como en familia." },
      { icon: "Percent", title: "Promos diarias", text: "Menú del día a precio especial." },
      { icon: "ShieldCheck", title: "Pago seguro", text: "Compra protegida con EasyPay." },
    ],
  },
  bot: {
    persona:
      "un restaurante de comida casera. Atiendes por WhatsApp de forma cálida y ágil, tomando el pedido y coordinando el delivery.",
    guidance:
      "Ofrece el menú del día y sugiere bebidas y postres para completar el pedido. Confirma la dirección y si el pedido es para delivery o para retirar en el local.",
  },
};

const boutique: Rubro = {
  id: "boutique",
  label: "Boutique / Ropa",
  hint: "Moda, calzado y accesorios por temporada",
  icon: "Shirt",
  brandName: "EstiloUrbano",
  brandLight: "Estilo",
  tagline: "MODA QUE TE REPRESENTA",
  emoji: "👗",
  colors: { accent: "#7C3AED", accentDeep: "#6D28D9", soft: "#EDE9FE", hero: "#F5F3FF" },
  intro: "mark",
  heroScript: true,
  hero: {
    eyebrow: "NUEVA TEMPORADA",
    title: "Tu estilo empieza",
    highlight: "aquí",
    subtitle:
      "Ropa, calzado y accesorios de temporada. Prendas seleccionadas, cambios sin complicaciones.",
    ctaPrimary: "VER COLECCIÓN",
    ctaSecondary: "CONSULTAR",
  },
  noun: { one: "prenda", many: "prendas" },
  steps: [
    { icon: "ShoppingCart", title: "Elige tus prendas", text: "Agrega al carrito lo que te gusta, indica tu talla." },
    { icon: "QrCode", title: "Paga con QR", text: "Escanea el código y paga seguro con EasyPay." },
    { icon: "Truck", title: "Recíbelo en casa", text: "Entrega el mismo día y cambios sin complicaciones." },
  ],
  trust: [
    { icon: "Truck", title: "Envíos a", sub: "todo el país" },
    { icon: "Sparkles", title: "Nueva", sub: "temporada" },
    { icon: "ShieldCheck", title: "Cambios", sub: "sin complicaciones" },
    { icon: "WhatsApp", title: "Atención por", sub: "WhatsApp" },
  ],
  about: "Ropa, calzado y accesorios de temporada con envíos a todo el país y cambios sin complicaciones.",
  categories: ["Mujer", "Hombre", "Calzado", "Accesorios", "Ofertas"],
  catalog: [
    { id: "EU601", name: "Vestido midi floral", desc: "Vestido de viscosa, corte midi, tallas S a XL.", price: 320, image: "", category: "Mujer", featured: true },
    { id: "EU602", name: "Blusa de lino", desc: "Blusa fresca de lino, ideal para el calor.", price: 180, image: "", category: "Mujer" },
    { id: "EU603", name: "Jean skinny tiro alto", desc: "Denim elastizado, azul clásico.", price: 260, image: "", category: "Mujer" },
    { id: "EU604", name: "Camisa slim fit", desc: "Camisa de algodón, corte entallado.", price: 220, image: "", category: "Hombre", featured: true },
    { id: "EU605", name: "Polera básica premium", desc: "Algodón peinado, varios colores.", price: 95, image: "", category: "Hombre" },
    { id: "EU606", name: "Chaqueta de jean", desc: "Chaqueta clásica, unisex.", price: 340, image: "", category: "Hombre" },
    { id: "EU607", name: "Zapatillas urbanas", desc: "Suela de goma, tallas 36 a 44.", price: 450, image: "", category: "Calzado", featured: true },
    { id: "EU608", name: "Sandalias de cuero", desc: "Cuero natural, hechas a mano.", price: 280, image: "", category: "Calzado" },
    { id: "EU609", name: "Botines de gamuza", desc: "Botines de caña baja, taco bajo.", price: 520, image: "", category: "Calzado" },
    { id: "EU610", name: "Cartera bandolera", desc: "Cuero sintético, correa ajustable.", price: 210, image: "", category: "Accesorios" },
    { id: "EU611", name: "Lentes de sol UV400", desc: "Protección UV total, estuche incluido.", price: 130, image: "", category: "Accesorios" },
    { id: "EU612", name: "Polera temporada pasada", desc: "Liquidación de temporada, stock limitado.", price: 55, image: "", category: "Ofertas" },
  ],
  promo: {
    productId: "EU607",
    eyebrow: "Nueva temporada",
    badge: "-30%",
    title: "Zapatillas urbanas de temporada",
    subtitle:
      "El calzado más versátil de la colección: cómodo para todo el día y combina con todo.",
    productName: "Zapatillas urbanas",
    description:
      "Zapatillas de diseño urbano con suela de goma antideslizante y plantilla acolchada. Livianas, cómodas desde el primer uso y disponibles de la talla 36 a la 44. Cambio de talla sin costo dentro de los 7 días.",
    price: 450,
    originalPrice: 640,
    ctaLabel: "Consultar por WhatsApp",
    stats: [
      { value: "+4.000", label: "Clientes felices" },
      { value: "4.9★", label: "Valoración" },
      { value: "7 días", label: "Cambio de talla" },
      { value: "Hoy", label: "Entrega el mismo día" },
    ],
    highlights: [
      { icon: "Shirt", title: "Nueva temporada", text: "Prendas seleccionadas cada mes." },
      { icon: "Sparkles", title: "Calidad premium", text: "Telas y materiales que duran." },
      { icon: "Truck", title: "Envíos a todo el país", text: "Entrega el mismo día en la ciudad." },
      { icon: "BadgeCheck", title: "Cambios sin vueltas", text: "Cambio de talla dentro de los 7 días." },
      { icon: "Percent", title: "Ofertas permanentes", text: "Liquidación de temporada pasada." },
      { icon: "ShieldCheck", title: "Pago seguro", text: "Compra protegida con EasyPay." },
    ],
  },
  bot: {
    persona:
      "una boutique de ropa. Atiendes por WhatsApp de forma cercana y con buen gusto, ayudando a elegir prendas y a cerrar la venta.",
    guidance:
      "Pregunta siempre la talla y el color antes de confirmar. Sugiere prendas del catálogo que combinen con lo que el cliente ya eligió.",
  },
};

const tecnologia: Rubro = {
  id: "tecnologia",
  label: "Tecnología",
  hint: "Computación, celulares y accesorios con garantía",
  icon: "Laptop",
  brandName: "TecnoStore",
  brandLight: "Tecno",
  tagline: "TECNOLOGÍA CON GARANTÍA",
  emoji: "💻",
  colors: { accent: "#4F46E5", accentDeep: "#4338CA", soft: "#E0E7FF", hero: "#EEF2FF" },
  intro: "mark",
  heroScript: false,
  hero: {
    eyebrow: "COMPUTACIÓN Y CELULARES",
    title: "Tecnología que rinde",
    highlight: "y tiene respaldo",
    subtitle:
      "Laptops, celulares y accesorios originales con garantía real y soporte técnico local.",
    ctaPrimary: "VER CATÁLOGO",
    ctaSecondary: "COTIZAR",
  },
  noun: { one: "producto", many: "productos" },
  steps: [
    { icon: "ShoppingCart", title: "Elige tu equipo", text: "Compara y agrega al carrito lo que necesitas." },
    { icon: "QrCode", title: "Paga con QR", text: "Escanea el código y paga seguro con EasyPay." },
    { icon: "Truck", title: "Recíbelo hoy", text: "Entrega el mismo día, configurado y listo." },
  ],
  trust: [
    { icon: "BadgeCheck", title: "Garantía", sub: "oficial" },
    { icon: "Wrench", title: "Soporte", sub: "técnico local" },
    { icon: "ShieldCheck", title: "Compra segura", sub: "y confiable" },
    { icon: "WhatsApp", title: "Cotiza por", sub: "WhatsApp" },
  ],
  about: "Laptops, celulares y accesorios originales con garantía real y soporte técnico local.",
  categories: ["Computación", "Celulares", "Accesorios", "Gaming", "Redes"],
  catalog: [
    { id: "TS701", name: "Laptop 15.6\" Core i5", desc: "16GB RAM, SSD 512GB, Windows 11 original.", price: 5400, image: "", category: "Computación", featured: true },
    { id: "TS702", name: "Monitor 24\" Full HD", desc: "Panel IPS, 75Hz, HDMI y VGA.", price: 980, image: "", category: "Computación" },
    { id: "TS703", name: "SSD NVMe 1TB", desc: "Unidad de estado sólido de alta velocidad.", price: 620, image: "", category: "Computación" },
    { id: "TS704", name: "Celular 128GB", desc: "Pantalla 6.5\", cámara 50MP, batería 5000mAh.", price: 2100, image: "", category: "Celulares", featured: true },
    { id: "TS705", name: "Audífonos inalámbricos", desc: "Bluetooth 5.3 con cancelación de ruido.", price: 320, image: "", category: "Accesorios" },
    { id: "TS706", name: "Cargador rápido 33W", desc: "Carga rápida con cable USB-C incluido.", price: 130, image: "", category: "Accesorios" },
    { id: "TS707", name: "Mouse inalámbrico", desc: "Ergonómico, batería de larga duración.", price: 95, image: "", category: "Accesorios" },
    { id: "TS708", name: "Teclado mecánico RGB", desc: "Switches azules, retroiluminación RGB.", price: 380, image: "", category: "Gaming", featured: true },
    { id: "TS709", name: "Silla gamer ergonómica", desc: "Reclinable, soporte lumbar y reposabrazos 3D.", price: 1450, image: "", category: "Gaming" },
    { id: "TS710", name: "Router WiFi 6 doble banda", desc: "Cobertura amplia, ideal para teletrabajo.", price: 540, image: "", category: "Redes" },
    { id: "TS711", name: "Repetidor WiFi", desc: "Extiende la señal a toda la casa.", price: 180, image: "", category: "Redes" },
    { id: "TS712", name: "Cámara de seguridad WiFi", desc: "Visión nocturna, alertas al celular.", price: 290, image: "", category: "Redes" },
  ],
  promo: {
    productId: "TS701",
    eyebrow: "Oferta del mes",
    badge: "-18%",
    title: "Laptop Core i5 con SSD de 512GB",
    subtitle:
      "16GB de RAM, SSD NVMe y Windows 11 original. Lista para trabajar o estudiar desde el primer día.",
    productName: "Laptop 15.6\" Core i5",
    description:
      "Laptop de 15.6 pulgadas con procesador Core i5, 16GB de RAM y SSD NVMe de 512GB. Arranca en segundos y aguanta el multitasking sin trabarse. Incluye Windows 11 original, garantía de 12 meses y configuración sin costo.",
    price: 5400,
    originalPrice: 6600,
    ctaLabel: "Cotizar por WhatsApp",
    stats: [
      { value: "+2.500", label: "Equipos vendidos" },
      { value: "12 meses", label: "Garantía oficial" },
      { value: "Hoy", label: "Entrega configurada" },
      { value: "100%", label: "Productos originales" },
    ],
    highlights: [
      { icon: "Laptop", title: "Productos originales", text: "Nada de réplicas ni equipos refurbished sin avisar." },
      { icon: "BadgeCheck", title: "Garantía oficial", text: "12 meses respaldados por el fabricante." },
      { icon: "Wrench", title: "Soporte técnico local", text: "Te atendemos acá, sin enviar el equipo afuera." },
      { icon: "Truck", title: "Entrega configurada", text: "Llega listo para usar, con Windows instalado." },
      { icon: "Percent", title: "Financiamiento", text: "Consulta por pago en cuotas." },
      { icon: "ShieldCheck", title: "Pago seguro", text: "Compra protegida con EasyPay." },
    ],
  },
  bot: {
    persona:
      "una tienda de tecnología. Atiendes por WhatsApp de forma clara y técnica sin ser complicado, ayudando a elegir el equipo correcto y a cerrar la venta.",
    guidance:
      "Pregunta para qué va a usar el equipo (estudio, trabajo, gaming) y sugiere del catálogo el que mejor encaje en su presupuesto. Menciona la garantía y el soporte técnico como diferenciales.",
  },
};

// ============================================================
//  Registro
// ============================================================

export const RUBROS: Record<RubroId, Rubro> = {
  generico,
  floreria,
  ferreteria,
  repuestos,
  minimarket,
  farmacia,
  restaurante,
  boutique,
  tecnologia,
};

/** Rubros que se ofrecen en el selector del CRM (sin el neutro). */
export const RUBRO_LIST: Rubro[] = [
  floreria,
  ferreteria,
  repuestos,
  minimarket,
  farmacia,
  restaurante,
  boutique,
  tecnologia,
];

/** Instalación nueva = sin rubro definido, todo vacío. */
export const DEFAULT_RUBRO_ID: RubroId = "generico";

/** Devuelve el rubro por id; cae al rubro por defecto si el id no existe. */
export function getRubro(id: string | undefined | null): Rubro {
  return RUBROS[(id ?? "") as RubroId] ?? RUBROS[DEFAULT_RUBRO_ID];
}
