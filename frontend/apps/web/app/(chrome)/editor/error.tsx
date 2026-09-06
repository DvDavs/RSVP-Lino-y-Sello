"use client";

import { EmptyState } from "@invitaciones/ui";
import { es_MX } from "@/lib/i18n";

/**
 * `04 §2`: `error.tsx` de `/editor` — captura errores no manejados de render (boundary de Next).
 * Fase 3-C: pasa a ser un estado diseñado del sistema (`11 §5` fila `EmptyState`, ilustración
 * `error-generico`) con una salida real, en vez de un párrafo y un botón sueltos.
 */
export default function ErrorAsistente({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-ui-page px-6 py-10">
      <div role="alert">
        <EmptyState
          ilustracion="error-generico"
          titulo={es_MX.errores.generico}
          texto={es_MX.asistente.errorRed}
          accion={{ etiqueta: es_MX.comun.reintentar, onSelect: reset }}
        />
      </div>
    </main>
  );
}
