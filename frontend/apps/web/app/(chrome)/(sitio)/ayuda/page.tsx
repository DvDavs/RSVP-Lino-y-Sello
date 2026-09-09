// app/(chrome)/(sitio)/ayuda/page.tsx — la página a la que apunta «Ayuda» de la cabecera del sitio
// y del editor, y el ancla `/ayuda#fecha` del campo de fecha.
//
// No es relleno: cada duda de `components/sitio/dudas-ayuda.ts` responde una pregunta que la
// revisión de uso sin instrucciones registró como duda REAL de la clienta (`bitacora/3-ux.md`).
//
// La cabecera de la sección lleva RAYOS pequeños (`11 §7`, fila «Ayuda»), y son la única forma del
// bloque: quedan detrás del titular, nunca bajo el buscador ni bajo el acordeón (`11 §3.4` R3).
import Link from "next/link";
import type { Metadata } from "next";
import { Composition, Rays } from "@invitaciones/ui/shapes";
import { BuscadorAyuda } from "@/components/sitio/BuscadorAyuda";
import { ContactoParaContratar } from "@/components/sitio/ContactoParaContratar";
import { correoDeSoporteDelEntorno } from "@/lib/env";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.ayuda.titulo,
  description: es_MX.ayuda.intro,
};

export default function PaginaAyuda() {
  const correoSoporte = correoDeSoporteDelEntorno();

  return (
    <div className="mx-auto w-full max-w-ui-page px-5 pb-16 sm:px-8">
      <header className="pt-12">
        {/* Los rayos quedan SOLO detrás del titular: `11 §3.4` R3 permite una forma bajo un
            `display-*`, no bajo un párrafo — y sobre `--ui-ink-muted` no habría una pareja de
            contraste verificada que medir. */}
        <Composition
          className="-mx-5 px-5 py-4 sm:-mx-8 sm:px-8"
          shape={<Rays tone="primary-soft" density={10} radius={90} />}
          place="arriba-derecha"
          size="200px"
        >
          <h1 className="display-sm text-ui-ink">{es_MX.ayuda.titulo}</h1>
        </Composition>
        <p className="text-lg mt-2 max-w-[52ch] text-ui-ink-muted">{es_MX.ayuda.intro}</p>
      </header>

      <BuscadorAyuda />

      {/* G-01: ESTA caja es el final del circuito. El botón «Ver planes» del asistente
          (`components/asistente/MisInvitaciones.tsx`) manda aquí a quien todavía no tiene ninguna
          invitación, y hasta el cierre de la fase 3-C lo único que encontraba era «escríbenos por
          el mismo medio por el que contrataste» — un medio que nunca ha tenido. Ahora el contacto
          está aquí, o está dicho por qué todavía no está. */}
      <section aria-labelledby="ayuda-contacto" className="mt-12 rounded-ui-card bg-ui-surface-alt p-6">
        <h2 id="ayuda-contacto" className="heading-sm text-ui-ink">
          {es_MX.ayuda.contacto.titulo}
        </h2>
        <p className="text-md mt-2 max-w-[56ch] text-ui-ink-muted">{es_MX.ayuda.contacto.texto}</p>
        <ContactoParaContratar className="mt-5 border-t border-ui-divider pt-5" />

        {/* Otra bandeja y otro tono que el bloque de arriba (`NEXT_PUBLIC_SOPORTE_CORREO`, no
            `NEXT_PUBLIC_CONTACTO_CORREO`): esto es para quien YA contrató y algo no le funciona,
            no para quien todavía está decidiendo. Mismo criterio honesto si falta la variable. */}
        <div className="mt-6 border-t border-ui-divider pt-5">
          <h3 className="heading-sm text-ui-ink">{es_MX.ayuda.soporte.titulo}</h3>
          {correoSoporte ? (
            <p className="text-md mt-2 max-w-[56ch] text-ui-ink-muted">
              {es_MX.ayuda.soporte.prefijo}{" "}
              <a href={`mailto:${correoSoporte}`} className="font-semibold text-ui-link hover:underline">
                {correoSoporte}
              </a>
              .
            </p>
          ) : (
            <p className="text-md mt-2 max-w-[56ch] text-ui-ink-muted">{es_MX.ayuda.soporte.sinConfigurar}</p>
          )}
        </div>

        <p className="mt-6">
          {/* `inline-flex items-center py-1`: medía 160,6 x 18 px (3C-ADV), por debajo del mínimo
              de 24 px de 2.5.8. No es un enlace dentro de una frase (está solo en su párrafo), así
              que no le vale la excepción «inline» de ese criterio. */}
          <Link
            href="/editor"
            className="inline-flex items-center rounded-ui-control py-1 text-sm font-semibold text-ui-link hover:underline"
          >
            {es_MX.ayuda.volverAlEditor}
          </Link>
        </p>
      </section>
    </div>
  );
}
