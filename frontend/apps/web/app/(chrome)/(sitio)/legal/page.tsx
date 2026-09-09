// app/(chrome)/(sitio)/legal/page.tsx — `/legal`, el índice (`12-producto-completo.md §B3.9`).
// Sustituye ENTERO al marcador de `5-0d` (ver `README.md` de esta carpeta).
//
// SIN NINGUNA FORMA (el wireframe lo dice explícitamente): es una página de lectura, la única
// disciplina es la medida de línea (70ch) y el ritmo vertical. Solo dos rutas hijas: aviso de
// privacidad y términos. NO hay `/legal/cookies` — el producto no pone ninguna cookie de terceros
// (sesión por token en `localStorage`, sin analítica ni script de seguimiento; comprobado en el
// código antes de escribir nada, ADR de este bloque en `decisiones.md`), así que una política de
// cookies aquí mentiría sobre algo que no existe.
import type { Metadata } from "next";
import Link from "next/link";
import { AvisoBorrador } from "@/components/sitio/AvisoBorrador";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.legal.indice.titulo,
  description: es_MX.legal.indice.subtitulo,
  robots: { index: true, follow: true },
};

const CLASE_TARJETA =
  "block rounded-ui-card border border-ui-divider p-5 transition-colors hover:border-ui-link focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus";

export default function PaginaLegal() {
  const { indice } = es_MX.legal;

  return (
    <div className="mx-auto w-full max-w-[70ch] px-5 pb-16 pt-12 sm:px-8">
      <h1 className="display-lg text-ui-ink">{indice.titulo}</h1>
      <AvisoBorrador className="mt-3" />
      <p className="text-md mt-4 text-ui-ink-muted">{indice.subtitulo}</p>

      <nav aria-label={indice.enEstaPagina} className="mt-10 flex flex-col gap-5">
        <Link href="/legal/privacidad" className={CLASE_TARJETA}>
          <h2 className="heading-md text-ui-ink">{indice.privacidad.enlace}</h2>
          <p className="text-sm mt-1.5 text-ui-ink-muted">{indice.privacidad.resumen}</p>
          <ul className="text-sm mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ui-ink-muted">
            {indice.privacidad.subtemas.map((tema) => (
              <li key={tema}>{tema}</li>
            ))}
          </ul>
        </Link>
        <Link href="/legal/terminos" className={CLASE_TARJETA}>
          <h2 className="heading-md text-ui-ink">{indice.terminos.enlace}</h2>
          <p className="text-sm mt-1.5 text-ui-ink-muted">{indice.terminos.resumen}</p>
          <ul className="text-sm mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ui-ink-muted">
            {indice.terminos.subtemas.map((tema) => (
              <li key={tema}>{tema}</li>
            ))}
          </ul>
        </Link>
      </nav>
    </div>
  );
}
