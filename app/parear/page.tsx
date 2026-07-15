import { Suspense } from "react";
import type { Metadata } from "next";
import { PairForm } from "@/components/PairForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Parear negocio · easy pos",
  description: "Conectá este equipo con el CRM de tu negocio.",
};

/**
 * Pareo desde el navegador: `/parear` (o `/parear?token=…`, que es el link que
 * entrega el panel de Case junto al QR). El equivalente móvil es escanear el QR
 * — mismo token, misma API.
 */
export default function PairPage() {
  return (
    <Suspense>
      <PairForm />
    </Suspense>
  );
}
