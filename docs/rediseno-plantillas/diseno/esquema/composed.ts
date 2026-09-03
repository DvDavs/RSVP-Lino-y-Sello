// packages/schema/src/composed.ts — entrada y salida de compose(). El ComposedDocument es lo ÚNICO que
// consumen los componentes de sección (editor y render público). Aquí sí hay URLs y tokens resueltos.
import { z } from "zod";
import { BlockId, HexColor, HttpUrl, Ident, IsoDate, IsoTime, Locale, SectionKey, Semver, TemplateSlug, Ulid } from "./common.ts";
import { SectionType } from "./manifest.ts";
import { BlockKind, BlockRole as Role, RichDoc } from "./blocks.ts";

/** Proyección inmutable de Postgres (tabla invitation). La construye el backend; el frontend nunca consulta Postgres. */
export const BusinessSnapshot = z.strictObject({
  invitationId: z.number().int().positive(),
  date: IsoDate.nullable(),
  time: IsoTime.nullable(),
  hashtag: z.string().max(80).nullable(),
  coverPhotoUrl: HttpUrl.nullable(),
  childrenAllowed: z.boolean(),
  youngAllowed: z.boolean(),
  eventKind: z.enum(["wedding", "quince", "baptism", "communion", "confirmation", "birthday", "graduation", "generic"]),
  planTier: z.number().int().min(1).max(3),
  timezone: z.string().default("America/Mexico_City"),
});

/** assetId → URL pública resuelta (CDN). El backend la construye desde tpl_asset; en golden files es fija. */
export const AssetIndex = z.record(z.string(), z.strictObject({
  url: HttpUrl, width: z.number().int().optional(), height: z.number().int().optional(),
}));

export const Provenance = z.enum(["user", "default", "business", "fixed", "empty"]);

/** Valor resuelto: mismo `kind` del catálogo + campos de render (url, texto formateado). */
export const ResolvedValue = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("text"), value: z.string() }),
  z.strictObject({ kind: z.literal("richText"), doc: RichDoc }),
  z.strictObject({ kind: z.literal("listText"), items: z.array(z.string()) }),
  z.strictObject({ kind: z.literal("image"), url: HttpUrl, alt: z.string(), focal: z.strictObject({ x: z.number(), y: z.number() }) }),
  z.strictObject({ kind: z.literal("audio"), url: HttpUrl }),
  z.strictObject({ kind: z.literal("date"), value: IsoDate, formatted: z.string() }),
  z.strictObject({ kind: z.literal("time"), value: IsoTime, formatted: z.string() }),
  z.strictObject({ kind: z.literal("dateTimeRange"), start: z.string(), end: z.string().optional(), formatted: z.string() }),
  z.strictObject({ kind: z.literal("link"), href: HttpUrl, label: z.string().optional() }),
  z.strictObject({ kind: z.literal("location"), name: z.string(), address: z.string().optional(), mapHref: HttpUrl.optional() }),
  z.strictObject({ kind: z.literal("choice"), optionId: Ident, label: z.string() }),
  z.strictObject({ kind: z.literal("boolean"), value: z.boolean() }),
  z.strictObject({ kind: z.literal("person"), name: z.string(), note: z.string().optional() }),
]);

export const ComposedBlock = z.strictObject({
  id: BlockId,
  role: Role,
  type: BlockKind,
  label: z.string(),
  provenance: Provenance,
  value: ResolvedValue.nullable(),
});
export const ComposedItem = z.strictObject({ itemId: Ulid, blocks: z.array(ComposedBlock) });
export const ComposedGroup = z.strictObject({
  id: BlockId, role: Role, type: z.literal("group"), label: z.string(), provenance: Provenance,
  items: z.array(ComposedItem),
});

export const ComposedSection = z.strictObject({
  key: SectionKey,
  type: SectionType,
  variant: Ident,
  visible: z.boolean(),
  title: z.string(),
  blocks: z.array(z.union([ComposedBlock, ComposedGroup])),
});

export const ResolvedTheme = z.strictObject({
  paletteId: Ident,
  fontSetId: Ident,
  tokens: z.record(z.string(), HexColor),
  fonts: z.strictObject({
    heading: z.strictObject({ family: z.string(), weights: z.array(z.number()), source: z.string() }),
    body: z.strictObject({ family: z.string(), weights: z.array(z.number()), source: z.string() }),
  }),
});

export const ComposedDocument = z.strictObject({
  composedVersion: z.literal(1),
  template: z.strictObject({ slug: TemplateSlug, version: Semver }),
  locale: Locale,
  theme: ResolvedTheme,
  sections: z.array(ComposedSection),   // ya ordenadas; las no visibles se incluyen con visible=false
});

export const CompositionReport = z.strictObject({
  missingRequired: z.array(BlockId),         // bloque requerido sin valor de usuario ni default
  stillDefault: z.array(BlockId),            // bloque requerido que sigue en demo (H-03; bloquea publicar)
  orphanContent: z.array(BlockId),           // clave de content no declarada en esta versión
  orphanSections: z.array(SectionKey),
  invalidValues: z.array(z.strictObject({ blockId: BlockId, code: z.string() })), // valor presente pero inválido para el spec
  themeFallback: z.strictObject({ paletteId: Ident.optional(), fontSetId: Ident.optional() }).nullable(),
});

export const CompositionResult = z.strictObject({ composed: ComposedDocument, report: CompositionReport });

export type BusinessSnapshot = z.infer<typeof BusinessSnapshot>;
export type ComposedDocument = z.infer<typeof ComposedDocument>;
export type CompositionReport = z.infer<typeof CompositionReport>;
export type CompositionResult = z.infer<typeof CompositionResult>;
export type AssetIndex = z.infer<typeof AssetIndex>;
