// app/(chrome)/editor/[invitationId]/plan/page.tsx — «Plan de esta invitación» (fase 5, sesión E4).
// Sustituye ENTERO el marcador del andamio 5-0d (ver `README.md` de esta carpeta).
//
// Server component mínimo: solo `metadata` y el límite de `Suspense` que `useSearchParams` exige en
// el App Router (`PantallaPlan` lee `?plan=<codigo>`; mismo patrón que `/acceso` y `/precios`). La
// carga de datos es de CLIENTE porque el token de sesión vive en `sessionStorage` (P8) — igual que
// `app/(chrome)/editor/[invitationId]/page.tsx`, el resto del editor.
import { Suspense } from "react";
import type { Metadata } from "next";
import { es_MX } from "@/lib/i18n";
import { PantallaPlan } from "@/components/plan/PantallaPlan.tsx";

export const metadata: Metadata = {
  title: `${es_MX.panel.plan.metaTitulo} · Lino & Sello`,
  robots: { index: false, follow: false },
};

export default async function PaginaPlan({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  return (
    <Suspense
      fallback={
        <p role="status" className="text-md mx-auto w-full max-w-ui-page px-4 py-10 text-ui-ink-muted sm:px-8">
          {es_MX.panel.plan.cargando}
        </p>
      }
    >
      <PantallaPlan invitationId={invitationId} />
    </Suspense>
  );
}
