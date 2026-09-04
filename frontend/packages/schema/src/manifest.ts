// packages/schema/src/manifest.ts — paquete de plantilla: template.json, theme.json, defaults.json, migrations/*.json
import { z } from "zod";
import { BlockId, EventKind, HexColor, Ident, Locale, LocalizedText, SectionKey, Semver, TemplateSlug } from "./common.ts";
import { BlockSpec, BlockValue } from "./blocks.ts";

/** Tipos de sección (catálogo cerrado, 12): cubre las 13 claves de los 9 default_visual_*.json (J §3). */
export const SectionType = z.enum([
  "cover", "celebrant", "event", "gallery", "giftTable", "suggestions", "amenities",
  "rsvp", "family", "story", "dressCode", "footer",
]);

export const SectionSpec = z.strictObject({
  key: SectionKey,
  type: SectionType,
  title: LocalizedText,
  variants: z.array(Ident).min(1).max(6),
  defaultVariant: Ident,            // ∈ variants (I-08)
  required: z.boolean().default(false),   // true ⇒ visible no puede ser false
  defaultVisible: z.boolean().default(true),
  blocks: z.array(BlockSpec).min(1).max(40),
});

export const Palette = z.strictObject({
  id: Ident,
  name: LocalizedText,
  tokens: z.strictObject({
    bg: HexColor, surface: HexColor, ink: HexColor, accent: HexColor, accentInk: HexColor, muted: HexColor,
  }),
});
export const FontFace = z.strictObject({
  family: z.string().min(1).max(60),
  weights: z.array(z.number().int().min(100).max(900)).min(1).max(4),
  source: z.enum(["google", "bundled"]),
});
export const FontSet = z.strictObject({ id: Ident, name: LocalizedText, heading: FontFace, body: FontFace });

/** theme.json — presets del autor. El documento del cliente solo referencia ids (P3). */
export const ThemeSpec = z.strictObject({
  palettes: z.array(Palette).min(1).max(12),
  fontSets: z.array(FontSet).min(1).max(8),
  defaultPaletteId: Ident,   // ∈ palettes (I-09)
  defaultFontSetId: Ident,   // ∈ fontSets (I-09)
});

export const AssetEntry = z.strictObject({
  path: z.string().regex(/^assets\/[a-z0-9][a-z0-9._-]{0,99}$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  contentType: z.enum(["image/webp", "image/png", "image/jpeg", "image/svg+xml", "audio/mpeg", "font/woff2"]),
  bytes: z.number().int().min(1).max(15_728_640),
});

/** Capacidades declaradas (sustituyen a templateId mágicos, H-11/H-12). */
/**
 * Capacidades DECLARADAS por la plantilla (nunca un `templateId` mágico, H-11). Son propiedad del paquete,
 * no dato de ninguna invitación: no viajan en `InvitationDocument` y el cliente no las edita.
 * `singlePlace` (X-16): se mantiene. `itemsSinglePlace` del módulo antiguo nunca llegó a las fases F2/F3 del
 * generador (H-12), así que NINGUNA invitación existente tiene datos de origen para ella; solo puede poblarse
 * desde F1 (el JSON del repositorio) como *default de plantilla* (`05 §2`, `§7 tabla de mapeo`). Que no haya
 * datos de origen es exactamente el motivo de conservarla: es la funcionalidad que H-12 dejó muerta y que el
 * módulo nuevo repara. Retirarla del enum sería normalizar la pérdida.
 */
export const Capability = z.enum(["singlePlace", "story", "hashtags", "music", "countdown"]);

/** template.json */
export const TemplateManifest = z.strictObject({
  manifestVersion: z.literal(1),
  slug: TemplateSlug,
  version: Semver,
  name: LocalizedText,
  description: LocalizedText.optional(),
  eventKinds: z.array(EventKind).min(1).max(8),
  minPlanTier: z.number().int().min(1).max(3).default(1),
  locales: z.array(Locale).min(1),
  capabilities: z.array(Capability).max(5).default([]),
  previewImage: z.string().regex(/^assets\//).optional(),
  sections: z.array(SectionSpec).min(1).max(16),
  assets: z.array(AssetEntry).max(200).default([]),
  /** versiones desde las que existe plan de migración en migrations/<from>-to-<version>.json */
  migrationsFrom: z.array(Semver).max(20).default([]),
});

/** defaults.json — contenido de demostración por id de bloque. Toda clave debe ser un blockId del manifiesto (I-10). */
export const DefaultsFile = z.strictObject({
  templateSlug: TemplateSlug,
  templateVersion: Semver,
  content: z.record(BlockId, BlockValue),
});

/** migrations/<from>-to-<to>.json — operaciones declarativas, catálogo cerrado (01 §7). */
export const MigrationOp = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("renameBlock"), from: BlockId, to: BlockId }),
  z.strictObject({ op: z.literal("removeBlock"), id: BlockId }),                   // → attic, nunca borra
  z.strictObject({ op: z.literal("addBlock"), id: BlockId }),                      // toma el default
  z.strictObject({ op: z.literal("renameSection"), from: SectionKey, to: SectionKey }),
  z.strictObject({ op: z.literal("removeSection"), key: SectionKey }),
  z.strictObject({ op: z.literal("renamePalette"), from: Ident, to: Ident }),
  z.strictObject({ op: z.literal("renameFontSet"), from: Ident, to: Ident }),
  z.strictObject({ op: z.literal("changeBlockType"), id: BlockId,
    converterId: z.enum(["textToRichText", "richTextToText", "textToListText", "listTextToText"]) }),
  z.strictObject({ op: z.literal("moveIntoGroup"), blockId: BlockId, groupId: BlockId, itemBlockId: BlockId }),
  z.strictObject({ op: z.literal("flattenGroup"), groupId: BlockId, itemBlockId: BlockId, toBlockId: BlockId }),
  z.strictObject({ op: z.literal("shrinkGroup"), groupId: BlockId, max: z.number().int().min(1).max(24) }), // excedente → attic
]);
export const MigrationPlan = z.strictObject({
  templateSlug: TemplateSlug,
  from: Semver,
  to: Semver,
  ops: z.array(MigrationOp).max(200),
});

export type TemplateManifest = z.infer<typeof TemplateManifest>;
export type SectionSpec = z.infer<typeof SectionSpec>;
export type ThemeSpec = z.infer<typeof ThemeSpec>;
export type DefaultsFile = z.infer<typeof DefaultsFile>;
export type MigrationPlan = z.infer<typeof MigrationPlan>;
export type SectionType = z.infer<typeof SectionType>;
