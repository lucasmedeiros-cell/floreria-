// ===== Configuración del negocio =====
export const kWhatsapp = "59170000000"; // <- número real de FloresOnline
export const kPayReference = "FLORESONLINE-EASYPAY";

export type ProductStatus = "activo" | "inactivo";

export const productStatusLabel = (s: ProductStatus): string =>
  s === "activo" ? "Activo" : "Inactivo";

export interface Product {
  id: string; // SKU / código único (R208)
  name: string;
  desc: string;
  price: number; // Bs
  image: string;
  category: string;
  featured?: boolean;
  stock?: number;
  status?: ProductStatus;
}

export const kAll = "Todos";
export const kCategories = [kAll, "Rosas", "Ramos", "Girasoles", "Exóticas"];

/** Categorías seleccionables al registrar un producto (sin "Todos"). */
export const kProductCategories = kCategories.filter((c) => c !== kAll);

/**
 * Búsqueda rápida por SKU/código (id), nombre, categoría y palabras clave
 * (descripción). Todos los términos deben coincidir (AND).
 */
export function searchProducts(list: Product[], q: string): Product[] {
  const t = q.trim().toLowerCase();
  if (!t) return list;
  const terms = t.split(/\s+/);
  return list.filter((p) => {
    const hay = `${p.id} ${p.name} ${p.category} ${p.desc}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}

export const kProducts: Product[] = [
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
];

export const productById = (id: string): Product =>
  kProducts.find((p) => p.id === id)!;

/** "1850" -> "1.850" (separador de miles es-BO). */
function group(n: number): string {
  const s = Math.abs(n).toString();
  let b = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) b += ".";
    b += s[i];
  }
  return (n < 0 ? "-" : "") + b;
}

export const bs = (n: number): string => `Bs ${group(n)}`;

/** 305.0 -> "Bs 305,00" */
export function bs2(v: number): string {
  const neg = v < 0;
  v = Math.abs(v);
  const intPart = Math.floor(v);
  const dec = Math.round((v - intPart) * 100);
  const decStr = dec.toString().padStart(2, "0");
  return `${neg ? "-" : ""}Bs ${group(intPart)},${decStr}`;
}
