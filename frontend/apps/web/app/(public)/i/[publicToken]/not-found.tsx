import { es_MX } from "@/lib/i18n";

/**
 * `04 §2`: `not-found.tsx` de `/i/[publicToken]` — `404 TPL_RELEASE_NOT_FOUND` / `403
 * TPL_INVITATION_UNAVAILABLE` (03 §3.15: mismo mensaje al público para ambos, para no dar un
 * oráculo de enumeración de tokens). Sin chrome, sin tokens `--ui-*` (esta ruta no importa
 * `globals.css`, P3).
 */
export default function InvitacionNoDisponible() {
  return (
    <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      <h1>{es_MX.publico.noDisponible.titulo}</h1>
      <p>{es_MX.publico.noDisponible.cuerpo}</p>
    </main>
  );
}
