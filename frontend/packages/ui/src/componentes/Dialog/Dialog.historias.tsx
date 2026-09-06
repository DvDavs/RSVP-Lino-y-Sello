// packages/ui/src/componentes/Dialog/Dialog.historias.tsx — el diálogo se expone ABIERTO, pero
// dentro de una vitrina (`EscaparateSuperposicion`) y sin capa modal: ver el comentario largo de
// `historias/escaparate.tsx` para las tres cosas que un modal de verdad le hace a la página de la
// galería (aria-hidden, pointer-events y position: fixed contra la ventana).
import type { Historia } from "../../historias/tipos.ts";
import { EscaparateSuperposicion } from "../../historias/escaparate.tsx";
import { Dialog } from "./Dialog.tsx";
import { Button } from "../Button/Button.tsx";

/** Ni foco automático ni cierre: en una vitrina el panel es un expositor, no una capa activa. */
const SIN_FOCO_AUTOMATICO = (evento: Event) => evento.preventDefault();

export const historias: Historia = {
  slug: "dialog",
  nombre: "Dialog",
  familia: "superficies",
  descripcion:
    "Diálogo modal con foco atrapado y devuelto, título y descripción accesibles obligatorios. Esc y el clic fuera cierran, salvo en el estado ocupado (publicando).",
  variantes: [
    {
      nombre: "Antes de publicar",
      ancho: "completo",
      render: () => (
        <EscaparateSuperposicion etiqueta="Diálogo «Antes de publicar», abierto" alto={400}>
          {(contenedor) => (
            <Dialog
              open
              modal={false}
              container={contenedor}
              onOpenAutoFocus={SIN_FOCO_AUTOMATICO}
              title="Antes de publicar revisamos tu invitación"
              description="Falta el nombre del lugar de la ceremonia. «Nuestra historia» sigue con el texto de ejemplo."
              footer={
                // Botones del sistema, no marcado a mano: la ficha tiene que enseñar el `Button`
                // de verdad (la vieja pareja usaba la voz `label` en mono para «Cancelar», que en
                // `11 §2.2` es para etiquetas y cintillos, nunca para una acción).
                <>
                  <Button variant="terciario">Cancelar</Button>
                  <Button disabled>Publicar</Button>
                </>
              }
            >
              <div className="rounded-ui-card bg-ui-danger-soft px-3 py-2 text-sm text-ui-on-danger-soft">
                Falta el lugar de la ceremonia
              </div>
            </Dialog>
          )}
        </EscaparateSuperposicion>
      ),
      nota: "En la galería se expone sin capa modal; en producto se abre con foco atrapado y aria-modal.",
    },
  ],
  estados: [
    {
      nombre: "Ocupado (publicando)",
      ancho: "completo",
      render: () => (
        <EscaparateSuperposicion etiqueta="Diálogo «Publicando», abierto y ocupado" alto={160}>
          {(contenedor) => (
            <Dialog
              open
              busy
              modal={false}
              container={contenedor}
              onOpenAutoFocus={SIN_FOCO_AUTOMATICO}
              title="Publicando"
              description="Estamos publicando tu invitación."
              descriptionHidden
            >
              <p className="text-sm text-ui-ink" aria-live="polite">
                Publicando…
              </p>
            </Dialog>
          )}
        </EscaparateSuperposicion>
      ),
      nota: "Esc y el clic fuera no cierran; el botón de cerrar queda deshabilitado.",
    },
  ],
};
