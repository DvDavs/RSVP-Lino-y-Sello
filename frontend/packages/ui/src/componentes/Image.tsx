// packages/ui/src/componentes/Image.tsx — Image de producto (`11 §5` fila «Image»): envuelve
// `shapes/Image` (máscara, placeholder del sistema cuando no hay `src`) y le añade los tres estados
// que la tabla exige y que `shapes/Image` no puede dar sin coste: cargando (skeleton dentro de la
// máscara), cargada (fundido de opacidad) y rota (placeholder + el mismo `alt` como texto).
//
// Por qué un componente aparte y no una prop nueva en `shapes/Image` (ADR-3C-4-01, `shapes/base.ts`):
// los tres estados dependen de `onLoad`/`onError` del `<img>`, que exige estado de React y por tanto
// una frontera de cliente — exactamente lo que las formas (decorativas, usables en Server Components
// como la portada) evitan a propósito. Este componente SÍ es `"use client"`; la forma de abajo sigue
// sin serlo. Ambos se llaman `Image`: se resuelven al mismo nombre en `@invitaciones/ui` mediante el
// re-export explícito de `src/index.ts` (ver el comentario de ese fichero) — un único `Image`
// público, la versión con estados.
"use client";

import { useState, type JSX } from "react";
import { Image as ImagenBase } from "../shapes/Image.tsx";
import { Placeholder } from "../shapes/Placeholder.tsx";
import type { Mascara } from "../shapes/mascaras.ts";
import type { Tono } from "../shapes/base.ts";
import { Skeleton } from "./Skeleton.tsx";

type Accesibilidad =
  | { readonly decorative: true; readonly alt?: never }
  | { readonly decorative?: false; readonly alt: string };

export type ImageProps = Accesibilidad & {
  readonly mask?: Mascara;
  readonly seed?: number;
  readonly points?: number;
  readonly amplitude?: number;
  readonly rotate?: number;
  readonly radius?: number;
  readonly src?: string;
  readonly ratio?: string;
  /** Solo se usa sin `src` (foto pendiente, `11 §9`): `shapes/Image` la vuelca al placeholder. */
  readonly imageId?: string;
  readonly tones?: readonly [Tono, Tono];
  readonly className?: string;
  readonly id?: string;
  /**
   * SOLO para la galería `/design` y para pruebas de regresión visual (`Image.historias.tsx`):
   * fuerza y CONGELA un estado en vez de dejar que lo decidan `onLoad`/`onError` del navegador.
   * Sin esto, "cargando" es una carrera perdida contra la propia carga de la imagen (real o de
   * datos): una captura no puede confiar en pillarlo a tiempo. Nadie lo pasa en producción — no
   * hay ningún flujo del producto que necesite fingir un estado.
   */
  readonly congelarEnEstado?: Estado;
};

export type Estado = "cargando" | "cargada" | "rota";

function resolverAlt(props: ImageProps): string {
  return props.decorative ? "" : props.alt;
}

export function Image(props: ImageProps): JSX.Element {
  const {
    mask,
    seed,
    points,
    amplitude,
    rotate,
    radius,
    src,
    ratio,
    imageId,
    tones,
    className,
    id,
    decorative,
    congelarEnEstado,
  } = props;
  const alt = resolverAlt(props);
  // Una `src` distinta reinicia el estado (galería de fotos, carrusel de plantilla): sin esto, una
  // foto nueva heredaría "rota" o "cargada" de la anterior durante un instante.
  const [estadoReal, setEstadoReal] = useState<Estado>("cargando");
  const [srcVista, setSrcVista] = useState(src);
  if (src !== srcVista) {
    setSrcVista(src);
    setEstadoReal("cargando");
  }
  const estado = congelarEnEstado ?? estadoReal;

  const comun = { mask, seed, points, amplitude, rotate, radius, alt, ratio, tones, className, id } as const;

  if (src === undefined) {
    // Sin `src`, `shapes/Image` pinta ya el placeholder del sistema (§3.3): es el estado "pendiente".
    return <ImagenBase {...comun} imageId={imageId} />;
  }

  return (
    <ImagenBase {...comun}>
      <div className="ui-imagen-producto">
        {estado === "rota" ? (
          <Placeholder
            label={decorative ? "Fotografía no disponible" : alt || "Fotografía no disponible"}
            decorative={decorative}
            tones={tones}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            className="ui-imagen__foto ui-imagen-producto__foto"
            data-estado={estado}
            onLoad={() => congelarEnEstado === undefined && setEstadoReal("cargada")}
            onError={() => congelarEnEstado === undefined && setEstadoReal("rota")}
          />
        )}
        {estado === "cargando" ? (
          <Skeleton
            variante="bloque"
            alto="100%"
            etiqueta="Cargando fotografía"
            className="ui-imagen-producto__skeleton"
          />
        ) : null}
      </div>
    </ImagenBase>
  );
}

// Reexportado por si alguien necesita el tipo de estado sin importar el componente (galería, pruebas
// de historia que fuerzan cada estado con una `src` distinta: ver `Image.historias.tsx`).
export type { Estado as EstadoImagen };
