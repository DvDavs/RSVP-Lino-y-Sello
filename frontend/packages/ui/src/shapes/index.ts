// @invitaciones/ui/shapes — biblioteca de formas del sistema de diseño del PRODUCTO (3C-4).
//
// Catálogo y API: `docs/rediseno-plantillas/diseno/11-sistema-de-diseno.md §3` y ADR-3C-0-03.
// Reglas de composición obligatorias: `11 §3.4` (resumidas en la galería `/design/formas`).
// Hoja de estilo: `./shapes.css` (la importa `@invitaciones/ui/estilos.css`).
//
// Todas las formas son deterministas y sin color propio: `tone` solo admite tokens `--ui-*`.

export { Rays, type RaysProps } from "./Rays.tsx";
export { Stripes, type StripesProps } from "./Stripes.tsx";
export { WaveDivider, type WaveDividerProps } from "./WaveDivider.tsx";
export { Blob, type BlobProps } from "./Blob.tsx";
export { Triangle, type TriangleProps } from "./Triangle.tsx";
export { RotatedSquare, RADIOS_CUADRADO, type RotatedSquareProps, type RadioCuadrado } from "./RotatedSquare.tsx";
export { Pill, type PillProps, type TonoPildora } from "./Pill.tsx";
export { Seal, type SealProps } from "./Seal.tsx";
export { ColorShadow, type ColorShadowProps } from "./ColorShadow.tsx";
export { Image, type ImageProps } from "./Image.tsx";
export { Placeholder, type PlaceholderProps } from "./Placeholder.tsx";
export { Composition, type CompositionProps, type CapaForma, type Lugar } from "./Composition.tsx";

export {
  color,
  clases,
  claseDeForma,
  accesibilidad,
  idEstable,
  transformacion,
  CLASE_FORMA,
  CLASE_RESPIRA,
  CLASE_DERIVA,
  type Tono,
  type PropsFormaBase,
  type PropsAccesibilidad,
  type Accesibilidad,
} from "./base.ts";

export {
  prng,
  blob,
  sello,
  rayos,
  poligonoRedondeado,
  triangulo,
  cuadradoRedondeado,
  ladoInscrito,
  arco,
  ONDAS,
  type Punto,
  type PerfilOnda,
} from "./geometria.ts";

export { definirMascara, MASCARAS, type Mascara, type OpcionesMascara, type DefinicionMascara } from "./mascaras.ts";

// El interruptor de movimiento vive en `shapes.css`; este hook es para el movimiento que CSS no
// puede apagar solo. Se reexporta aquí porque `src/index.ts` solo reexporta `./shapes`.
export { useReducedMotion } from "../utilidades/useReducedMotion.ts";
