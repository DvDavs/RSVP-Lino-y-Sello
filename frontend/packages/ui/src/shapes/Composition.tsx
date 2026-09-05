// packages/ui/src/shapes/Composition.tsx — las reglas de composición de `11 §3.4` convertidas en
// una utilidad, para que cumplirlas sea el camino corto.
//
// Qué garantiza por construcción:
//  - regla 3: la forma va DETRÁS del contenido (`z-index` separado) y el bloque recorta
//    (`overflow: hidden`), así que ninguna forma se sale ni se cuela bajo un párrafo, un campo o un
//    botón que el autor haya puesto en `children`;
//  - la forma se marca decorativa por el propio componente (`aria-hidden` en su envoltorio), de modo
//    que aunque alguien pase una forma anunciable, la capa de fondo no ensucia el árbol accesible;
//  - regla 1: `shape` es UNA. Si hace falta una segunda `-soft`, va en `secondaryShape`, que se
//    limita al 30 % del bloque (`--ui-composicion-secundaria`) y a una esquina distinta.
import type { CSSProperties, ElementType, JSX, ReactNode } from "react";
import { clases } from "./base.ts";

/** Anclaje de la forma dentro del bloque. */
export type Lugar =
  | "centro"
  | "cubrir"
  | "arriba-izquierda"
  | "arriba-derecha"
  | "abajo-izquierda"
  | "abajo-derecha"
  | "izquierda"
  | "derecha";

export interface CapaForma {
  readonly shape: ReactNode;
  readonly place?: Lugar;
  /**
   * ANCHO de la capa como longitud CSS (`"60%"`, `"320px"`). La capa es cuadrada salvo que se dé
   * `height`. Ignorado con `place="cubrir"`, que ocupa el bloque entero.
   */
  readonly size?: string;
  /** Alto de la capa. Por defecto igual al ancho (`aspect-ratio: 1`). */
  readonly height?: string;
  /** Desplazamiento fino desde el anclaje. */
  readonly offset?: { readonly x?: string; readonly y?: string };
}

export interface CompositionProps extends CapaForma {
  /** Segunda forma, siempre en un paso `-soft` y por debajo del 30 % del área (regla 1). */
  readonly secondaryShape?: CapaForma;
  readonly as?: ElementType;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly style?: CSSProperties;
  readonly children: ReactNode;
}

function estiloCapa({ place = "centro", size = "100%", height, offset }: CapaForma): CSSProperties {
  return {
    "--ui-capa-tam": place === "cubrir" ? "100%" : size,
    "--ui-capa-alto": height ?? "auto",
    "--ui-capa-dx": offset?.x ?? "0px",
    "--ui-capa-dy": offset?.y ?? "0px",
  } as CSSProperties;
}

export function Composition({
  shape,
  place = "centro",
  size = "100%",
  height,
  offset,
  secondaryShape,
  as: Elemento = "div",
  className,
  contentClassName,
  style,
  children,
}: CompositionProps): JSX.Element {
  return (
    <Elemento className={clases("ui-composicion", className)} style={style}>
      <div
        className={clases("ui-composicion__forma", `ui-composicion__forma--${place}`)}
        style={estiloCapa({ shape, place, size, height, offset })}
        aria-hidden="true"
      >
        {shape}
      </div>
      {secondaryShape ? (
        <div
          className={clases(
            "ui-composicion__forma",
            "ui-composicion__forma--secundaria",
            `ui-composicion__forma--${secondaryShape.place ?? "abajo-derecha"}`,
          )}
          style={estiloCapa(secondaryShape)}
          aria-hidden="true"
        >
          {secondaryShape.shape}
        </div>
      ) : null}
      <div className={clases("ui-composicion__contenido", contentClassName)}>{children}</div>
    </Elemento>
  );
}
