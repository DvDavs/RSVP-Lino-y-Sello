// Tipos compartidos por todos los iconos generados (11 §4, ADR-3C-0-04).
import type { SVGProps } from "react";

/** `duo` (por defecto) pinta la pieza principal en `--tono` (`var(--ui-primary-soft)` salvo que el
 * padre fije `--tono` por CSS, p. ej. el color por categoría de `11 §4.1`). `mono` iguala `--tono` a
 * `currentColor`: el icono queda de un solo trazo para contextos de un color (texto en línea,
 * botones de icono). Nunca `fill-opacity`: así el relleno es un color propio que también cambia
 * bien en oscuro (ADR-3C-0-04). */
export type IconoTono = "mono" | "duo";

export interface IconoProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Lado del icono en píxeles CSS (ancho = alto). 24 por defecto; a 48 el trazo escala con el
   * icono (no se fija con `vector-effect`). */
  size?: number;
  /** Nombre accesible. Con `title`: `role="img"` + `<title>`. Sin `title`: `aria-hidden="true"`
   * (11 §4.1 — el control que lo envuelve lleva entonces su propio `aria-label`). */
  title?: string;
  tone?: IconoTono;
}
