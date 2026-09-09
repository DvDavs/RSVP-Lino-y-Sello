// app/(chrome)/(sitio)/pago/page.tsx — la vuelta de Stripe Checkout (fase 5, sesión E4).
// Sustituye ENTERO el marcador de 5-0d (ver `README.md` de esta carpeta).
//
// Server component: solo metadatos y el límite de `Suspense` que `useSearchParams` exige en el App
// Router (mismo patrón que `/precios` y `/acceso`). Todo el estado del pago se pide al backend
// DESDE EL NAVEGADOR (`PantallaPago`, `"use client"`): esta página no hace ningún fetch y nunca
// decide "pagado" por sí misma.
import { Suspense } from "react";
import type { Metadata } from "next";
import { CargaPago } from "@/components/pago/CargaPago";
import { PantallaPago } from "@/components/pago/PantallaPago";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { absolute: es_MX.sitio.pago.tituloDocumento },
  // `noindex` PERMANENTE: esta página lleva identificadores de sesión de compra en la URL y no
  // tiene sentido fuera del flujo de vuelta de Checkout (README de esta carpeta).
  robots: { index: false, follow: false },
};

export default function PaginaPago() {
  return (
    <Suspense fallback={<CargaPago />}>
      <PantallaPago />
    </Suspense>
  );
}
