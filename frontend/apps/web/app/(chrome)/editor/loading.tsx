import { es_MX } from "@/lib/i18n";

/** `04 §2`: `loading.tsx` de la ruta `/editor` — límite de Suspense mientras Next navega aquí. */
export default function CargandoCatalogo() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p role="status" aria-live="polite" className="text-ui-ink-muted">
        {es_MX.comun.cargando}
      </p>
    </main>
  );
}
