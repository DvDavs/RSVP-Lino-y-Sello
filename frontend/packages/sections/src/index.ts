// packages/sections/src/index.ts — superficie pública de @invitaciones/sections (04 §2.1).
export { sectionRegistry } from "./registry.ts";
export type { SectionEntry, SectionComponentProps, RenderMode, BlockRef } from "./registry.ts";

export { SectionsRoot } from "./SectionsRoot.tsx";
export type { SectionsRootProps } from "./SectionsRoot.tsx";

export type {
  ComposedBlock,
  ComposedGroup,
  ComposedSection,
  ResolvedTheme,
  ResolvedValue,
  ScalarBlockKind,
} from "./schema-types.ts";

export type { RenderWarning, RenderWarningCode, ReportWarning } from "./types.ts";

// Tema y tokens (04 §5.4/§5.5/§17.1).
export { ThemeProvider } from "./theme/ThemeProvider.tsx";
export type { ThemeProviderProps } from "./theme/ThemeProvider.tsx";
export { GOOGLE_FONT_ALLOWLIST, FONT_SUBSETS, isAllowedGoogleFont, fontFamilyCss } from "./theme/fonts.ts";
export {
  relativeLuminance,
  contrastRatio,
  meetsThreshold,
  evaluatePaletteContrast,
  PALETTE_AA_PAIRS,
} from "./theme/contrast.ts";
export type { PaletteTokens, PaletteContrastResult } from "./theme/contrast.ts";

// Modo canvas (04 §2 tarea 4).
export { CanvasProvider, useCanvasOptional, refKey } from "./canvas/CanvasContext.tsx";
export type { CanvasContextValue, CanvasProviderProps } from "./canvas/CanvasContext.tsx";
export { SelectionOverlay } from "./canvas/SelectionOverlay.tsx";
export type { SelectionOverlayProps } from "./canvas/SelectionOverlay.tsx";

// Los 14 componentes de bloque (04 §5.3).
export * from "./blocks/index.ts";
