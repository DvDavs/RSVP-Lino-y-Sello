"use client";

import { EmptyState } from "@invitaciones/ui";
import { es_MX } from "@/lib/i18n";

export default function ErrorEditor({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[60vh] place-items-center p-8" role="alert">
      <EmptyState
        ilustracion="error-generico"
        titulo={es_MX.errores.generico}
        texto={es_MX.editor.estados.noPudimosAbrir}
        accion={{ etiqueta: es_MX.comun.reintentar, onSelect: reset }}
      />
    </main>
  );
}
