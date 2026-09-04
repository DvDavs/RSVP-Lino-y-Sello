import { es_MX } from "@/lib/i18n";

export default function CargandoEditor() {
  return (
    <main className="p-8">
      <p role="status" aria-live="polite" className="text-ui-ink-muted">
        {es_MX.comun.cargando}
      </p>
    </main>
  );
}
