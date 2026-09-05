// packages/ui/src/shapes/Triangle.tsx — triángulo de esquinas redondeadas (`11 §3.1`).
// Va DETRÁS de una foto o de una tarjeta, girado entre -12° y 12°, en matiz distinto del fondo y
// del elemento que sostiene (`11 §3.4` regla 2).
import type { JSX } from "react";
import {
  accesibilidad,
  claseDeForma,
  color,
  transformacion,
  type PropsAccesibilidad,
  type PropsFormaBase,
} from "./base.ts";
import { triangulo } from "./geometria.ts";

export type TriangleProps = PropsFormaBase &
  PropsAccesibilidad & {
    /** Radio de esquina en unidades del `viewBox` de 100. `0` = vértices duros. */
    readonly radius?: number;
  };

export function Triangle(props: TriangleProps): JSX.Element {
  const {
    radius = 12,
    tone = "accent",
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
      className={claseDeForma({ breathe, drift, className }, "ui-forma--triangulo")}
      style={style}
      {...a11y.atributos}
    >
      {a11y.titulo ? <title>{a11y.titulo}</title> : null}
      <path d={triangulo(radius)} fill={color(tone)} transform={transformacion(rotate, scale)} />
    </svg>
  );
}
