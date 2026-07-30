import type { Metadata } from "next";

// El panel es una herramienta interna del equipo easy pos: fuera de los
// buscadores. Hereda fuentes y estilos del layout raíz.
export const metadata: Metadata = {
  title: "Panel de negocios · easy pos",
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
