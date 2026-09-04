// packages/sections/src/theme/fonts.ts — lista blanca de familias `source:"google"` + resolución
// de `font-family` CSS para `--inv-font-heading`/`--inv-font-body` (04 §5.5, ADR-1R-F-07).
//
// Alcance deliberadamente acotado: este paquete NO carga archivos de fuente (ni `@font-face` con
// URL real, ni `next/font/google`). Dos motivos verificados [V] contra el esquema:
//   1. `next/font/google` es una macro del COMPILADOR de Next.js (exige argumentos literales en
//      tiempo de build) — no puede ejecutarse dentro de `packages/sections`, que no depende de
//      `next` en absoluto (04 §19.3: `no-restricted-imports` prohíbe `next/*` salvo `next/image`
//      en este paquete).
//   2. `ResolvedTheme.fonts.*` (composed.ts:80-83) SOLO trae `{family, weights, source}` — NINGUNA
//      URL, ni para `source:"bundled"` ni para `source:"google"`. `compose()` no la resuelve.
//      Hueco de esquema registrado en `preguntas-abiertas.md` (no se toca `packages/schema`).
// Por eso `apps/web` es quien de verdad monta las fuentes (con `next/font/google` para las de la
// allowlist, y con un `<link rel="preload">`/`@font-face` propio para `source:"bundled"`, usando
// esta lista como única fuente de verdad de qué familias de Google están permitidas — mismo
// patrón que `generated/section-variants.json`, 04 §5.2 regla 4).

/**
 * Familias `source:"google"` permitidas. Cerrada a propósito (ADR-1R-F-07: "una familia fuera de
 * la allowlist no puede cargarse dinámicamente"). Arranca con las 4 que usan de verdad
 * `boda-clasica@1.0.0` y `xv-jardin@1.0.0` (`theme.json`, verificado [V]) más 4 alternativas
 * editoriales afines (serif/sans emparejables) para que el kit de autor de fase 4 tenga margen
 * sin tocar este archivo el primer día. Ampliar esta lista NO es un cambio de esquema (no toca
 * `packages/schema`): es agregar una línea aquí + registrar la plantilla que la declare.
 */
export const GOOGLE_FONT_ALLOWLIST: readonly string[] = [
  "Cormorant Garamond",
  "Playfair Display",
  "EB Garamond",
  "Lora",
  "Inter",
  "Source Sans 3",
  "Work Sans",
  "Nunito Sans",
];

const GOOGLE_FONT_SET = new Set(GOOGLE_FONT_ALLOWLIST);

export function isAllowedGoogleFont(family: string): boolean {
  return GOOGLE_FONT_SET.has(family);
}

/** Subconjunto exigido por `04 §5.5`: es-MX necesita latin + latin-ext, nunca solo latin. */
export const FONT_SUBSETS = ["latin", "latin-ext"] as const;

/** Pilas de reserva genéricas — LAS MISMAS que `tokens.css` usa como valor de reserva estático,
 *  para que el CSS final sea idéntico tenga o no `ThemeProvider` montado. */
const SERIF_FALLBACK = `Georgia, "Iowan Old Style", "Noto Serif", "Times New Roman", serif`;
const SANS_FALLBACK = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

function quoteFamily(family: string): string {
  const trimmed = family.trim();
  if (trimmed.length === 0) return trimmed;
  return /\s/.test(trimmed) ? `"${trimmed.replace(/"/g, '\\"')}"` : trimmed;
}

/**
 * Construye el valor CSS de `font-family`: familia declarada + pila de reserva. `role` decide qué
 * pila de reserva usar cuando la familia no cargue (headings de invitación son serif por
 * convención editorial; el cuerpo, sans — igual que el valor de reserva de `tokens.css`).
 */
export function fontFamilyCss(family: string, role: "heading" | "body"): string {
  const quoted = quoteFamily(family);
  const fallback = role === "heading" ? SERIF_FALLBACK : SANS_FALLBACK;
  return quoted.length > 0 ? `${quoted}, ${fallback}` : fallback;
}
