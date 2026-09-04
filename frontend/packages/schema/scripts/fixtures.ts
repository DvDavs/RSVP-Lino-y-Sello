// packages/schema/scripts/fixtures.ts — constructores mínimos reutilizables para generar los golden
// files (ADR-1R-D-09: nunca se escriben a mano; este módulo es el ÚNICO lugar donde se ensamblan
// manifiestos/documentos de prueba, y gen-golden*.ts los ejecuta contra las funciones reales).
import type { TemplateManifest, SectionSpec, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import type { InvitationDocument, StructureEntry } from "../src/document.ts";
import type { BlockSpec, BlockValue, ScalarValue, GroupValue } from "../src/blocks.ts";

// ---------------------------------------------------------------------------------------------
// Identificadores estables (Crockford base32 en mayúsculas: sin I, L, O, U).
// ---------------------------------------------------------------------------------------------
export const ulid = (tag: string): string => {
  const body = (tag + "A".repeat(22)).slice(0, 22).toUpperCase().replace(/[ILOU]/g, "A");
  return "01J8" + body;
};
export const assetId = (tag: string): string => "as_" + ulid(tag);

// ---------------------------------------------------------------------------------------------
// LocalizedText
// ---------------------------------------------------------------------------------------------
export const loc = (esMX: string, extra: Partial<Record<"es-ES" | "en-US", string>> = {}) =>
  ({ "es-MX": esMX, ...extra });

// ---------------------------------------------------------------------------------------------
// Specs — cada factoría rellena TODOS los campos por defecto explícitamente (z.infer exige el
// tipo de SALIDA, ya con los .default() resueltos). Se anotan con BlockSpec (unión discriminada)
// para que el array `blocks: BlockSpec[]` de sectionSpec() los acepte.
// ---------------------------------------------------------------------------------------------
type BusinessFieldId =
  | "invitation.date" | "invitation.time" | "invitation.hashtag" | "invitation.coverPhotoUrl"
  | "invitation.childrenAllowed" | "invitation.youngAllowed";
type SpecOverrides = Partial<{
  required: boolean; editable: boolean; source: "user" | "business" | "fixed";
  businessField: BusinessFieldId; aiEditable: boolean; help: ReturnType<typeof loc>;
}>;
const specBase = (id: string, role: string, label: ReturnType<typeof loc>, o: SpecOverrides = {}) => ({
  id, role: role as any, label, help: o.help,
  required: o.required ?? false, editable: o.editable ?? true,
  source: o.source ?? "user" as const, businessField: o.businessField, aiEditable: o.aiEditable ?? true,
});

export const textSpec = (id: string, role: string, o: SpecOverrides & {
  minLength?: number; maxLength?: number; multiline?: boolean; label?: string;
} = {}): BlockSpec => ({
  ...specBase(id, role, loc(o.label ?? id), o), type: "text",
  constraints: { minLength: o.minLength ?? 0, maxLength: o.maxLength ?? 200, multiline: o.multiline ?? false },
} as BlockSpec);

export const richTextSpec = (id: string, role: string, o: SpecOverrides & { maxLength?: number } = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "richText",
  constraints: { maxLength: o.maxLength ?? 8000 },
} as BlockSpec);

export const listTextSpec = (id: string, role: string, o: SpecOverrides & {
  minItems?: number; maxItems?: number; maxItemLength?: number;
} = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "listText",
  constraints: { minItems: o.minItems ?? 0, maxItems: o.maxItems ?? 12, maxItemLength: o.maxItemLength ?? 200 },
} as BlockSpec);

export const imageSpec = (id: string, role: string, o: SpecOverrides & {
  aspect?: "free" | "square" | "portrait" | "landscape" | "wide"; maxBytes?: number;
} = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "image",
  constraints: { aspect: o.aspect ?? "free", maxBytes: o.maxBytes ?? 8_388_608 },
} as BlockSpec);

export const audioSpec = (id: string, role: string, o: SpecOverrides & { maxBytes?: number } = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "audio",
  constraints: { maxBytes: o.maxBytes ?? 8_388_608 },
} as BlockSpec);

export const dateSpec = (id: string, role: string, o: SpecOverrides & { formatId?: string } = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "date", formatId: o.formatId ?? "long",
} as BlockSpec);
export const timeSpec = (id: string, role: string, o: SpecOverrides & { formatId?: string } = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "time", formatId: o.formatId ?? "h12",
} as BlockSpec);
export const dateTimeRangeSpec = (id: string, role: string, o: SpecOverrides & { formatId?: string } = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "dateTimeRange", formatId: o.formatId ?? "long-h12",
} as BlockSpec);
export const linkSpec = (id: string, role: string, o: SpecOverrides = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "link",
} as BlockSpec);
export const locationSpec = (id: string, role: string, o: SpecOverrides = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "location",
} as BlockSpec);
export const choiceSpec = (id: string, role: string, options: Array<{ id: string; label?: string }>, o: SpecOverrides = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "choice",
  options: options.map(op => ({ id: op.id, label: loc(op.label ?? op.id) })),
} as BlockSpec);
export const booleanSpec = (id: string, role: string, o: SpecOverrides = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "boolean",
} as BlockSpec);
export const personSpec = (id: string, role: string, o: SpecOverrides = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "person",
} as BlockSpec);
export const groupSpec = (id: string, role: string, itemBlocks: BlockSpec[], o: SpecOverrides & {
  min?: number; max?: number; reorderable?: boolean;
} = {}): BlockSpec => ({
  ...specBase(id, role, loc(id), o), type: "group",
  min: o.min ?? 0, max: o.max ?? 12, reorderable: o.reorderable ?? true,
  itemLabel: loc(id + " item"), itemBlocks: itemBlocks as any,
} as BlockSpec);

// ---------------------------------------------------------------------------------------------
// Section / Manifest / Theme / Defaults
// ---------------------------------------------------------------------------------------------
export const sectionSpec = (key: string, type: SectionSpec["type"], blocks: BlockSpec[], o: Partial<{
  variants: string[]; defaultVariant: string; required: boolean; defaultVisible: boolean; title: string;
}> = {}): SectionSpec => ({
  key, type, title: loc(o.title ?? key),
  variants: o.variants ?? ["default"], defaultVariant: o.defaultVariant ?? "default",
  required: o.required ?? false, defaultVisible: o.defaultVisible ?? true, blocks,
});

export const themeFixture = (o: Partial<{
  palettes: ThemeSpec["palettes"]; fontSets: ThemeSpec["fontSets"]; defaultPaletteId: string; defaultFontSetId: string;
}> = {}): ThemeSpec => {
  const palettes = o.palettes ?? [{
    id: "olive", name: loc("Olivo"),
    tokens: { bg: "#FFFFFF", surface: "#F5F5F0", ink: "#222222", accent: "#556B2F", accentInk: "#FFFFFF", muted: "#999999" },
  }];
  const fontSets = o.fontSets ?? [{
    id: "clasica", name: loc("Clásica"),
    heading: { family: "Playfair Display", weights: [400, 700], source: "bundled" as const },
    body: { family: "Lora", weights: [400], source: "bundled" as const },
  }];
  return { palettes, fontSets, defaultPaletteId: o.defaultPaletteId ?? palettes[0]!.id, defaultFontSetId: o.defaultFontSetId ?? fontSets[0]!.id };
};

export const manifestFixture = (sections: SectionSpec[], o: Partial<{
  slug: string; version: string; locales: TemplateManifest["locales"]; eventKinds: TemplateManifest["eventKinds"];
}> = {}): TemplateManifest => ({
  manifestVersion: 1, slug: o.slug ?? "fixture-tpl", version: o.version ?? "1.0.0",
  name: loc("Plantilla de prueba"), eventKinds: o.eventKinds ?? ["generic"],
  minPlanTier: 1, locales: o.locales ?? ["es-MX"], capabilities: [], sections,
  assets: [], migrationsFrom: [],
});

export const defaultsFixture = (m: TemplateManifest, content: Record<string, BlockValue>): DefaultsFile => ({
  templateSlug: m.slug, templateVersion: m.version, content,
});

export const structureFrom = (m: TemplateManifest, overrides: Record<string, Partial<StructureEntry>> = {}): InvitationDocument["structure"] => ({
  sections: m.sections.map(s => ({
    key: s.key, variant: overrides[s.key]?.variant ?? s.defaultVariant,
    visible: overrides[s.key]?.visible ?? s.defaultVisible,
  })),
});

export const documentFixture = (m: TemplateManifest, theme: ThemeSpec, o: Partial<{
  content: Record<string, BlockValue>; locale: InvitationDocument["meta"]["locale"];
  paletteId: string; fontSetId: string; structure: InvitationDocument["structure"];
  attic: InvitationDocument["attic"];
}> = {}): InvitationDocument => ({
  schemaVersion: 1, template: { slug: m.slug, version: m.version },
  theme: { paletteId: o.paletteId ?? theme.defaultPaletteId, fontSetId: o.fontSetId ?? theme.defaultFontSetId },
  structure: o.structure ?? structureFrom(m),
  content: o.content ?? {},
  attic: o.attic ?? {},
  meta: { locale: o.locale ?? m.locales[0]! },
});

// ---------------------------------------------------------------------------------------------
// Valores (anotados como ScalarValue: la unión discriminada de blocks.ts).
// ---------------------------------------------------------------------------------------------
export const textValue = (value: string): ScalarValue => ({ kind: "text", value });
export const richTextValue = (paragraphs: string[]): ScalarValue => ({
  kind: "richText", doc: { type: "doc", content: paragraphs.map(t => ({ type: "paragraph" as const, content: t === "" ? [] : [{ type: "text" as const, text: t }] })) },
});
export const listTextValue = (items: string[]): ScalarValue => ({ kind: "listText", items });
export const imageValue = (id: string, o: Partial<{ alt: string; x: number; y: number }> = {}): ScalarValue => ({
  kind: "image", assetId: id, alt: o.alt ?? "", focal: { x: o.x ?? 0.5, y: o.y ?? 0.5 },
});
export const audioValue = (id: string): ScalarValue => ({ kind: "audio", assetId: id });
export const dateValue = (v: string): ScalarValue => ({ kind: "date", value: v });
export const timeValue = (v: string): ScalarValue => ({ kind: "time", value: v });
export const dateTimeRangeValue = (start: string, end?: string): ScalarValue =>
  end === undefined ? { kind: "dateTimeRange", start } : { kind: "dateTimeRange", start, end };
export const linkValue = (href: string, label?: string): ScalarValue =>
  label === undefined ? { kind: "link", href } : { kind: "link", href, label };
export const locationValue = (name: string, o: Partial<{ address: string; mapHref: string }> = {}): ScalarValue =>
  ({ kind: "location", name, ...(o.address !== undefined ? { address: o.address } : {}), ...(o.mapHref !== undefined ? { mapHref: o.mapHref } : {}) });
export const choiceValue = (optionId: string): ScalarValue => ({ kind: "choice", optionId });
export const booleanValue = (v: boolean): ScalarValue => ({ kind: "boolean", value: v });
export const personValue = (name: string, note?: string): ScalarValue =>
  note === undefined ? { kind: "person", name } : { kind: "person", name, note };
export const groupItem = (itemId: string, values: Record<string, ScalarValue>) => ({ itemId, values });
export const groupValue = (items: ReturnType<typeof groupItem>[]): GroupValue => ({ kind: "group", items });
