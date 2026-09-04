// frontend/templates/scripts/art/color.mjs
//
// Aritmética de color y contraste WCAG 2.x. Sin dependencias: es la MISMA fórmula que
// `04 §17.1` fija para `packages/sections/src/theme/contrast.ts` y para su espejo Kotlin
// (linealizar sRGB → luminancia relativa → (L1+0.05)/(L2+0.05)), reimplementada aquí porque
// este generador vive fuera del workspace pnpm (ADR-3-2d-01) y no puede importar de él.

/** "#RRGGBB" → [r, g, b] en 0..255. */
export function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** [r, g, b] en 0..255 → "#RRGGBB" en mayúsculas. */
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(b)).toUpperCase();
}

/** Mezcla lineal en sRGB. `t=0` → a, `t=1` → b. */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Aclara hacia blanco. */
export const lighten = (hex, t) => mix(hex, '#FFFFFF', t);
/** Oscurece hacia negro. */
export const darken = (hex, t) => mix(hex, '#000000', t);

/** Luminancia relativa WCAG 2.x de un canal sRGB 0..255. */
function canal(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa WCAG 2.x, de un hex o de un [r,g,b] 0..255. */
export function luminancia(color) {
  const [r, g, b] = typeof color === 'string' ? hexToRgb(color) : color;
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Ratio de contraste WCAG 2.x entre dos colores (hex o [r,g,b]). Siempre ≥ 1. */
export function ratio(a, b) {
  const la = luminancia(a), lb = luminancia(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Redondea a 2 decimales HACIA ABAJO: 4.499 nunca puede presentarse como "4.50". */
export const r2 = (x) => Math.floor(x * 100) / 100;
