// packages/ui/src/shapes/Placeholder.tsx — placeholder del sistema para una imagen que TODAVÍA no
// existe (`11 §3.3` y `11 §9`).
//
// Qué pinta: un degradado de dos tonos `-soft` de la paleta (principal → apoyo 2 por defecto) y el
// icono de galería de dos tonos centrado. No recorta: el recorte lo pone `Image`, que es quien sabe
// qué máscara toca. Marca la pieza con `data-imagen-pendiente="<id>"` para que el bloque 3 vuelque
// la lista a `imagenes-pendientes.md` con un `grep`, sin inventario a mano.
//
// TODO(3C-integración): el `<g>` de abajo es una copia LITERAL del icono `galeria` del moodboard
// (`partes/05-iconos.html`: retícula 24, trazo 1,75 redondeado, dos tonos; mismos `d` sin retocar),
// centrado en 24 unidades del `viewBox` de 100 (la misma proporción del moodboard) y con el segundo tono resuelto a tokens en vez de a
// `var(--tono)`. En cuanto `@invitaciones/icons` esté integrado (3C-3A/3C-3B) se sustituye por
// `<GaleriaIcon />` de ese paquete y este bloque desaparece; la API de `Placeholder` no cambia.
import type { JSX } from "react";
import { clases, color, idEstable, type Tono } from "./base.ts";

export interface PlaceholderPropsBase {
  /**
   * Identificador de la imagen pendiente (`landing-hero`, `evento-boda`… de `11 §9`). Se emite como
   * `data-imagen-pendiente` para que el volcado a `imagenes-pendientes.md` sea mecánico.
   */
  readonly imageId?: string;
  /** Descripción de la foto que irá aquí. Es el nombre accesible si no es decorativa. */
  readonly label: string;
  /** Los dos tonos del degradado. Siempre pasos `-soft`: el placeholder no compite con nada. */
  readonly tones?: readonly [Tono, Tono];
  /**
   * El placeholder SUSTITUYE a una fotografía: por defecto se ANUNCIA con su `label`, al revés que
   * el resto de la biblioteca, que es decorativa. Se apaga cuando la foto va dentro de una
   * composición que ya lleva su propio nombre accesible.
   */
  readonly decorative?: boolean;
  readonly className?: string;
}

export type PlaceholderProps = PlaceholderPropsBase;

export function Placeholder({
  imageId,
  label,
  tones = ["primary-soft", "support-2-soft"],
  decorative = false,
  className,
}: PlaceholderProps): JSX.Element {
  const id = idEstable("degradado", tones[0], tones[1]);
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
      className={clases("ui-forma", "ui-placeholder", className)}
      data-imagen-pendiente={imageId}
      {...(decorative ? { "aria-hidden": true } : { role: "img" as const, "aria-label": label })}
    >
      {decorative ? null : <title>{label}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color(tones[0])} />
          <stop offset="1" stopColor={color(tones[1])} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
      <g
        transform="translate(38 38)"
        fill="none"
        stroke={color("primary")}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="3" fill={color("surface-raised")} />
        <path fill={color("primary-soft")} stroke="none" d="M3.5 18.5 L8.5 12 L12.5 16 L15 13.5 L20.5 18.5 Z" />
        <path d="M3.5 18 L8.5 12 L12.5 16 L15 13.5 L20.5 18.5" />
        <circle cx="16.5" cy="9" r="1.75" fill={color("accent")} stroke="none" />
      </g>
    </svg>
  );
}
