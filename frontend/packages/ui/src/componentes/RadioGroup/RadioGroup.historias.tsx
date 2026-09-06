// packages/ui/src/componentes/RadioGroup/RadioGroup.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { RadioGroup } from "./RadioGroup.tsx";

const CONFIRMACION = [
  { value: "si", label: "Sí, ahí estaré", meta: "2 lugares" },
  { value: "no", label: "No podré acompañarlos" },
] as const;

export const historias: readonly Historia[] = [
  {
    slug: "radio-group",
    nombre: "RadioGroup",
    familia: "formularios",
    descripcion: "Radios de 26 px; cada fila es el objetivo (>= 44 px). Flechas para moverse entre opciones.",
    variantes: [
      { nombre: "Confirmación", render: () => <RadioGroup aria-label="Confirmación" opciones={[...CONFIRMACION]} defaultValue="si" /> },
    ],
    estados: [
      { nombre: "Deshabilitado", render: () => <RadioGroup aria-label="Confirmación" opciones={[...CONFIRMACION]} disabled /> },
    ],
  },
];
