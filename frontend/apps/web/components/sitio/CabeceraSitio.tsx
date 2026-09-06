// components/sitio/CabeceraSitio.tsx — la cabecera de la WEB PÚBLICA (`/`, `/acceso`, `/ayuda`, 404
// y error). No es la del editor (`components/editor/EncabezadoSitio.tsx`, de otro dueño): esta no
// sabe si hay sesión y no puede saberlo sin volverse cliente, así que ofrece la única acción que
// sirve en los dos casos — «Entrar», que con sesión viva redirige sola al editor.
//
// Componente de SERVIDOR y sin menú desplegable a propósito: son cuatro destinos, caben en una
// fila incluso a 390 px, y un menú de hamburguesa costaría JavaScript en la ruta que peor lo puede
// pagar (`/`, LCP < 2,5 s en móvil, `contratos.md §8`).
import Link from "next/link";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { es_MX } from "@/lib/i18n";

const CLASE_ENLACE =
  "rounded-ui-control px-2 py-2 text-sm font-semibold text-ui-ink transition-colors hover:text-ui-link";

export function CabeceraSitio() {
  return (
    <header className="border-b border-ui-divider bg-ui-surface">
      <div className="mx-auto flex w-full max-w-ui-page items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <Link href="/" className="heading-sm rounded-ui-control text-ui-ink">
          {es_MX.comun.marca}
        </Link>

        <nav aria-label={es_MX.sitio.navegacion} className="flex items-center gap-1 sm:gap-2">
          {/* Los dos anclajes son de la portada: fuera de ella no llevan a ningún sitio útil, por
              eso apuntan a `/#…` y no a `#…`. */}
          <Link href="/#como-funciona" className={`${CLASE_ENLACE} hidden sm:inline-block`}>
            {es_MX.sitio.comoFunciona}
          </Link>
          <Link href="/#tipos-de-evento" className={`${CLASE_ENLACE} hidden md:inline-block`}>
            {es_MX.sitio.paraCadaCelebracion}
          </Link>
          <Link href="/ayuda" className={CLASE_ENLACE}>
            {es_MX.comun.ayuda}
          </Link>
          <Button asChild variant="primario" size="sm">
            <Link href="/acceso">{es_MX.comun.entrar}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
