// packages/ui/src/shapes/Image.tsx — TODA fotografía del producto pasa por aquí (`11 §3.1`, `§3.4`
// regla 4: máscara o radio ≥ 24 px; nunca un rectángulo duro sobre color plano).
//
// Tres formas de darle contenido, en este orden:
//  1. `children`: un `<img>` o un `next/image` ya construido (el paquete no depende de `next`);
//  2. `src`: emite un `<img>` con el `alt` que se le pase;
//  3. nada: pinta el placeholder del sistema (`11 §3.3`) con `alt` como descripción de la foto
//     pendiente. Si además se pasa `imageId`, la pieza queda marcada para `imagenes-pendientes.md`.
//
// El nombre es el de `11 §3.1` y ADR-3C-0-03. En un archivo que ya importe `next/image`, alias:
// `import { Image as Foto } from "@invitaciones/ui"`.
import type { JSX, ReactNode } from "react";
import { clases, idEstable, type Tono } from "./base.ts";
import { definirMascara, type Mascara } from "./mascaras.ts";
import { Placeholder } from "./Placeholder.tsx";

export interface ImageProps {
  /** `11 §3.1`. Por defecto el radio grande, que es la máscara neutra del sistema. */
  readonly mask?: Mascara;
  /** `mask="blob"`: entero determinista. En listas, el índice o un hash estable del id. */
  readonly seed?: number;
  /** `mask="blob"` (nodos) y `mask="seal"` (festones). */
  readonly points?: number;
  /** `mask="blob"` (perturbación) y `mask="seal"` (profundidad del festón). */
  readonly amplitude?: number;
  /** `mask="rotated"`: giro en grados. */
  readonly rotate?: number;
  /** `mask="radius-lg"`: radio en px; nunca por debajo de 24 (`11 §3.4` regla 4). */
  readonly radius?: number;
  readonly src?: string;
  /** Texto alternativo. Con el placeholder es la descripción de la foto que falta. */
  readonly alt: string;
  /** Proporción de la caja (`"1 / 1"`, `"4 / 3"`, `"4 / 5"`… `11 §9`). */
  readonly ratio?: string;
  /** Identificador de `11 §9` cuando la foto todavía no existe. */
  readonly imageId?: string;
  /** Tonos del degradado del placeholder. */
  readonly tones?: readonly [Tono, Tono];
  readonly className?: string;
  /** `id` del `<clipPath>`; por defecto se deriva de la máscara y sus parámetros (`idEstable`). */
  readonly id?: string;
  readonly children?: ReactNode;
}

export function Image({
  mask = "radius-lg",
  seed = 1,
  points,
  amplitude,
  rotate = 10,
  radius = 24,
  src,
  alt,
  ratio = "1 / 1",
  imageId,
  tones,
  className,
  id,
  children,
}: ImageProps): JSX.Element {
  const idMascara = id ?? idEstable("mascara", mask, seed, points, amplitude, rotate, radius);
  const definicion = definirMascara(mask, idMascara, { seed, points, amplitude, rotate, radius });

  const contenido: ReactNode =
    children ??
    (src !== undefined ? (
      // `<img>` a propósito: `@invitaciones/ui` no depende de `next` (lo consumen módulos que
      // pueden no ser Next). Quien quiera `next/image` lo pasa como `children`.
      <img src={src} alt={alt} className="ui-imagen__foto" />
    ) : (
      <Placeholder label={alt} imageId={imageId} tones={tones} decorative={alt === ""} />
    ));

  return (
    <div className={clases("ui-imagen", className)} style={{ aspectRatio: ratio }} data-mascara={mask}>
      {definicion.path ? (
        <svg className="ui-imagen__defs" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={idMascara} clipPathUnits="objectBoundingBox">
              <path d={definicion.path.d} transform={definicion.path.transform} />
            </clipPath>
          </defs>
        </svg>
      ) : null}
      <div className="ui-imagen__recorte" style={{ clipPath: definicion.clipPath }}>
        {contenido}
      </div>
    </div>
  );
}
