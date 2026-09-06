import type { Historia } from "../../historias/tipos.ts";
import { Sheet } from "./Sheet.tsx";

export const historias: Historia = {
  slug: "sheet",
  nombre: "Sheet",
  familia: "superficies",
  descripcion:
    "Hoja inferior: la versión móvil del diálogo. Asa de arrastre decorativa, borde superior redondeado y acción primaria pegada abajo con safe-area-inset.",
  variantes: [
    {
      nombre: "Elegir plantilla",
      render: () => (
        <Sheet
          open
          title="Elige el punto de partida"
          description="Te mostramos solo las plantillas que le van a tu evento."
          footer={
            <button type="button" className="w-full rounded-ui-pill bg-ui-primary py-3 text-sm font-semibold text-ui-on-primary">
              Continuar con Boda
            </button>
          }
        >
          <p className="text-sm text-ui-ink-muted">12 plantillas · 4 incluidas en tu plan</p>
        </Sheet>
      ),
    },
  ],
};
