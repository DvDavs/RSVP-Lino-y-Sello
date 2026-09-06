import type { Historia } from "../../historias/tipos.ts";
import { Dialog } from "./Dialog.tsx";

export const historias: Historia = {
  slug: "dialog",
  nombre: "Dialog",
  familia: "superficies",
  descripcion:
    "Diálogo modal con foco atrapado y devuelto, título y descripción accesibles obligatorios. Esc y el clic fuera cierran, salvo en el estado ocupado (publicando).",
  variantes: [
    {
      nombre: "Antes de publicar",
      render: () => (
        <Dialog
          open
          title="Antes de publicar revisamos tu invitación"
          description="Falta el nombre del lugar de la ceremonia. «Nuestra historia» sigue con el texto de ejemplo."
          footer={
            <>
              <button type="button" className="label-md text-ui-ink-muted">
                Cancelar
              </button>
              <button type="button" disabled className="rounded-ui-pill bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-on-primary disabled:opacity-45">
                Publicar
              </button>
            </>
          }
        >
          <div className="rounded-ui-card bg-ui-danger-soft px-3 py-2 text-sm text-ui-on-danger-soft">
            Falta el lugar de la ceremonia
          </div>
        </Dialog>
      ),
    },
  ],
  estados: [
    {
      nombre: "Ocupado (publicando)",
      render: () => (
        <Dialog open busy title="Publicando" description="Estamos publicando tu invitación." descriptionHidden>
          <p className="text-sm text-ui-ink" aria-live="polite">
            Publicando…
          </p>
        </Dialog>
      ),
      nota: "Esc y el clic fuera no cierran; el botón de cerrar queda deshabilitado.",
    },
  ],
};
