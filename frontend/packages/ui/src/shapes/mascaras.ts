// packages/ui/src/shapes/mascaras.ts — las CINCO máscaras de foto del sistema (`11 §3.1`,
// ADR-3C-0-03). `11 §3.4` regla 4: toda fotografía pasa por una máscara o por un radio ≥ 24 px;
// nunca un rectángulo duro sobre color plano.
//
// Dos mecanismos, según la forma:
//  - `radius-lg` sale con `clip-path: inset(… round …)`, sin `<defs>`: es un radio, no una silueta;
//  - `blob`, `arch`, `seal` y `rotated` salen con un `<clipPath clipPathUnits="objectBoundingBox">`
//    y el `path` escalado por `scale(0.01)` (la geometría vive en un `viewBox` de 100 y
//    `objectBoundingBox` la quiere normalizada a 0-1). Así la máscara se adapta a CUALQUIER caja
//    sin recalcular la geometría, y la foto conserva su `object-fit: cover`.
import { arco, blob, cuadradoRedondeado, ladoInscrito, sello } from "./geometria.ts";

/**
 * Nombres de `11 §3.1` (`<Image mask="radius-lg|blob|arch|seal|rotated" />`), que son los que manda
 * ADR-3C-0-03. Equivalencias con los nombres coloquiales del brief:
 * `radius-lg` = «rounded-xl», `seal` = «soft-star», `rotated` = «tilted-square`».
 */
export type Mascara = "radius-lg" | "blob" | "arch" | "seal" | "rotated";

export const MASCARAS: readonly Mascara[] = ["radius-lg", "blob", "arch", "seal", "rotated"];

export interface OpcionesMascara {
  readonly seed?: number;
  readonly points?: number;
  readonly amplitude?: number;
  readonly rotate?: number;
  /** Solo para `radius-lg`: radio en px. `11 §3.4` regla 4 exige ≥ 24. */
  readonly radius?: number;
}

export interface DefinicionMascara {
  /** Valor de `clip-path` listo para CSS. Siempre presente. */
  readonly clipPath: string;
  /** `<path>` que hay que meter en un `<clipPath>`; `undefined` cuando basta con CSS. */
  readonly path?: { readonly d: string; readonly transform: string };
}

/** Escala del `viewBox` de 100 al espacio normalizado de `objectBoundingBox`. */
const A_CAJA = "scale(0.01)";

/**
 * Traduce una máscara y sus parámetros a lo que necesita el componente `Image`.
 * `id` es el identificador del `<clipPath>` que el componente ya ha derivado.
 */
export function definirMascara(mask: Mascara, id: string, opciones: OpcionesMascara = {}): DefinicionMascara {
  const { seed = 1, points, amplitude, rotate = 10, radius = 24 } = opciones;
  switch (mask) {
    case "radius-lg":
      return { clipPath: `inset(0 round ${Math.max(radius, 24)}px)` };
    case "blob":
      return {
        clipPath: `url(#${id})`,
        path: { d: blob(seed, points ?? 7, amplitude ?? 0.16, 47), transform: A_CAJA },
      };
    case "arch":
      return { clipPath: `url(#${id})`, path: { d: arco(0), transform: A_CAJA } };
    case "seal":
      return {
        clipPath: `url(#${id})`,
        path: { d: sello(points ?? 14, amplitude ?? 3.2, 46.5), transform: A_CAJA },
      };
    case "rotated":
      return {
        clipPath: `url(#${id})`,
        path: {
          d: cuadradoRedondeado(ladoInscrito(rotate), 14),
          transform: `${A_CAJA} rotate(${rotate} 50 50)`,
        },
      };
  }
}
