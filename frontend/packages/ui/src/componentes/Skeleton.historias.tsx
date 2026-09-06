// packages/ui/src/componentes/Skeleton.historias.tsx — historia de la galería (`11 §5` fila
// «Skeleton»). Las dos variantes de anatomía (bloque, texto) más los tamaños que de verdad se usan
// en el producto (una foto de tarjeta, una línea de párrafo, un título).
//
// Convención de registro (contrato de integración F1+F2, ver `historias/registro.ts`): exporta
// `historias: readonly Historia[]`, aunque solo tenga una entrada.
import { Skeleton } from "./Skeleton.tsx";
import type { Historia } from "../historias/tipos.ts";

export const historias: readonly Historia[] = [
  {
    slug: "skeleton",
    nombre: "Skeleton",
    familia: "estados",
    descripcion:
      "Progreso, nunca pantalla vacía (11 §6.2 regla 6): brillo lento que prefers-reduced-motion apaga. aria-busy en el contenedor, aria-hidden en las barras.",
    variantes: [
      {
        nombre: "Bloque",
        nota: "Foto de tarjeta o recuadro de imagen mientras carga (alto 96 px por defecto).",
        render: () => (
          <div style={{ width: 240 }}>
            <Skeleton variante="bloque" />
          </div>
        ),
      },
      {
        nombre: "Bloque · alto personalizado",
        nota: "Panel más alto (héroe, vista previa grande).",
        render: () => (
          <div style={{ width: 240 }}>
            <Skeleton variante="bloque" alto={160} />
          </div>
        ),
      },
      {
        nombre: "Texto · 3 líneas",
        nota: "Párrafo de resumen: la última línea sale al 60 % de ancho.",
        render: () => (
          <div style={{ width: 280 }}>
            <Skeleton variante="texto" />
          </div>
        ),
      },
      {
        nombre: "Texto · 1 línea",
        nota: "Título o etiqueta de una sola línea.",
        render: () => (
          <div style={{ width: 220 }}>
            <Skeleton variante="texto" lineas={1} />
          </div>
        ),
      },
    ],
  },
];
