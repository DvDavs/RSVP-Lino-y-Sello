// packages/ui/src/componentes/Skeleton.tsx — espera con progreso, nunca pantalla vacía (`11 §5`
// fila «Skeleton», `11 §6.2` regla 6: cualquier espera > 400 ms muestra skeleton o progreso con
// texto). Dos variantes: `bloque` (una barra rectangular, alto configurable) y `texto` (varias
// líneas, la última más corta). El contenedor lleva `aria-busy`; cada barra es puramente decorativa
// (`aria-hidden`) — el nombre accesible de la espera lo lleva el contenedor (`aria-label`, «Cargando»
// por defecto).
//
// `role="status"` en el contenedor (hallazgo de `@axe-core/playwright`, `design-axe.spec.ts`):
// `aria-label` en un `<div>` sin rol es inválido por espec ARIA (rol implícito "generic", que
// prohíbe nombrarlo) — axe lo marca `aria-prohibited-attr`, serio. "status" es además semánticamente
// el correcto para una región ocupada que se anuncia (`aria-live="polite"`/`aria-atomic="true"`
// vienen implícitos con el rol, sin JS extra).
//
// Server-safe: ninguna animación depende de JS (el brillo y su apagado con `prefers-reduced-motion`
// viven en `componentes.css`, mismo patrón que `shapes.css` §6.2 regla 5).
import type { CSSProperties, JSX } from "react";

export type VarianteSkeleton = "bloque" | "texto";

export interface SkeletonProps {
  readonly variante?: VarianteSkeleton;
  /** Solo `variante="texto"`: número de líneas (≥ 1). La última sale al 60 % de ancho. */
  readonly lineas?: number;
  /** Solo `variante="bloque"`: ancho del bloque (por defecto, 100 % del contenedor). */
  readonly ancho?: string | number;
  /** Solo `variante="bloque"`: alto del bloque (por defecto 96 px). */
  readonly alto?: string | number;
  /** Nombre accesible del contenedor ocupado. */
  readonly etiqueta?: string;
  readonly className?: string;
}

function clases(...partes: readonly (string | false | undefined)[]): string {
  return partes.filter(Boolean).join(" ");
}

function aLongitud(valor: string | number | undefined): string | undefined {
  if (valor === undefined) return undefined;
  return typeof valor === "number" ? `${valor}px` : valor;
}

export function Skeleton({
  variante = "bloque",
  lineas = 3,
  ancho,
  alto,
  etiqueta = "Cargando",
  className,
}: SkeletonProps): JSX.Element {
  if (variante === "texto") {
    const total = Math.max(1, lineas);
    return (
      <div className={clases("ui-skeleton-texto", className)} role="status" aria-busy="true" aria-label={etiqueta}>
        {Array.from({ length: total }, (_, indice) => {
          const esUltima = indice === total - 1 && total > 1;
          return (
            <span
              key={indice}
              className="ui-skeleton ui-skeleton--linea"
              aria-hidden="true"
              style={{ "--ui-skeleton-ancho": esUltima ? "60%" : "100%" } as CSSProperties}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={clases("ui-skeleton-bloque-contenedor", className)}
      role="status"
      aria-busy="true"
      aria-label={etiqueta}
      style={{ width: aLongitud(ancho) }}
    >
      <span
        className="ui-skeleton ui-skeleton--bloque"
        aria-hidden="true"
        style={{ "--ui-skeleton-alto": aLongitud(alto) } as CSSProperties}
      />
    </div>
  );
}
