"use client";

import { Button } from "@/components/ui/button";
import { es_MX } from "@/lib/i18n";

/** `04 §2`: `error.tsx` de `/editor` — captura errores no manejados de render (boundary de Next). */
export default function ErrorCatalogo({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10" role="alert">
      <p className="text-ui-ink">{es_MX.errores.generico}</p>
      <Button className="mt-4" onClick={reset}>
        {es_MX.comun.reintentar}
      </Button>
    </main>
  );
}
