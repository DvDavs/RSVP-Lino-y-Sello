import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MarcoDeTema } from "./_componentes/marco-de-tema.tsx";
import { NavegacionGaleria } from "./_componentes/navegacion.tsx";

/**
 * Galería viva del sistema de diseño del producto (`11 §8.1`). Vive dentro de `app/(chrome)/**`
 * porque es la única parte del árbol donde la compuerta `test/tokens-no-leak.test.ts` permite
 * tokens `--ui-*`; el render público y el lienzo no la alcanzan.
 *
 * `noindex`: es documentación interna, no producto. La bandera de entorno que la deje fuera del
 * build de producción está pendiente de decisión del dueño (`preguntas-abiertas.md`, P-3C-1-2).
 */
export const metadata: Metadata = {
  title: "Sistema de diseño",
  robots: { index: false, follow: false },
};

export default function DesignLayout({ children }: { children: ReactNode }) {
  return (
    <MarcoDeTema>
      <div className="mx-auto grid max-w-ui-page gap-8 px-4 py-8 md:grid-cols-[200px_minmax(0,1fr)]">
        <NavegacionGaleria />
        <main className="min-w-0">{children}</main>
      </div>
    </MarcoDeTema>
  );
}
