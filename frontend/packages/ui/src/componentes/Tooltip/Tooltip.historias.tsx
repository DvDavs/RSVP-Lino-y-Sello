import { IconoDeshacer } from "@invitaciones/icons";
import type { Historia } from "../../historias/tipos.ts";
import { Tooltip } from "./Tooltip.tsx";

export const historias: Historia = {
  slug: "tooltip",
  nombre: "Tooltip",
  familia: "superficies",
  descripcion:
    "Información complementaria al enfocar (sin retardo) o al pasar el ratón. Nunca es el único portador de una información: en táctil no aparece.",
  variantes: [
    {
      nombre: "Sobre un botón de icono",
      render: () => (
        <Tooltip content="Deshacer (Ctrl+Z)">
          <button
            type="button"
            aria-label="Deshacer"
            className="inline-flex h-11 w-11 items-center justify-center rounded-ui-pill bg-ui-surface-alt text-ui-ink"
          >
            <IconoDeshacer size={20} />
          </button>
        </Tooltip>
      ),
      nota: "El botón lleva su propio aria-label: el tooltip complementa, no sustituye el nombre accesible.",
    },
  ],
};
