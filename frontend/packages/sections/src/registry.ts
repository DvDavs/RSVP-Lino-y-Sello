// packages/sections/src/registry.ts — sectionRegistry: la ÚNICA tabla de despacho (04 §5.2).
//
// Contrato exacto de `04 §5.2`, ADEMÁS de las 5 reglas comprobables por prueba (ver
// `test/registry.contract.test.ts`):
//   1. Las claves son EXACTAMENTE los 12 valores de `SectionType` — el objeto literal de abajo,
//      tipado `Record<SectionType, SectionEntry>`, lo fuerza EN COMPILACIÓN: falta una clave ⇒
//      error de tipo (no un `Object.fromEntries` con `as`, que perdería esa garantía).
//   2. `defaultVariant ∈ supportedVariants`.
//   3. `roles ⊆ BlockRole`.
//   4. `pnpm run emit:variants` escribe un `section-variants.json` con `{ [sectionType]: string[] }`.
//   5. Contra los `template.json` reales, `SectionSpec.variants ⊆ supportedVariants` del tipo.
//
// Los datos crudos (variantes/roles/etiquetas) viven en `registry-data.ts` — un módulo SIN JSX
// para que `scripts/emit-section-variants.ts` (que corre con `node --experimental-strip-types`,
// que no transforma JSX) pueda importarlos sin arrastrar `placeholder/SectionPlaceholder.tsx`.
//
// Las 12 entradas usan HOY el mismo componente marcador de posición (`createPlaceholderSection`):
// pinta los bloques por rol con los componentes de `blocks/`, sin ningún diseño de sección. Los
// dos agentes que escriben las 12 secciones reales sustituyen SOLO el campo `component` de su
// entrada — `supportedVariants`, `defaultVariant`, `roles` y `variantLabels` ya están completos y
// verificados contra `boda-clasica@1.0.0` y `xv-jardin@1.0.0` (ver handoffs/3-2a.md).
import type * as React from "react";
import type { SectionType, BlockRole } from "@invitaciones/schema";
import type { ComposedSection } from "./schema-types.ts";
import type { BlockRef, RenderMode } from "./types.ts";
import { SECTION_REGISTRY_DATA, labelsFor } from "./registry-data.ts";
import { createPlaceholderSection } from "./placeholder/SectionPlaceholder.tsx";
import { CoverSection } from "./sections/CoverSection.tsx";
import { CelebrantSection } from "./sections/CelebrantSection.tsx";
import { EventSection } from "./sections/EventSection.tsx";
import { GallerySection } from "./sections/GallerySection.tsx";
import { StorySection } from "./sections/StorySection.tsx";
import { DressCodeSection } from "./sections/DressCodeSection.tsx";

export type { RenderMode, BlockRef } from "./types.ts";

export interface SectionComponentProps {
  /** La sección ya compuesta. NUNCA recibe el documento crudo ni el manifiesto. */
  readonly section: ComposedSection;
  /** Variante efectiva. Si no está en `supportedVariants`, el componente pinta `defaultVariant` y avisa. */
  readonly variant: string;
  readonly mode: RenderMode;
  /** Solo en mode="canvas": el bloque resaltado por el panel. */
  readonly selected?: BlockRef | null;
  /** Solo en mode="canvas": el componente lo invoca al hacer clic en una zona editable. */
  readonly onActivate?: (ref: BlockRef) => void;
  /** Bloques cuyo valor está pendiente de confirmación del servidor (§12.4): se pintan con aria-busy. */
  readonly pending?: ReadonlySet<string>;
}

export interface SectionEntry {
  readonly component: React.FC<SectionComponentProps>;
  /** Catálogo CERRADO de variantes que este componente sabe pintar. */
  readonly supportedVariants: readonly string[];
  readonly defaultVariant: string;
  /** Roles que el componente coloca en un hueco propio. Un rol ausente NO se renderiza (R5). */
  readonly roles: readonly BlockRole[];
  /** Etiqueta es-MX de cada variante para el selector del panel (§6.3). */
  readonly variantLabels: Readonly<Record<string, string>>;
}

function buildEntry(sectionType: SectionType): SectionEntry {
  const d = SECTION_REGISTRY_DATA[sectionType];
  return {
    component: createPlaceholderSection(sectionType, d.roles, d.supportedVariants, d.defaultVariant),
    supportedVariants: d.supportedVariants,
    defaultVariant: d.defaultVariant,
    roles: d.roles,
    variantLabels: labelsFor(d.supportedVariants),
  };
}

export const sectionRegistry: Readonly<Record<SectionType, SectionEntry>> = {
  // Bloque 3-2b (este agente): 6 componentes reales — solo se sustituye `component`.
  cover: { ...buildEntry("cover"), component: CoverSection },
  celebrant: { ...buildEntry("celebrant"), component: CelebrantSection },
  event: { ...buildEntry("event"), component: EventSection },
  gallery: { ...buildEntry("gallery"), component: GallerySection },
  story: { ...buildEntry("story"), component: StorySection },
  dressCode: { ...buildEntry("dressCode"), component: DressCodeSection },
  // Bloque 3-2c (otro agente, en paralelo): siguen en marcador de posición hasta que sustituya
  // `component` de sus 6 entradas — NO TOCAR estas líneas (brief 3-2b, "ARCHIVOS QUE TE TOCAN").
  giftTable: buildEntry("giftTable"),
  suggestions: buildEntry("suggestions"),
  amenities: buildEntry("amenities"),
  rsvp: buildEntry("rsvp"),
  family: buildEntry("family"),
  footer: buildEntry("footer"),
};
