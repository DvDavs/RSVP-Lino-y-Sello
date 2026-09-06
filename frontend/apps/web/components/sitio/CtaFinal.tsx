// components/sitio/CtaFinal.tsx — el cierre de la portada: una sola frase y una sola acción.
//
// Forma protagonista del bloque: RAYAS diagonales del sistema (`Stripes`, `11 §3.1`, «fondo de
// banda»), en un matiz de apoyo distinto del fondo (`11 §3.4` R2). NO van detrás del texto: ocupan
// una franja propia —arriba en móvil, la columna derecha en escritorio— porque `11 §3.4` R3 solo
// deja una forma bajo un `display-*` o una foto, y aquí hay además un párrafo y un botón. Además,
// el contraste se mide sobre la pila renderizada: con dos fondos distintos bajo la misma tinta no
// habría UNA cifra que verificar, sino dos.
//
// El botón usa la variante de ACENTO y no la primaria: `11 §5` prohíbe dos botones primarios en una
// misma vista, y el primario de esta página ya está en el héroe.
import Link from "next/link";
import { Button } from "@invitaciones/ui/componentes/Button/index.ts";
import { Stripes } from "@invitaciones/ui/shapes";
import { es_MX } from "@/lib/i18n";

export function CtaFinal() {
  return (
    <section aria-labelledby="cta-final-titulo" className="bg-ui-surface px-5 pb-16 pt-4 sm:px-8">
      <div className="mx-auto grid w-full max-w-ui-page overflow-hidden rounded-ui-hero bg-ui-primary-soft md:grid-cols-[minmax(0,1fr)_240px]">
        <div aria-hidden="true" className="h-16 w-full md:order-2 md:h-full">
          <Stripes tone="support-2-soft" angle={-24} gap={20} width={9} className="h-full w-full" />
        </div>
        <div className="px-6 py-12 sm:px-10 sm:py-16 md:order-1">
          <h2 id="cta-final-titulo" className="display-md text-ui-on-primary-soft">
            {es_MX.sitio.ctaFinal.titulo}
          </h2>
          <p className="text-lg mt-3 max-w-[44ch] text-ui-on-primary-soft">{es_MX.sitio.ctaFinal.cuerpo}</p>
          <div className="mt-7">
            <Button asChild variant="acento" size="lg">
              <Link href="/editor">{es_MX.sitio.ctaFinal.accion}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
