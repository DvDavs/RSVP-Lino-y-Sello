"use client";

import { es_MX } from "@/lib/i18n";

/** `04 §2`: `error.tsx` de `/i/[publicToken]` — cualquier error que no sea 404/403 clasificado. */
export default function ErrorInvitacionPublica({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto", textAlign: "center" }} role="alert">
      <h1>{es_MX.publico.error.titulo}</h1>
      <p>{es_MX.publico.error.cuerpo}</p>
      <button onClick={reset}>{es_MX.comun.reintentar}</button>
    </main>
  );
}
