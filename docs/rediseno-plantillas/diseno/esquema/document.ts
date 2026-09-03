// packages/schema/src/document.ts — documento de invitación (capas 2-4). Sin URLs, colores, tamaños ni fuentes.
import { z } from "zod";
import { BlockId, Ident, Locale, SectionKey, Semver, TemplateSlug } from "./common.ts";
import { BlockValue } from "./blocks.ts";

export const ThemeChoice = z.strictObject({ paletteId: Ident, fontSetId: Ident });

export const StructureEntry = z.strictObject({
  key: SectionKey,
  variant: Ident,
  visible: z.boolean(),
});
/** El orden del array ES el orden de la página. Sin repetidos (I-11). */
export const Structure = z.strictObject({ sections: z.array(StructureEntry).max(16) });

export const InvitationDocument = z.strictObject({
  schemaVersion: z.literal(1),
  template: z.strictObject({ slug: TemplateSlug, version: Semver }),
  theme: ThemeChoice,
  structure: Structure,
  /** Mapa plano por blockId declarado en esa versión (I-12). Los grupos llevan sus ítems dentro. */
  content: z.record(BlockId, BlockValue),
  /** Contenido huérfano tras migración o cambio de plantilla: {"<slug>@<version>": {blockId: value}}. Solo lo escribe el sistema. */
  attic: z.record(z.string().regex(/^[a-z0-9-]+@\d+\.\d+\.\d+$/), z.record(z.string().max(120), BlockValue)).default({}),
  meta: z.strictObject({ locale: Locale }),
});

export type InvitationDocument = z.infer<typeof InvitationDocument>;
export type StructureEntry = z.infer<typeof StructureEntry>;
