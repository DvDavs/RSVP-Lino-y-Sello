// packages/ui/src/componentes/Sheet/Sheet.historias.tsx — misma vitrina que `Dialog`: el porqué,
// medido, está en `historias/escaparate.tsx`.
import type { Historia } from "../../historias/tipos.ts";
import { EscaparateSuperposicion } from "../../historias/escaparate.tsx";
import { Sheet } from "./Sheet.tsx";
import { Button } from "../Button/Button.tsx";

const SIN_FOCO_AUTOMATICO = (evento: Event) => evento.preventDefault();

export const historias: Historia = {
  slug: "sheet",
  nombre: "Sheet",
  familia: "superficies",
  descripcion:
    "Hoja inferior: la versión móvil del diálogo. Asa de arrastre decorativa, borde superior redondeado y acción primaria pegada abajo con safe-area-inset.",
  variantes: [
    {
      nombre: "Elegir plantilla",
      ancho: "completo",
      render: () => (
        <EscaparateSuperposicion etiqueta="Hoja inferior «Elige el punto de partida», abierta" alto={300}>
          {(contenedor) => (
            <Sheet
              open
              modal={false}
              container={contenedor}
              onOpenAutoFocus={SIN_FOCO_AUTOMATICO}
              title="Elige el punto de partida"
              description="Te mostramos solo las plantillas que le van a tu evento."
              footer={
                <Button className="w-full">Continuar con Boda</Button>
              }
            >
              <p className="text-sm text-ui-ink-muted">12 plantillas · 4 incluidas en tu plan</p>
            </Sheet>
          )}
        </EscaparateSuperposicion>
      ),
      nota: "En la galería se expone sin capa modal; en producto se abre con foco atrapado y aria-modal.",
    },
  ],
};
