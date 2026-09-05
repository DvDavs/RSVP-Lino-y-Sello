// packages/ui/src/shapes/RotatedSquare.tsx — cuadrado rotado (`11 §3.1`).
// Es el ÚNICO sitio del paso 500 (`primary-bright`): decorativo, grande y nunca con texto encima
// (`11 §3.4` regla 6). El lado se calcula para que el giro no saque la forma del bloque (regla 3).
import type { JSX } from "react";
import {
  accesibilidad,
  claseDeForma,
  color,
  type PropsAccesibilidad,
  type PropsFormaBase,
} from "./base.ts";
import { cuadradoRedondeado, ladoInscrito } from "./geometria.ts";

/** Radios del sistema (`--ui-radius-*`: 8/14/24/36) llevados al `viewBox` de 100. */
export const RADIOS_CUADRADO = { sm: 8, md: 14, lg: 24, xl: 36 } as const;
export type RadioCuadrado = keyof typeof RADIOS_CUADRADO;

export type RotatedSquareProps = Omit<PropsFormaBase, "scale"> &
  PropsAccesibilidad & {
    readonly radius?: RadioCuadrado;
    /** Fracción del lado máximo inscrito (1 = tan grande como quepa girado). */
    readonly scale?: number;
  };

export function RotatedSquare(props: RotatedSquareProps): JSX.Element {
  const {
    radius = "md",
    tone = "primary-bright",
    rotate = 12,
    scale = 1,
    className,
    style,
    breathe = false,
    drift = false,
  } = props;
  const a11y = accesibilidad(props);
  const lado = ladoInscrito(rotate) * scale;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      className={claseDeForma({ breathe, drift, className }, "ui-forma--cuadrado")}
      style={style}
      {...a11y.atributos}
    >
      {a11y.titulo ? <title>{a11y.titulo}</title> : null}
      <path
        d={cuadradoRedondeado(lado, RADIOS_CUADRADO[radius])}
        fill={color(tone)}
        transform={`rotate(${rotate} 50 50)`}
      />
    </svg>
  );
}
