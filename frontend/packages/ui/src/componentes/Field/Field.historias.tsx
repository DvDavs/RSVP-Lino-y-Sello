// packages/ui/src/componentes/Field/Field.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { Field } from "./Field.tsx";

export const historias: readonly Historia[] = [
  {
    slug: "field",
    nombre: "Field",
    familia: "formularios",
    descripcion: "Etiqueta, ayuda y error con aria-describedby/aria-invalid, para cualquier control.",
    variantes: [
      {
        nombre: "Con ayuda",
        render: () => (
          <Field label="Correo electrónico" hint="El mismo con el que contrataste">
            <input type="email" placeholder="nombre@correo.com" />
          </Field>
        ),
      },
      {
        nombre: "Obligatorio",
        render: () => (
          <Field label="Nombre del lugar" required>
            <input type="text" />
          </Field>
        ),
      },
    ],
    estados: [
      {
        nombre: "Error",
        render: () => (
          <Field label="Correo electrónico" error="Revisa el correo: le falta el dominio.">
            <input type="email" defaultValue="mariana@correo" />
          </Field>
        ),
      },
    ],
  },
];
