import type { Historia } from "../../historias/tipos.ts";
import { WizardProgress } from "./WizardProgress.tsx";

// El componente se estira al ancho de su contenedor: en la galería se le da el ancho REAL de una
// columna de asistente (420 px), no el ancho mínimo que tomaría centrado en una ficha estrecha —
// ahí las etiquetas se parten por la mitad y enseñan algo que el producto nunca enseña.
const ANCHO_ASISTENTE = "w-full max-w-[420px]";

export const historias: Historia = {
  slug: "wizard-progress",
  nombre: "WizardProgress",
  familia: "navegacion",
  descripcion:
    "Progreso del asistente de creación: círculos con número o check, líneas entre pasos y el texto «Paso N de M». Los pasos hechos son enlaces para volver atrás.",
  variantes: [
    {
      nombre: "Paso 2 de 4 (Plantilla)",
      ancho: "completo",
      render: () => (
        <div className={ANCHO_ASISTENTE}>
          <WizardProgress
            pasos={[
              { id: "evento", etiqueta: "Evento", estado: "hecho", href: "#evento" },
              { id: "plantilla", etiqueta: "Plantilla", estado: "actual" },
              { id: "datos", etiqueta: "Datos", estado: "pendiente" },
              { id: "editor", etiqueta: "Editor", estado: "pendiente" },
            ]}
          />
        </div>
      ),
    },
  ],
  estados: [
    {
      nombre: "Con error en un paso",
      ancho: "completo",
      render: () => (
        <div className={ANCHO_ASISTENTE}>
          <WizardProgress
            pasos={[
              { id: "evento", etiqueta: "Evento", estado: "hecho", href: "#evento" },
              { id: "plantilla", etiqueta: "Plantilla", estado: "error" },
              { id: "datos", etiqueta: "Datos", estado: "pendiente" },
            ]}
          />
        </div>
      ),
    },
  ],
};
