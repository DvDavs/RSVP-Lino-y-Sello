// packages/ui/src/shapes/Placeholder.tsx — placeholder del sistema para una imagen que TODAVÍA no
// existe (`11 §3.3` y `11 §9`).
//
// Qué pinta: un degradado de dos tonos `-soft` de la paleta (principal → apoyo 2 por defecto) y el
// icono de galería de dos tonos centrado. No recorta: el recorte lo pone `Image`, que es quien sabe
// qué máscara toca. Marca la pieza con `data-imagen-pendiente="<id>"` para que el bloque 3 vuelque
// la lista a `imagenes-pendientes.md` con un `grep`, sin inventario a mano.
//
// (3C-integración, bloque 2/F3): el `<g>` con los `d` a mano que vivía aquí era una copia LITERAL
// del icono `galeria` del moodboard, a la espera de que `@invitaciones/icons` existiera. Ya existe
// (3C-3A/3C-3B): se sustituye por `<IconoGaleria />` real del paquete. Mismo dibujo (los `d` del
// SVG generado son byte a byte los mismos que tenía esta copia), misma posición (`translate(38 38)`
// sobre el `viewBox` de 100, icono a 24×24 sin escalar) y la API de `Placeholder` no cambia — sigue
// verde `formas.test.tsx` («Placeholder — imagen pendiente del sistema»): el `<g>` exterior conserva
// `stroke`/`stroke-width` como tokens explícitos y ningún hex aparece en el HTML resultante.
import type { JSX } from "react";
import { IconoGaleria } from "@invitaciones/icons";
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
      {/* `color`: fija `currentColor` para el `stroke="currentColor"` del icono generado sin tocar
          su fuente (`packages/icons/svg/galeria.svg`, «cópialos sin retocar», `11 §4.2`). `stroke`/
          `stroke-width` explícitos en el propio `<g>`: es lo que verifica `formas.test.tsx`. */}
      <g
        transform="translate(38 38)"
        fill="none"
        color={color("primary")}
        stroke={color("primary")}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <IconoGaleria size={24} />
      </g>
    </svg>
  );
}
