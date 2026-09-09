// app/(chrome)/(sitio)/precios/page.tsx — el catálogo real de planes (fase 5, sesión E4).
// Sustituye ENTERO el marcador de 5-0d (ver `README.md` de esta carpeta).
//
// Server component: solo metadatos y el límite de `Suspense` que `useSearchParams` exige en el App
// Router (mismo patrón que `/acceso`, verificado en next@16.3.4 — sin él el build falla con
// «useSearchParams should be wrapped in a suspense boundary»). Todo el catálogo se pide al backend
// DESDE EL NAVEGADOR (`PantallaPrecios`, `"use client"`): esta página no hace ningún fetch.
import { Suspense } from "react";
import type { Metadata } from "next";
import { CargaDePlanes } from "@/components/precios/CargaDePlanes";
import { PantallaPrecios } from "@/components/precios/PantallaPrecios";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { absolute: es_MX.sitio.precios.tituloDocumento },
  description: es_MX.sitio.precios.descripcionDocumento,
  // Página de venta: a diferencia del marcador que sustituye, esta SÍ se indexa (README de esta
  // carpeta, sección «Notas del andamio»).
  robots: { index: true, follow: true },
};

export default function PaginaPrecios() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-ui-page px-5 pb-16 pt-12 sm:px-8">
          <CargaDePlanes />
        </div>
      }
    >
      <PantallaPrecios />
    </Suspense>
  );
}
