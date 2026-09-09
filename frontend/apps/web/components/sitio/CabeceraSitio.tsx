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
        {/* `inline-flex items-center py-1`: sin relleno vertical el enlace medía 109,4 x 23,4 px
            (3C-ADV, `getBoundingClientRect`), 0,6 px por debajo del mínimo de 24 px de WCAG 2.2 AA
            2.5.8. El `py-1` no mueve un píxel de la cabecera — el botón «Entrar» de la derecha ya
            es más alto y es él quien fija la altura de la fila. */}
        {/* Marca tipográfica temporal (D-02: sin logotipo todavía): el nombre en la voz `display`
            del sistema (Fraunces), nada más — ni un monograma, ni una forma que insinúe un
            logotipo. `display-sm` y no `heading-sm`: la cabecera es el sitio donde el nombre
            aparece como IDENTIDAD, no como título de bloque. */}
        <Link href="/" className="display-sm inline-flex items-center rounded-ui-control py-1 text-ui-ink">
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
