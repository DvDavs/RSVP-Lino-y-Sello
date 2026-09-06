// packages/ui/src/componentes/Select/Select.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { Select } from "./Select.tsx";
import { Field } from "../Field/Field.tsx";

const TIPOS_EVENTO = [
  { value: "boda", label: "Boda" },
  { value: "xv", label: "XV años" },
  { value: "bautizo", label: "Bautizo" },
  { value: "comunion", label: "Primera comunión" },
  { value: "corporativo", label: "Corporativo", disabled: true, motivo: "Requiere el plan 2" },
] as const;

export const historias: readonly Historia[] = [
  {
    slug: "select",
    nombre: "Select",
    familia: "formularios",
    descripcion: "Selector propio para listas de hasta 5 opciones fijas; Radix Select por debajo.",
    variantes: [
      {
        nombre: "Con Field",
        render: () => (
          <Field label="Tipo de evento">
            <Select opciones={[...TIPOS_EVENTO]} placeholder="Elige un tipo" />
          </Field>
        ),
      },
      { nombre: "Abierto (fijo)", render: () => <Select aria-label="Tipo de evento" opciones={[...TIPOS_EVENTO]} defaultValue="boda" defaultOpen /> },
    ],
    estados: [
      { nombre: "Deshabilitado", render: () => <Select aria-label="Tipo de evento" opciones={[...TIPOS_EVENTO]} disabled /> },
    ],
  },
];
