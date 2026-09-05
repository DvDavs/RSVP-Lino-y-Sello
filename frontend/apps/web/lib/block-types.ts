// lib/block-types.ts — tipos TypeScript derivados con `z.infer` para las formas de
// `@invitaciones/schema` que el paquete EXPORTA COMO ESQUEMA (valor) pero NO como `type` individual
// (verificado: `packages/schema/src/blocks.ts` y `composed.ts` solo exportan `type` para las uniones
// grandes — `BlockValue`, `ScalarValue`, `BlockSpec`, `ComposedDocument`… — no para cada variante
// escalar). Sin este archivo, `import type { TextSpec }` fracasa con TS2749 ("refers to a value").
// `packages/schema/**` es zona prohibida para este bloque (no se toca ni se le añaden exports): esto
// es derivación LOCAL de tipos ya públicos, no una copia del esquema — cero duplicación de reglas.
import type { z } from "zod";
import {
  AudioSpec as AudioSpecSchema,
  AudioValue as AudioValueSchema,
  BooleanSpec as BooleanSpecSchema,
  BooleanValue as BooleanValueSchema,
  ChoiceSpec as ChoiceSpecSchema,
  ChoiceValue as ChoiceValueSchema,
  DateSpec as DateSpecSchema,
  DateTimeRangeSpec as DateTimeRangeSpecSchema,
  DateTimeRangeValue as DateTimeRangeValueSchema,
  DateValue as DateValueSchema,
  Focal as FocalSchema,
  GroupItem as GroupItemSchema,
  ImageSpec as ImageSpecSchema,
  ImageValue as ImageValueSchema,
  LinkSpec as LinkSpecSchema,
  LinkValue as LinkValueSchema,
  ListTextSpec as ListTextSpecSchema,
  ListTextValue as ListTextValueSchema,
  LocationSpec as LocationSpecSchema,
  LocationValue as LocationValueSchema,
  PersonSpec as PersonSpecSchema,
  PersonValue as PersonValueSchema,
  RichDoc as RichDocSchema,
  RichParagraph as RichParagraphSchema,
  RichSpan as RichSpanSchema,
  RichTextSpec as RichTextSpecSchema,
  RichTextValue as RichTextValueSchema,
  TextSpec as TextSpecSchema,
  TextValue as TextValueSchema,
  TimeSpec as TimeSpecSchema,
  TimeValue as TimeValueSchema,
} from "@invitaciones/schema";
import {
  ComposedBlock as ComposedBlockSchema,
  ComposedGroup as ComposedGroupSchema,
  ComposedItem as ComposedItemSchema,
  ComposedSection as ComposedSectionSchema,
  Provenance as ProvenanceSchema,
  ResolvedTheme as ResolvedThemeSchema,
  ResolvedValue as ResolvedValueSchema,
} from "@invitaciones/schema";

// ---------------------------------------------------------------------------------------------
// Especificaciones de bloque (`esquema/blocks.ts` §3) — una por tipo escalar.
// ---------------------------------------------------------------------------------------------
export type TextSpec = z.infer<typeof TextSpecSchema>;
export type RichTextSpec = z.infer<typeof RichTextSpecSchema>;
export type ListTextSpec = z.infer<typeof ListTextSpecSchema>;
export type ImageSpec = z.infer<typeof ImageSpecSchema>;
export type AudioSpec = z.infer<typeof AudioSpecSchema>;
export type DateSpec = z.infer<typeof DateSpecSchema>;
export type TimeSpec = z.infer<typeof TimeSpecSchema>;
export type DateTimeRangeSpec = z.infer<typeof DateTimeRangeSpecSchema>;
export type LinkSpec = z.infer<typeof LinkSpecSchema>;
export type LocationSpec = z.infer<typeof LocationSpecSchema>;
export type ChoiceSpec = z.infer<typeof ChoiceSpecSchema>;
export type BooleanSpec = z.infer<typeof BooleanSpecSchema>;
export type PersonSpec = z.infer<typeof PersonSpecSchema>;

// ---------------------------------------------------------------------------------------------
// Valores de bloque (`esquema/blocks.ts` §1).
// ---------------------------------------------------------------------------------------------
export type TextValue = z.infer<typeof TextValueSchema>;
export type RichTextValue = z.infer<typeof RichTextValueSchema>;
export type ListTextValue = z.infer<typeof ListTextValueSchema>;
export type ImageValue = z.infer<typeof ImageValueSchema>;
export type AudioValue = z.infer<typeof AudioValueSchema>;
export type DateValue = z.infer<typeof DateValueSchema>;
export type TimeValue = z.infer<typeof TimeValueSchema>;
export type DateTimeRangeValue = z.infer<typeof DateTimeRangeValueSchema>;
export type LinkValue = z.infer<typeof LinkValueSchema>;
export type LocationValue = z.infer<typeof LocationValueSchema>;
export type ChoiceValue = z.infer<typeof ChoiceValueSchema>;
export type BooleanValue = z.infer<typeof BooleanValueSchema>;
export type PersonValue = z.infer<typeof PersonValueSchema>;
export type GroupItem = z.infer<typeof GroupItemSchema>;
export type Focal = z.infer<typeof FocalSchema>;
export type RichDoc = z.infer<typeof RichDocSchema>;
export type RichParagraph = z.infer<typeof RichParagraphSchema>;
export type RichSpan = z.infer<typeof RichSpanSchema>;

// ---------------------------------------------------------------------------------------------
// Documento compuesto (`esquema/composed.ts`) — lo que de verdad pinta el lienzo y consume el panel.
// ---------------------------------------------------------------------------------------------
export type ComposedBlock = z.infer<typeof ComposedBlockSchema>;
export type ComposedGroup = z.infer<typeof ComposedGroupSchema>;
export type ComposedItem = z.infer<typeof ComposedItemSchema>;
export type ComposedSection = z.infer<typeof ComposedSectionSchema>;
export type ResolvedValue = z.infer<typeof ResolvedValueSchema>;
export type ResolvedTheme = z.infer<typeof ResolvedThemeSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
