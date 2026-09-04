"use client";

import { Button } from "@/components/ui/button";
import { es_MX } from "@/lib/i18n";

export default function ErrorEditor({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="p-8" role="alert">
      <p className="text-ui-ink">{es_MX.errores.generico}</p>
      <Button className="mt-4" onClick={reset}>
        {es_MX.comun.reintentar}
      </Button>
    </main>
  );
}
