// packages/ui/src/componentes/Combobox/Combobox.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { Combobox } from "./Combobox.tsx";
import { Field } from "../Field/Field.tsx";

const CIUDADES = [
  { value: "cdmx", label: "Ciudad de México" },
  { value: "gdl", label: "Guadalajara" },
  { value: "mty", label: "Monterrey" },
  { value: "pue", label: "Puebla" },
  { value: "qro", label: "Querétaro" },
  { value: "mer", label: "Mérida", disabled: true },
] as const;

export const historias: readonly Historia[] = [
  {
    slug: "combobox",
    nombre: "Combobox",
    familia: "formularios",
    descripcion: "Selector con búsqueda para listas largas: campo + panel propio, aria-activedescendant.",
    variantes: [
      {
        nombre: "Con Field",
        render: () => (
          <Field label="Ciudad">
            <Combobox opciones={[...CIUDADES]} placeholder="Buscar…" />
          </Field>
        ),
      },
    ],
    estados: [
      { nombre: "Deshabilitado", render: () => <Combobox aria-label="Ciudad" opciones={[...CIUDADES]} disabled /> },
    ],
  },
];
