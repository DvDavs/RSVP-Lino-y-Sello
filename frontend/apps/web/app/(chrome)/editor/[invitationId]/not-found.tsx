import { EmptyState } from "@invitaciones/ui";
import { es_MX } from "@/lib/i18n";

/** `04 §2`: `not-found.tsx` de `/editor/[invitationId]` — `invitationId` con forma inválida. */
export default function InvitacionNoEncontrada() {
  return (
    <main className="grid min-h-[60vh] place-items-center p-8">
      <EmptyState
        ilustracion="sin-invitaciones"
        titulo={es_MX.errores.noEncontrado}
        texto={es_MX.editor.estados.invitacionNoEncontrada}
        accion={{ etiqueta: es_MX.comun.misInvitaciones, href: "/editor" }}
      />
    </main>
  );
}
