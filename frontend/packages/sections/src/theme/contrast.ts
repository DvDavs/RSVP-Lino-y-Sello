// packages/sections/src/theme/contrast.ts — ratio de contraste WCAG 2.x (04 §17.1).
//
// Sin dependencias (~20 líneas de fórmula, tal como pide 04 §17.1). La implementación Kotlin
// espejo (I-31_PALETTE_CONTRAST_BELOW_AA, reservada — ADR-1R-F-06 sigue "propuesta", contratos.md
// §8 y preguntas-abiertas.md "Frontend y editor") comparte la misma tabla de casos que este módulo,
// igual que las invariantes del documento (ADR-005).
//
// Cita: "El cálculo es el de WCAG 2.x: linealizar cada canal sRGB
// (c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4), luminancia 0.2126R + 0.7152G + 0.0722B,
// ratio (L1+0.05)/(L2+0.05)." — 04-frontend-y-editor.md §17.1.

const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

/**
 * Forma mínima de `Palette.tokens` (`manifest.ts`) que necesita este módulo. `@invitaciones/schema`
 * exporta el VALOR `Palette` (el esquema Zod) pero no un `type Palette` inferido, y este paquete no
 * declara `zod` como dependencia directa (`04 §2.1`, node-linker aislado ⇒ nada de dependencias
 * fantasma): en vez de forzar un import de tipo desde `zod`, se declara aquí la forma exacta de las
 * seis claves (`manifest.ts:26-28`), que es un contrato ya cerrado (los 6 tokens de color, `04 §5.4`).
 */
export interface PaletteTokens {
  readonly bg: string;
  readonly surface: string;
  readonly ink: string;
  readonly accent: string;
  readonly accentInk: string;
  readonly muted: string;
}

/** Linealiza un canal sRGB en [0,1] (fórmula WCAG 2.x). */
function linearizeChannel(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa de un color `#rrggbb` (WCAG 2.x, 0 = negro, 1 = blanco). */
export function relativeLuminance(hex: string): number {
  const match = HEX_PATTERN.exec(hex);
  if (!match) {
    throw new RangeError(`relativeLuminance: "${hex}" no es un color hex de 6 dígitos (#rrggbb)`);
  }
  const value = match[1]!;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * linearizeChannel(r) + 0.7152 * linearizeChannel(g) + 0.0722 * linearizeChannel(b);
}

/** Ratio de contraste WCAG entre dos colores hex, siempre ≥ 1 (orden de los argumentos no importa). */
export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** ¿Cumple el ratio el umbral pedido? Envuelto para que el código de llamada no repita el `>=`. */
export function meetsThreshold(ratio: number, threshold: number): boolean {
  return ratio >= threshold;
}

/**
 * Las cinco parejas obligatorias de `04 §17.1`, con su umbral. `label` es el nombre human-legible
 * usado por los mensajes de `PaletteContrastResult` y por `registry.contract.test.ts`-style checks.
 */
export const PALETTE_AA_PAIRS: ReadonlyArray<{
  readonly pair: string;
  readonly a: keyof PaletteTokens;
  readonly b: keyof PaletteTokens;
  readonly threshold: number;
  readonly reason: string;
}> = [
  { pair: "ink/bg", a: "ink", b: "bg", threshold: 4.5, reason: "texto normal sobre el fondo" },
  { pair: "ink/surface", a: "ink", b: "surface", threshold: 4.5, reason: "texto normal sobre tarjetas" },
  {
    pair: "accentInk/accent",
    a: "accentInk",
    b: "accent",
    threshold: 4.5,
    reason: "texto sobre botones/insignias de acento",
  },
  { pair: "muted/bg", a: "muted", b: "bg", threshold: 3.0, reason: "texto secundario grande" },
  { pair: "accent/bg", a: "accent", b: "bg", threshold: 3.0, reason: "componentes de interfaz (1.4.11)" },
];

export interface PaletteContrastResult {
  readonly pair: string;
  readonly ratio: number;
  readonly threshold: number;
  readonly passes: boolean;
}

/** Evalúa las cinco parejas de `04 §17.1` sobre una paleta concreta (`Palette.tokens`). */
export function evaluatePaletteContrast(tokens: PaletteTokens): PaletteContrastResult[] {
  return PALETTE_AA_PAIRS.map(({ pair, a, b, threshold }) => {
    const ratio = contrastRatio(tokens[a], tokens[b]);
    return { pair, ratio, threshold, passes: meetsThreshold(ratio, threshold) };
  });
}
