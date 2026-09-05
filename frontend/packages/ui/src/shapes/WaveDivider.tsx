// packages/ui/src/shapes/WaveDivider.tsx — divisor de sección en onda (`11 §3.1`, `§3.2`).
//
// Tres perfiles FIJOS (`suave`, `marcada`, `doble`) y una o dos capas: `11 §3.2` prohíbe el `path`
// libre para que todas las ondas del producto sean la misma familia. `from` es el color de la
// sección de arriba y `to` el de la de abajo; con `layers={2}` la capa intermedia va en
// `tones[0]` (un apoyo `-soft`), que es la profundidad sin sombra del moodboard.
import type { JSX } from "react";
import {
  accesibilidad,
  claseDeForma,
  color,
  type PropsAccesibilidad,
  type PropsFormaBase,
  type Tono,
} from "./base.ts";
import { ONDAS, type PerfilOnda } from "./geometria.ts";

export type WaveDividerProps = Omit<PropsFormaBase, "tone" | "rotate" | "scale"> &
  PropsAccesibilidad & {
    /** Color de la sección de ARRIBA. */
    readonly from?: Tono;
    /** Color de la sección de ABAJO (la que «entra»). */
    readonly to?: Tono;
    readonly profile?: PerfilOnda;
    readonly layers?: 1 | 2;
    /** Tono de la capa intermedia cuando `layers === 2`. */
    readonly tones?: readonly [Tono];
    /** Voltea la onda en vertical: divisor colgado del borde superior de una sección. */
    readonly flip?: boolean;
    /** Altura real del divisor en px. `11 §3.1`: 60-90. */
    readonly height?: number;
  };

export function WaveDivider(props: WaveDividerProps): JSX.Element {
  const {
    from = "primary-soft",
    to = "surface",
    profile = "suave",
    layers = profile === "doble" ? 2 : 1,
    tones = ["support-1-soft"],
    flip = false,
    height = 90,
    className,
    style,
    breathe = false,
    drift = false,
  } = props;
  const a11y = accesibilidad(props);
  const curvas = ONDAS[profile];
  return (
    <svg
      viewBox="0 0 200 90"
      preserveAspectRatio="none"
      focusable="false"
      className={claseDeForma({ breathe, drift, className }, "ui-forma--onda")}
      style={{ height: `${height}px`, ...(flip ? { transform: "scaleY(-1)" } : null), ...style }}
      {...a11y.atributos}
    >
      {a11y.titulo ? <title>{a11y.titulo}</title> : null}
      <rect width="200" height="90" fill={color(from)} />
      {layers === 2 ? <path d={curvas.fondo} fill={color(tones[0])} /> : null}
      <path d={curvas.frente} fill={color(to)} />
    </svg>
  );
}
