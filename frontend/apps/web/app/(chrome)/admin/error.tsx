"use client";

// app/(chrome)/admin/error.tsx — frontera de error de ESTA pantalla (`ui-pantalla §2`: en la
// carpeta de la ruta, no en la raíz de `(chrome)` — eso metería este `"use client"` en el JS de
// primera carga de toda ruta del grupo, incluida la portada, ver `(sitio)/acceso/error.tsx`).
//
// Captura errores de RENDER no manejados (no de red: esos ya los cubre cada panel con su propio
// `BloqueConError`/`SessionError`, `ConsolaAdmin.tsx`). `textosAdmin.pagina.errorInesperado` es el
// único texto de página completa del fichero — añadido por E5-D, documentado en su cabecera.
import { EmptyState } from "@invitaciones/ui/componentes/EmptyState.tsx";
import { textosAdmin } from "@/lib/admin/textos";

export default function ErrorAdmin({ reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  const t = textosAdmin.pagina.errorInesperado;
  return (
    <main className="mx-auto w-full max-w-ui-page px-6 py-10">
      <div role="alert">
        <EmptyState ilustracion="error-generico" titulo={t.titulo} texto={t.cuerpo} accion={{ etiqueta: t.accion, onSelect: reset }} />
      </div>
    </main>
  );
}
