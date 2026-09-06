// packages/ui/src/componentes/Input/Input.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { Input } from "./Input.tsx";
import { Field } from "../Field/Field.tsx";

export const historias: readonly Historia[] = [
  {
    slug: "input",
    nombre: "Input",
    familia: "formularios",
    descripcion: "Control de texto de 46 px con borde de 1,5 px, foco de 2 px y error con aria-invalid.",
    variantes: [
      {
        nombre: "Con ayuda",
        render: () => (
          <Field label="Correo electrónico" hint="El mismo con el que contrataste">
            <Input type="email" placeholder="nombre@correo.com" />
          </Field>
        ),
      },
    ],
    estados: [
      { nombre: "Reposo", render: () => <Input aria-label="Correo" placeholder="nombre@correo.com" /> },
      {
        nombre: "Error",
        render: () => (
          <Field label="Correo electrónico" error="Revisa el correo: le falta el dominio.">
            <Input type="email" defaultValue="mariana@correo" />
          </Field>
        ),
      },
      {
        nombre: "Deshabilitado",
        render: () => (
          <Field label="Fecha del evento" hint="Deshabilitado: dice dónde se cambia">
            <Input defaultValue="18 de abril de 2027" disabled />
          </Field>
        ),
      },
    ],
  },
];
