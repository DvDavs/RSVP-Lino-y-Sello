// packages/ui/src/componentes/Chip/Chip.historias.tsx
import type { Historia } from "../../historias/tipos.ts";
import { Chip } from "./Chip.tsx";

export const historias: readonly Historia[] = [
  {
    slug: "chip",
    nombre: "Chip",
    familia: "formularios",
    descripcion: "Píldora de 34 px: seleccionable, de estado, con icono o cerrable.",
    variantes: [
      { nombre: "Reposo", render: () => <Chip>Jardín</Chip> },
      { nombre: "Seleccionado", render: () => <Chip seleccionado>Jardín</Chip> },
      { nombre: "Cerrable", render: () => <Chip onCerrar={() => {}} labelCerrar="Quitar Jardín">Jardín</Chip> },
      {
        nombre: "De estado",
        render: () => (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip tono="exito">128 confirmados</Chip>
            <Chip tono="aviso">3 por revisar</Chip>
            <Chip tono="peligro">Falta el lugar</Chip>
            <Chip tono="info">Enlace copiado</Chip>
            <Chip tono="acento">Plan 2</Chip>
          </div>
        ),
      },
    ],
    estados: [{ nombre: "Deshabilitado", render: () => <Chip disabled>Jardín</Chip> }],
  },
];
