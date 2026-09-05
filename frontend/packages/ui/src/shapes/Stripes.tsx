// packages/ui/src/shapes/Stripes.tsx — rayas diagonales u horizontales (`11 §3.1`).
// Fondo de banda; NUNCA detrás de texto de cuerpo (`11 §3.4` regla 3).
import type { JSX } from "react";
import {
  accesibilidad,
  claseDeForma,
  color,
  idEstable,
  type PropsAccesibilidad,
  type PropsFormaBase,
  type Tono,
} from "./base.ts";

export type StripesProps = PropsFormaBase &
  PropsAccesibilidad & {
    /** Ángulo del patrón en grados (`-24`, `0`, `45`, `90` son los usados en el moodboard). */
    readonly angle?: number;
    /** Paso del patrón: distancia entre el inicio de una franja y el de la siguiente. */
    readonly gap?: number;
    /** Grosor de la franja pintada. Debe ser menor que `gap`. */
    readonly width?: number;
    /** Segundo tono, pintado como fondo completo bajo las franjas. Opcional. */
    readonly backdrop?: Tono;
    /** `id` del `<pattern>`; por defecto se deriva de los parámetros (ver `idEstable`). */
    readonly id?: string;
  };

export function Stripes(props: StripesProps): JSX.Element {
  const {
    angle = -24,
    gap = 18,
    width = 9,
    tone = "support-2-soft",
    backdrop,
    className,
    style,
    breathe = false,
    drift = false,
  } = props;
  const a11y = accesibilidad(props);
  const id = props.id ?? idEstable("rayas", angle, gap, width, tone);
  return (
    <svg
      viewBox="0 0 200 150"
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
      className={claseDeForma({ breathe, drift, className }, "ui-forma--rayas")}
      style={style}
      {...a11y.atributos}
    >
      {a11y.titulo ? <title>{a11y.titulo}</title> : null}
      <defs>
        <pattern
          id={id}
          width={gap}
          height={gap}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${angle})`}
        >
          <rect width={Math.min(width, gap)} height={gap} fill={color(tone)} />
        </pattern>
      </defs>
      {backdrop ? <rect width="200" height="150" fill={color(backdrop)} /> : null}
      <rect width="200" height="150" fill={`url(#${id})`} />
    </svg>
  );
}
