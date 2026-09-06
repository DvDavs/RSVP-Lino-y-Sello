import { Skeleton } from "@invitaciones/ui";
import { es_MX } from "@/lib/i18n";

/**
 * `11 §6.2` regla 6: ninguna espera larga sin progreso. En vez de una línea de texto suelta, el
 * armazón del editor (barra + panel + lienzo) en esqueleto, con el texto de estado para lectores de
 * pantalla.
 */
export default function CargandoEditor() {
  return (
    <main className="flex h-screen flex-col gap-4 bg-ui-surface-alt p-4" aria-busy="true">
      <Skeleton variante="bloque" etiqueta={es_MX.editor.estados.cargandoEditor} className="h-12 w-full rounded-ui-card" />
      <div className="grid min-h-0 flex-1 gap-4 ed:grid-cols-[minmax(280px,340px)_1fr]">
        <Skeleton variante="bloque" className="h-full w-full rounded-ui-card" />
        <Skeleton variante="bloque" className="hidden h-full w-full rounded-ui-card ed:block" />
      </div>
    </main>
  );
}
