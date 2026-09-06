// packages/ui/src/componentes/Switch/Switch.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { Switch } from "./Switch.tsx";

export const historias: readonly Historia[] = [
  {
    slug: "switch",
    nombre: "Switch",
    familia: "formularios",
    descripcion: "Interruptor de 48 × 28 con bolita de 22 px y transición de rebote suave.",
    variantes: [
      { nombre: "Con texto", render: () => <Switch label="Mostrar «Nuestra historia»" /> },
      { nombre: "Solo", render: () => <Switch aria-label="Modo oscuro" /> },
    ],
    estados: [
      { nombre: "Encendido", render: () => <Switch label="Mostrar «Nuestra historia»" defaultChecked /> },
      { nombre: "Deshabilitado", render: () => <Switch label="Mostrar «Nuestra historia»" disabled /> },
    ],
  },
];
