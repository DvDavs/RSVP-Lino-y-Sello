// packages/ui/src/shapes/Blob.tsx — blob orgánico determinista (`11 §3.1`, ADR-3C-0-03).
// El mismo `seed` da el mismo `path` en servidor y en cliente: sin discrepancia de hidratación.
import type { JSX } from "react";
import {
  accesibilidad,
  claseDeForma,
  color,
  transformacion,
  type PropsAccesibilidad,
  type PropsFormaBase,
} from "./base.ts";
import { blob } from "./geometria.ts";

export type BlobProps = PropsFormaBase &
  PropsAccesibilidad & {
    /** Entero. El mismo número siempre da el mismo blob (en listas: el índice o un hash del id). */
    readonly seed?: number;
    /** Nodos del polar. 5-9 se lee orgánico; más nodos, más redondo. */
    readonly points?: number;
    /** Perturbación del radio, 0-0,4. `11 §3.1`: 0,22 por defecto. */
    readonly amplitude?: number;
    /** Radio base en unidades del `viewBox` de 100. */
    readonly radius?: number;
  };

export function Blob(props: BlobProps): JSX.Element {
  const {
    seed = 1,
    points = 7,
    amplitude = 0.22,
    radius = 42,
    tone = "support-2-soft",
    rotate = 0,
    scale = 1,
    className,
    style,
    breathe = false,
    drift = false,
  } = props;
  const a11y = accesibilidad(props);
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      className={claseDeForma({ breathe, drift, className }, "ui-forma--blob")}
      style={style}
      {...a11y.atributos}
    >
      {a11y.titulo ? <title>{a11y.titulo}</title> : null}
      <path d={blob(seed, points, amplitude, radius)} fill={color(tone)} transform={transformacion(rotate, scale)} />
    </svg>
  );
}
