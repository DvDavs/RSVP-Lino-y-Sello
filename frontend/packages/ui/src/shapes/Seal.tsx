// packages/ui/src/shapes/Seal.tsx — sello festoneado (`11 §3.1`): `r(θ) = R + a·cos(nθ)`.
// Fondo de insignia, de estado vacío y de icono grande; también máscara de foto (`Image mask="seal"`).
import type { JSX } from "react";
import {
  accesibilidad,
  claseDeForma,
  color,
  transformacion,
  type PropsAccesibilidad,
  type PropsFormaBase,
} from "./base.ts";
import { sello } from "./geometria.ts";

export type SealProps = PropsFormaBase &
  PropsAccesibilidad & {
    /** Número de festones. 10-16 se lee como sello; menos, como flor. */
    readonly points?: number;
    /** Profundidad del festón en unidades del `viewBox` de 100. */
    readonly amplitude?: number;
    /** Radio base. */
    readonly radius?: number;
  };

export function Seal(props: SealProps): JSX.Element {
  const {
    points = 12,
    amplitude = 4,
    radius = 44,
    tone = "primary-soft",
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
      className={claseDeForma({ breathe, drift, className }, "ui-forma--sello")}
      style={style}
      {...a11y.atributos}
    >
      {a11y.titulo ? <title>{a11y.titulo}</title> : null}
      <path d={sello(points, amplitude, radius)} fill={color(tone)} transform={transformacion(rotate, scale)} />
    </svg>
  );
}
