// packages/ui/src/componentes/Checkbox/Checkbox.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { Checkbox } from "./Checkbox.tsx";

export const historias: readonly Historia[] = [
  {
    slug: "checkbox",
    nombre: "Checkbox",
    familia: "formularios",
    descripcion: "Casilla de 26 px; con label, la fila entera es el objetivo (>= 44 px).",
    variantes: [
      { nombre: "Sola", render: () => <Checkbox aria-label="Aceptar" /> },
      { nombre: "Con texto", render: () => <Checkbox label="Mostrar «Nuestra historia»" /> },
      { nombre: "Con meta", render: () => <Checkbox label="Sí, ahí estaré" meta="2 lugares" defaultChecked /> },
    ],
    estados: [
      { nombre: "Marcada", render: () => <Checkbox label="Mostrar «Nuestra historia»" defaultChecked /> },
      { nombre: "Deshabilitada", render: () => <Checkbox label="Mostrar «Nuestra historia»" disabled /> },
    ],
  },
];
