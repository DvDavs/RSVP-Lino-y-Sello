import { es_MX } from "@/lib/i18n";

/** `04 §2`: `not-found.tsx` de `/editor/[invitationId]` — `invitationId` con forma inválida. */
export default function InvitacionNoEncontrada() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>{es_MX.errores.noEncontrado}</h1>
    </main>
  );
}
