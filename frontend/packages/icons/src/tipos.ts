// packages/icons/src/tipos.ts — tipos públicos compartidos por todo icono generado.
//
// `tone` decide el mecanismo del segundo tono (ADR-3C-3-01, doc 11 §4.1 no lo fija): cada icono con
// una pieza de `--tono` la pinta con `var(--tono)`; el componente resuelve esa variable a nivel del
// propio `<svg>` según `tone`:
//   - "duo" (por defecto): `--tono: var(--ui-primary-soft)` — el aspecto de dos tonos del sistema.
//   - "mono": `--tono: currentColor` — la pieza secundaria se funde con el trazo (un solo tono),
//     para contextos de icono plano (texto en línea, barras densas, estado deshabilitado).
// Nunca un color literal: en ambos casos el valor es `currentColor` o un token `--ui-*`.
import type { SVGProps } from "react";

export type IconTone = "mono" | "duo";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "ref"> {
  /** Lado del cuadrado en px. La retícula interna es 24; el trazo escala con el tamaño (11 §4.1). */
  size?: number;
  /**
   * Nombre accesible. Con `title`, el icono es `role="img"` con `<title>` (nombre accesible real).
   * Sin `title` (el caso normal: icono decorativo o icono único dentro de un control con
   * `aria-label`), el icono queda `aria-hidden="true"` (doc 11 §4.1).
   */
  title?: string;
  /** Mecanismo del segundo tono. Por defecto "duo". */
  tone?: IconTone;
}
