// app/(chrome)/(sitio)/legal/privacidad/page.tsx — `/legal/privacidad`
// (`12-producto-completo.md §B3.9`, §A4.1 para el detalle real de qué guarda `invitation_guest`).
//
// SIN FORMA (regla explícita del wireframe): índice sticky en escritorio, lista al principio en
// móvil (el orden natural del DOM ya lo resuelve: la `nav` va antes que el contenido, así que en una
// sola columna aparece primero sin ningún CSS extra). Medida de línea 70ch en el contenido.
import type { Metadata } from "next";
import Link from "next/link";
import { AvisoBorrador } from "@/components/sitio/AvisoBorrador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.legal.privacidad.titulo,
  description: es_MX.legal.privacidad.intro,
  robots: { index: true, follow: true },
};

export default function PaginaPrivacidad() {
  const { privacidad } = es_MX.legal;

  return (
    <div className="mx-auto w-full max-w-ui-page px-5 pb-16 pt-12 sm:px-8">
      <Link href="/legal" className="text-sm font-semibold text-ui-link hover:underline">
        {es_MX.legal.volverAAvisos}
      </Link>
      <h1 className="display-lg mt-4 text-ui-ink">{privacidad.titulo}</h1>
      <AvisoBorrador className="mt-3" />
      <p className="text-lg mt-4 max-w-[70ch] text-ui-ink-muted">{privacidad.intro}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label={privacidad.enEstaSeccion} className="lg:sticky lg:top-24 lg:h-fit">
          <p className="label-sm text-ui-ink-muted">{privacidad.enEstaSeccion}</p>
          <ol className="text-sm mt-2 flex flex-col gap-1.5">
            {privacidad.secciones.map((seccion) => (
              <li key={seccion.id}>
                <a href={`#${seccion.id}`} className="text-ui-link hover:underline">
                  {seccion.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex max-w-[70ch] flex-col gap-10">
          {privacidad.secciones.map((seccion) => (
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
