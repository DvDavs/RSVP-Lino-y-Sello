// packages/ui/src/historias/metadatos.ts — lista de metadatos SEGURA para Server Components
// (contrato de integración F1+F2: ver el comentario de `registro.ts`). Nada de `render()`
// (funciones no serializables) ni de historias `"use client"`: solo lo que un índice o un
// `generateStaticParams` necesitan. Mantenida A MANO en paralelo con `registro.ts` — cada entrada
// aquí debe tener su gemela exacta (mismo slug/nombre/familia/descripcion) en algún
// `*.historias.tsx`; `metadatos.test.ts` rompe si divergen.
import type { FamiliaHistoria } from "./tipos.ts";

export interface MetadatoHistoria {
  readonly slug: string;
  readonly nombre: string;
  readonly familia: FamiliaHistoria;
  readonly descripcion: string;
}

export const metadatos: readonly MetadatoHistoria[] = [
  // F1 formularios · F2 superficies y navegación · F3 estados e imagen (mismo orden que registro.ts)
  {
    slug: "empty-state",
    nombre: "EmptyState",
    familia: "estados",
    descripcion:
      "Ilustración del sistema (§4.3) + título display-sm + una frase + una sola acción. Nunca dos botones primarios en un estado vacío.",
  },
  {
    slug: "image",
    nombre: "Image",
    familia: "imagen",
    descripcion:
      "Toda fotografía del producto: máscara o radio ≥ 24 px (§3.1), placeholder del sistema sin foto, alt obligatorio salvo decorative.",
  },
  {
    slug: "skeleton",
    nombre: "Skeleton",
    familia: "estados",
    descripcion:
      "Progreso, nunca pantalla vacía (11 §6.2 regla 6): brillo lento que prefers-reduced-motion apaga. aria-busy en el contenedor, aria-hidden en las barras.",
  },
];
