// app/(chrome)/(sitio)/verificar-correo/page.tsx — LA RUTA que el correo de verificación ya manda
// (fase 5, E3; `handoffs/5-E3-A2-contrato-cuenta.md §3`) y que antes de este cambio no existía:
// todo el que pulsara el enlace caía en un 404.
//
// Igual que `/acceso`: el `Suspense` es obligatorio porque `VerificarCorreo` usa `useSearchParams`
// (App Router, next@16.3.4 exige el límite o el build falla).
import { Suspense } from "react";
import type { Metadata } from "next";
import { VerificarCorreo } from "@/components/sitio/VerificarCorreo";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.cuenta.verificarCorreo.titulo,
  // Nunca se indexa ni se sigue: la URL lleva un token de un solo uso (04 §19, mismo criterio que
  // `/editor`, `/perfil`).
  robots: { index: false, follow: false },
};

export default function PaginaVerificarCorreo() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-md mx-auto w-full max-w-lg px-5 py-16 text-center text-ui-ink-muted sm:px-8">
          {es_MX.comun.cargando}
        </p>
      }
    >
      <VerificarCorreo />
    </Suspense>
  );
}
