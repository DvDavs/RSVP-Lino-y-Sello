// packages/ui/src/componentes/Textarea/Textarea.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { Textarea } from "./Textarea.tsx";
import { Field } from "../Field/Field.tsx";

export const historias: readonly Historia[] = [
  {
    slug: "textarea",
    nombre: "Textarea",
    familia: "formularios",
    descripcion: "Como Input, alto mínimo 96 px; contador «n/límite» que aparece al 80 % del límite.",
    variantes: [
      {
        nombre: "Con contador",
        render: () => (
          <Field label="Mensaje para tus invitados">
            <Textarea limite={280} placeholder="Nos hace mucha ilusión compartir este día contigo…" />
          </Field>
        ),
      },
    ],
    estados: [
      { nombre: "Reposo", render: () => <Textarea aria-label="Mensaje" placeholder="Escribe aquí…" /> },
      {
        nombre: "Cerca del límite",
        render: () => <Textarea aria-label="Mensaje" limite={20} defaultValue="Nos hace mucha ilusión" />,
        nota: "El contador aparece al llegar al 80 % del límite.",
      },
    ],
  },
];
