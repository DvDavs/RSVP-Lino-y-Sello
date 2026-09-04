"use client";

import { es_MX } from "@/lib/i18n";

export default function ErrorPreview({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" style={{ padding: "2rem" }}>
      <p>{es_MX.errores.generico}</p>
      <button onClick={reset}>{es_MX.comun.reintentar}</button>
    </div>
  );
}
