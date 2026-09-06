// packages/template-kit/src/contraste.ts — la compuerta AA del kit sobre las paletas de `theme.json`.
//
// NO se escribe una fórmula nueva. `contrastRatio` y las cinco parejas de `04 §17.1` se importan de
// `packages/sections/src/theme/contrast.ts`, que es la implementación que `ADR-1R-F-06` designa como
// la del frontend, por RUTA RELATIVA y con el mismo precedente y el mismo motivo que
// `packages/schema/test/paleta-contraste.contract.test.ts`: `@invitaciones/sections` sólo publica `.`
// (que arrastra `.tsx` y CSS y no carga en Node) y `./catalog`, así que no hay forma de alcanzar el
// módulo por el mapa de `exports` sin editar un paquete que este bloque tiene prohibido tocar.
// Consecuencia asumida (idéntica a la de `ADR-4-0C-01`): si ese fichero se mueve, esto deja de
// compilar — ruidoso, nunca silencioso.
//
// Las cuatro parejas de `ADR-3-3b-03` (WCAG 1.4.3: `muted` y `accent` son COLOR DE TEXTO en
// `packages/sections`, luego su umbral es 4,5:1 contra `bg` y contra `surface`, no 3,0) se declaran
// aquí porque su única forma ejecutable vive en `frontend/templates/scripts/art/paleta-aa.mjs`, que
// es un `.mjs` fuera del workspace. Son las mismas nueve que miden `paleta-aa.mjs`,
// `packages/sections/test/theme/contraste-plantillas.test.ts` y la compuerta de `packages/schema`.
// NINGÚN umbral se relaja aquí: `contratos.md §12.4` lo prohíbe expresamente.
import { PALETTE_AA_PAIRS, contrastRatio, type PaletteTokens } from "../../sections/src/theme/contrast.ts";

export type { PaletteTokens };
export { contrastRatio };

export interface ParejaAA {
  readonly pair: string;
  readonly a: keyof PaletteTokens;
  readonly b: keyof PaletteTokens;
  readonly threshold: number;
  readonly reason: string;
}

/** Las cuatro de `ADR-3-3b-03`, que ENDURECEN (nunca relajan) lo que dice `04 §17.1`. */
export const PAREJAS_1_4_3: readonly ParejaAA[] = [
  { pair: "muted/bg (1.4.3)", a: "muted", b: "bg", threshold: 4.5, reason: "texto secundario de tamaño normal" },
  { pair: "muted/surface (1.4.3)", a: "muted", b: "surface", threshold: 4.5, reason: "texto secundario sobre tarjetas" },
  { pair: "accent/bg (1.4.3)", a: "accent", b: "bg", threshold: 4.5, reason: "enlaces y horas en texto normal" },
  { pair: "accent/surface (1.4.3)", a: "accent", b: "surface", threshold: 4.5, reason: "los mismos, sobre tarjetas" },
];

/** Las NUEVE parejas con umbral que el kit exige a toda paleta de un `theme.json`. */
export const PAREJAS_AA: readonly ParejaAA[] = [...PALETTE_AA_PAIRS, ...PAREJAS_1_4_3];

export interface FalloDeContraste {
  readonly pair: string;
  readonly a: keyof PaletteTokens;
  readonly b: keyof PaletteTokens;
  readonly hexA: string;
  readonly hexB: string;
  readonly ratio: number;
  readonly threshold: number;
  readonly reason: string;
}

/** Las parejas de una paleta que NO llegan a su umbral, en el orden de `PAREJAS_AA`. */
export function fallosDeContraste(tokens: PaletteTokens): readonly FalloDeContraste[] {
  const salida: FalloDeContraste[] = [];
  for (const { pair, a, b, threshold, reason } of PAREJAS_AA) {
    const ratio = contrastRatio(tokens[a], tokens[b]);
    if (ratio < threshold) {
      salida.push({ pair, a, b, hexA: tokens[a], hexB: tokens[b], ratio, threshold, reason });
    }
  }
  return salida;
}

/**
 * Oscurece un color por su propia rampa (mezcla hacia negro en pasos de 1/64) hasta el valor MÁS
 * CLARO que cumple todos los umbrales pedidos con margen. Es el método de `ADR-3-2d-04`
 * («corrige el color, nunca el umbral»), simplificado: aquí no hay que conservar matiz y saturación
 * exactos de un boceto de arte, porque las paletas del ANDAMIO las elige el kit, no un ilustrador.
 * Devuelve `undefined` si ni el negro puro cumple (no puede pasar con `bg`/`surface` claros).
 */
export function oscurecerHasta(
  hex: string, fondos: readonly string[], umbral: number,
): string | undefined {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  for (let paso = 0; paso <= 64; paso++) {
    const k = 1 - paso / 64;
    const candidato = "#" + [r, g, b]
      .map(c => Math.round(c * k).toString(16).padStart(2, "0")).join("").toUpperCase();
    if (fondos.every(f => contrastRatio(candidato, f) >= umbral + 0.08)) return candidato;
  }
  return undefined;
}
