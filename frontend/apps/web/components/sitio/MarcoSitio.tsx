// components/sitio/MarcoSitio.tsx — el SHELL de la web pública: enlace de salto, cabecera, `<main>`
// y pie. Lo usan el layout del grupo `(sitio)` y, además, `not-found.tsx` y `error.tsx`, que viven
// obligatoriamente en `app/(chrome)/` (fuera de ese grupo) y aun así tienen que verse como parte
// del sitio y no como una pantalla huérfana.
import type { ReactNode } from "react";
import { CabeceraSitio } from "./CabeceraSitio.tsx";
import { PieSitio } from "./PieSitio.tsx";
import { es_MX } from "@/lib/i18n";

export function MarcoSitio({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ui-surface">
      {/* El enlace de salto es visible EN FOCO (nunca `display:none`, que lo saca del orden de
          tabulación): 2.4.1 con la misma solución que ya usa el editor. */}
      <a
        href="#contenido"
        className="sr-only rounded-ui-control bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-on-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30"
      >
        {es_MX.sitio.saltarAlContenido}
      </a>
      <CabeceraSitio />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <PieSitio />
    </div>
  );
}
