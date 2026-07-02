import type { Metadata } from "next";
import { Cormorant_Garamond, Poppins, Dancing_Script } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/context/StoreProvider";
import { ToastHost } from "@/components/Toast";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const dancing = Dancing_Script({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-dancing",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FloresOnline · Arte floral en cada detalle",
  description:
    "Arreglos florales de autor con entrega el mismo día en Santa Cruz.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${cormorant.variable} ${poppins.variable} ${dancing.variable} font-sans text-ink bg-bg`}
      >
        <StoreProvider>
          {children}
          <ToastHost />
        </StoreProvider>
      </body>
    </html>
  );
}
