import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
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

// Fuentes auto-hospedadas (subset latin, mismos pesos que antes). Se sirven
// desde app/fonts/ para que el `next build` no dependa de bajar nada de Google
// en tiempo de compilación: builds reproducibles y sin cortes de red.
const cormorant = localFont({
  src: [
    { path: "./fonts/cormorant-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

const poppins = localFont({
  // 800/900: titulares gruesos de la landing promocional.
  src: [
    { path: "./fonts/poppins-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/poppins-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const dancing = localFont({
  src: [{ path: "./fonts/dancing-700.woff2", weight: "700", style: "normal" }],
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
