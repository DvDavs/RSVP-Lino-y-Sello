import type { Historia } from "../../historias/tipos.ts";
import { ProgressRing } from "./ProgressRing.tsx";

export const historias: Historia = {
  slug: "progress-ring",
  nombre: "ProgressRing",
  familia: "superficies",
  descripcion:
    "Anillo de 72 px, trazo de 7. El número va siempre como texto (nunca solo el arco); role=progressbar con aria-valuenow/valuetext.",
  variantes: [
    {
      nombre: "En curso (60 %)",
      render: () => <ProgressRing value={60} label="Progreso de tu invitación" />,
    },
    {
      nombre: "Completo",
      render: () => <ProgressRing value={100} label="Progreso de tu invitación" />,
    },
  ],
  estados: [
    {
      nombre: "Indeterminado",
      render: () => <ProgressRing indeterminate label="Publicando tu invitación" />,
      nota: "Con prefers-reduced-motion, el giro se detiene y el texto «Cargando…» se queda quieto.",
    },
  ],
};
