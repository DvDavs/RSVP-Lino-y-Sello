import { Skeleton } from "@invitaciones/ui";
import { es_MX } from "@/lib/i18n";

/**
 * `04 §2`: `loading.tsx` de la ruta `/editor` — límite de Suspense mientras Next navega aquí.
 * Fase 3-C: deja de ser una línea de texto suelta y pinta el esqueleto de lo que va a aparecer
 * (`11 §6.2` regla 6: «cualquier espera superior a 400 ms muestra skeleton o progreso con texto;
 * nunca una pantalla vacía»).
 */
export default function CargandoAsistente() {
  return (
    <main className="mx-auto flex w-full max-w-ui-page flex-col gap-8 px-6 py-10" aria-busy="true">
      <p role="status" aria-live="polite" className="text-md text-ui-ink-muted">
        {es_MX.asistente.cargando}
      </p>
      <Skeleton variante="bloque" alto={56} ancho="min(28rem, 100%)" etiqueta={es_MX.asistente.cargando} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} variante="bloque" alto={190} />
        ))}
      </div>
    </main>
  );
}
