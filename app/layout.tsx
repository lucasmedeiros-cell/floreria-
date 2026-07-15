import type { Metadata } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Poppins, Dancing_Script } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/context/StoreProvider";
import { ToastHost } from "@/components/Toast";
import { readBusinessConfig } from "@/lib/businessStore";
import { readProducts } from "@/lib/productsStore";
import { themeVars } from "@/lib/business";
import { runWithSlug } from "@/lib/tenant";
import { NEGOCIO_HEADER } from "@/lib/tenantRequest";

/**
 * El layout es uno solo para todos los negocios, así que la marca y el catálogo
 * salen de la base del negocio de ESTA request: el middleware dejó su slug en
 * el header cuando la URL era `/n/<slug>/…`. Sin slug (instalación de un solo
 * negocio) lee la base por defecto, como siempre.
 */
function conNegocio<T>(fn: () => Promise<T>): Promise<T> {
  return runWithSlug(headers().get(NEGOCIO_HEADER), fn);
}

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  // 800/900: titulares gruesos de la landing promocional.
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
  display: "swap",
});

const dancing = Dancing_Script({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-dancing",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const b = await conNegocio(readBusinessConfig);
  return {
    title: `${b.name} · ${b.tagline.toLowerCase()}`,
    description: b.about,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Config del negocio y catálogo se resuelven en el servidor: así la primera
  // pintura ya sale con el color, los textos y los productos correctos.
  const { business, products } = await conNegocio(async () => {
    const [business, products] = await Promise.all([
      readBusinessConfig(),
      readProducts(),
    ]);
    return { business, products };
  });

  return (
    <html lang="es">
      <body
        style={themeVars(business) as React.CSSProperties}
        className={`${cormorant.variable} ${poppins.variable} ${dancing.variable} font-sans text-ink bg-bg`}
      >
        <StoreProvider business={business} products={products}>
          {children}
          <ToastHost />
        </StoreProvider>
      </body>
    </html>
  );
}
