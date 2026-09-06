import type { Historia } from "../../historias/tipos.ts";
import { WizardProgress } from "./WizardProgress.tsx";

export const historias: Historia = {
  slug: "wizard-progress",
  nombre: "WizardProgress",
  familia: "navegacion",
  descripcion:
    "Progreso del asistente de creación: círculos con número o check, líneas entre pasos y el texto «Paso N de M». Los pasos hechos son enlaces para volver atrás.",
  variantes: [
    {
      nombre: "Paso 2 de 4 (Plantilla)",
      render: () => (
        <WizardProgress
          pasos={[
            { id: "evento", etiqueta: "Evento", estado: "hecho", href: "#evento" },
            { id: "plantilla", etiqueta: "Plantilla", estado: "actual" },
            { id: "datos", etiqueta: "Datos", estado: "pendiente" },
            { id: "editor", etiqueta: "Editor", estado: "pendiente" },
          ]}
        />
      ),
    },
  ],
  estados: [
    {
      nombre: "Con error en un paso",
      render: () => (
        <WizardProgress
          pasos={[
            { id: "evento", etiqueta: "Evento", estado: "hecho", href: "#evento" },
            { id: "plantilla", etiqueta: "Plantilla", estado: "error" },
            { id: "datos", etiqueta: "Datos", estado: "pendiente" },
          ]}
        />
      ),
    },
  ],
};
