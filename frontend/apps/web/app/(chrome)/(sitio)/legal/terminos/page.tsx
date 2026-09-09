// app/(chrome)/(sitio)/legal/terminos/page.tsx — `/legal/terminos`
// (`12-producto-completo.md §B3.9`, `ADR-5-0B-01` para «editar gratis, publicar con plan pagado»).
//
// Mismo molde que `/legal/privacidad`: sin forma, índice sticky en escritorio / lista al principio
// en móvil por orden natural del DOM, contenido a 70ch.
import type { Metadata } from "next";
import Link from "next/link";
import { AvisoBorrador } from "@/components/sitio/AvisoBorrador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.legal.terminos.titulo,
  description: es_MX.legal.terminos.intro,
  robots: { index: true, follow: true },
};

export default function PaginaTerminos() {
  const { terminos } = es_MX.legal;

  return (
    <div className="mx-auto w-full max-w-ui-page px-5 pb-16 pt-12 sm:px-8">
      <Link href="/legal" className="text-sm font-semibold text-ui-link hover:underline">
        {es_MX.legal.volverAAvisos}
      </Link>
      <h1 className="display-lg mt-4 text-ui-ink">{terminos.titulo}</h1>
      <AvisoBorrador className="mt-3" />
      <p className="text-lg mt-4 max-w-[70ch] text-ui-ink-muted">{terminos.intro}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label={terminos.enEstaSeccion} className="lg:sticky lg:top-24 lg:h-fit">
          <p className="label-sm text-ui-ink-muted">{terminos.enEstaSeccion}</p>
          <ol className="text-sm mt-2 flex flex-col gap-1.5">
            {terminos.secciones.map((seccion) => (
              <li key={seccion.id}>
                <a href={`#${seccion.id}`} className="text-ui-link hover:underline">
                  {seccion.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex max-w-[70ch] flex-col gap-10">
          {terminos.secciones.map((seccion) => (
            <section key={seccion.id} id={seccion.id} aria-labelledby={`${seccion.id}-titulo`}>
              <h2 id={`${seccion.id}-titulo`} className="heading-lg text-ui-ink">
                {seccion.titulo}
              </h2>
              {seccion.parrafos.map((parrafo, indice) => (
                <p key={indice} className="text-md mt-3 text-ui-ink-muted">
                  {parrafo}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
