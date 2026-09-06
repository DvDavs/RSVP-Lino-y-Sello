// packages/icons/src/tipos.ts — tipos públicos compartidos por todo icono generado.
//
// `tone` decide el mecanismo del segundo tono (ADR-3C-3-01, doc 11 §4.1 no lo fija): cada icono con
// una pieza de `--tono` la pinta con `var(--tono)`; el componente resuelve esa variable a nivel del
// propio `<svg>` según `tone`:
//   - "duo" (por defecto): `--tono: var(--ui-primary-soft)` — el aspecto de dos tonos del sistema.
//   - "mono": `--tono: transparent` — la pieza secundaria se queda SIN relleno y el icono es puro
//     dibujo de línea, para contextos de icono plano (texto en línea, barras densas, control con
//     color propio como un botón de peligro, estado deshabilitado).
// Nunca un color literal: el valor es un token `--ui-*` o la palabra clave `transparent`.
//
// Por qué `transparent` y no `currentColor` (revisión de calidad visual del cierre de 3-C): con
// `currentColor` la pieza principal se rellenaba del MISMO color que el trazo, así que el icono
// perdía su dibujo y se veía como una silueta maciza — `ayuda` era un disco sin interrogación,
// `agregar` un disco sin cruz, `borrar` un bote macizo que parecía un menú, `exito`/`error`/`info`
// discos sin su marca, `vista-previa`/`portada`/`qr`/`pie` cuadrados negros. Eso rompe 11 §4.1
// («el dibujo y el trazo no cambian»). Con `transparent` el dibujo es idéntico al de `duo` y solo
// desaparece el segundo tono, que es lo que «un solo tono» tiene que significar.
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
