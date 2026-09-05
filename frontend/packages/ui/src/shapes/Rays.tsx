// packages/ui/src/shapes/Rays.tsx — rayos radiales (`11 §3.1`, `moodboard/partes/04-formas.html`).
//
// Cuñas alternas del MISMO matiz en dos pasos: la cuña la pinta `tone`, el hueco lo pinta
// `backdrop` (o el fondo del contenedor si no se pasa). Es la única forma a la que `11 §3.4`
// regla 2 le permite compartir matiz con su fondo, precisamente porque son dos pasos de la misma
// escala.
import type { JSX } from "react";
import {
  accesibilidad,
  claseDeForma,
  color,
  transformacion,
  type PropsAccesibilidad,
  type PropsFormaBase,
  type Tono,
} from "./base.ts";
import { rayos } from "./geometria.ts";

export type RaysProps = PropsFormaBase &
  PropsAccesibilidad & {
    /** Número de cuñas. `11 §3.2`: 8-16, 12 por defecto. */
    readonly density?: number;
    /** Radio en unidades del `viewBox` (200 × 200 centrado): 100 llega justo al borde. */
    readonly radius?: number;
    /**
     * Centro de los rayos en porcentaje del contenedor (`11 §3.2`: `origin="80% 30%"` para que
     * salgan desde detrás de la foto). Formato `"<x>% <y>%"`.
     */
    readonly origin?: string;
    /** Segundo paso del mismo matiz, pintado como fondo completo. Opcional. */
    readonly backdrop?: Tono;
  };

const VISTA = 200;

/** `"80% 30%"` → `[x, y]` en unidades del `viewBox` centrado (-100 … 100). */
function centro(origin: string): readonly [number, number] {
  const partes = origin.trim().split(/\s+/);
  const aUnidades = (v: string | undefined): number => {
    const n = Number.parseFloat(v ?? "50");
    return Number.isFinite(n) ? (n / 100) * VISTA - VISTA / 2 : 0;
  };
  return [aUnidades(partes[0]), aUnidades(partes[1])];
}

export function Rays(props: RaysProps): JSX.Element {
  const {
    density = 12,
    radius = 120,
    origin = "50% 50%",
    tone = "primary-soft",
    backdrop,
    rotate = 0,
    scale = 1,
    className,
    style,
    breathe = false,
    drift = false,
  } = props;
  const [cx, cy] = centro(origin);
  const giro = transformacion(rotate, scale, 0, 0);
  const a11y = accesibilidad(props);
  return (
    <svg
      viewBox={`${-VISTA / 2} ${-VISTA / 2} ${VISTA} ${VISTA}`}
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
      className={claseDeForma({ breathe, drift, className }, "ui-forma--rayos")}
      style={style}
      {...a11y.atributos}
    >
      {a11y.titulo ? <title>{a11y.titulo}</title> : null}
      {backdrop ? (
        <rect x={-VISTA / 2} y={-VISTA / 2} width={VISTA} height={VISTA} fill={color(backdrop)} />
      ) : null}
      <g transform={`translate(${cx} ${cy})`}>
        <g transform={giro}>
          <path d={rayos(density, radius)} fill={color(tone)} />
        </g>
      </g>
    </svg>
  );
}
