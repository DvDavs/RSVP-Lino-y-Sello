// @invitaciones/tokens — FUENTE ÚNICA del sistema de diseño del PRODUCTO (chrome del editor, web
// pública, acceso, catálogo, publicación). Cadena de mando:
//
//   src/*.ts  ──emit-css──▶  generated/tokens.css  (--ui-*, :root y [data-theme])
//                     └────▶  generated/tailwind.css (@theme inline, SOLO roles semánticos)
//
// Nunca al revés: si un valor no está en TS, no existe. Prefijo `--ui-` SIEMPRE; el prefijo de las
// plantillas de invitación (`packages/sections`) no aparece en este paquete ni una vez, ni siquiera
// en un comentario — lo comprueba `test/frontera.test.ts` con grep.
export const PAQUETE = "@invitaciones/tokens" as const;

export * from "./oklch.ts";
export * from "./paletas.ts";
export * from "./semantica.ts";
export * from "./contraste.ts";
export * from "./tipografia.ts";
export * from "./espacio.ts";
export * from "./movimiento.ts";
export * from "./css.ts";

import type { RolColor } from "./semantica.ts";
import type { RolTipograficoId } from "./tipografia.ts";
import type { RadioSemantico, RadioNombre, PasoEspacio, SombraNombre, CapaNombre, BreakpointNombre } from "./espacio.ts";
import type { CurvaNombre, DuracionNombre } from "./movimiento.ts";

/** Cualquier variable CSS del sistema. Por construcción, todas empiezan por `--ui-`. */
export type Token = `--ui-${string}`;

/** Los nombres de token que emite `generated/tokens.css`, agrupados por familia. */
export type TokenColor = `--ui-${RolColor}`;
export type TokenTipografico =
  | `--ui-font-${"display" | "text" | "label"}`
  | `--ui-text-${RolTipograficoId}`
  | `--ui-leading-${RolTipograficoId}`
  | `--ui-tracking-${RolTipograficoId}`
  | `--ui-weight-${RolTipograficoId}`;
export type TokenEspacio =
  | `--ui-space-${PasoEspacio}`
  | "--ui-container-max"
  | "--ui-container-gutter"
  | `--ui-radius-${RadioNombre | RadioSemantico}`
  | `--ui-shadow-${SombraNombre}`
  | `--ui-z-${CapaNombre}`
  | `--ui-bp-${BreakpointNombre}`;
export type TokenMovimiento = `--ui-dur-${DuracionNombre}` | `--ui-ease-${CurvaNombre}`;

/** `var(--ui-…)` con el tipo puesto: la única forma correcta de meter color en un componente. */
export const varDe = (token: Token): string => `var(${token})`;
