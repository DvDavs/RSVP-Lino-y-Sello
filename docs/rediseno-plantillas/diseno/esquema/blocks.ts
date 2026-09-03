// packages/schema/src/blocks.ts — catálogo CERRADO de tipos de bloque (valores + especificaciones).
import { z } from "zod";
import { AssetId, BlockId, HttpUrl, Ident, IsoDate, IsoLocalDateTime, IsoTime, ItemId, LocalizedText } from "./common.ts";

// ---------------------------------------------------------------------------------------------
// 1. Valores (lo que vive en doc.content[blockId] y en defaults.json). Discriminados por `kind`.
// ---------------------------------------------------------------------------------------------
export const TextValue = z.strictObject({ kind: z.literal("text"), value: z.string().max(2000) });

/** Texto enriquecido mínimo, agnóstico de marcado (inspirado en Portable Text). Marcas cerradas. */
export const RichSpan = z.strictObject({
  type: z.literal("text"),
  text: z.string().max(2000),
  marks: z.array(z.enum(["bold", "italic"])).max(2).optional(),
  href: HttpUrl.optional(),
});
export const RichParagraph = z.strictObject({ type: z.literal("paragraph"), content: z.array(RichSpan).max(50) });
export const RichDoc = z.strictObject({ type: z.literal("doc"), content: z.array(RichParagraph).max(40) });
export const RichTextValue = z.strictObject({ kind: z.literal("richText"), doc: RichDoc });

export const ListTextValue = z.strictObject({ kind: z.literal("listText"), items: z.array(z.string().max(200)).max(12) });

export const Focal = z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export const ImageValue = z.strictObject({
  kind: z.literal("image"),
  assetId: AssetId,
  alt: z.string().max(200),
  focal: Focal,
});
export const AudioValue = z.strictObject({ kind: z.literal("audio"), assetId: AssetId });
export const DateValue = z.strictObject({ kind: z.literal("date"), value: IsoDate });
export const TimeValue = z.strictObject({ kind: z.literal("time"), value: IsoTime });
/** Invariante NO exportable: end >= start (invariants.ts I-01). */
export const DateTimeRangeValue = z.strictObject({
  kind: z.literal("dateTimeRange"),
  start: IsoLocalDateTime,
  end: IsoLocalDateTime.optional(),
});
export const LinkValue = z.strictObject({ kind: z.literal("link"), href: HttpUrl, label: z.string().max(80).optional() });
export const LocationValue = z.strictObject({
  kind: z.literal("location"),
  name: z.string().min(1).max(120),
  address: z.string().max(300).optional(),
  mapHref: HttpUrl.optional(),
});
/** Invariante NO exportable: optionId ∈ spec.options (I-02). */
export const ChoiceValue = z.strictObject({ kind: z.literal("choice"), optionId: Ident });
export const BooleanValue = z.strictObject({ kind: z.literal("boolean"), value: z.boolean() });
export const PersonValue = z.strictObject({
  kind: z.literal("person"),
  name: z.string().min(1).max(120),
  note: z.string().max(200).optional(),
});

/** Todo valor que NO es grupo (los grupos no anidan: decisión de diseño, ver 01 §2.5). */
export const ScalarValue = z.discriminatedUnion("kind", [
  TextValue, RichTextValue, ListTextValue, ImageValue, AudioValue, DateValue, TimeValue,
  DateTimeRangeValue, LinkValue, LocationValue, ChoiceValue, BooleanValue, PersonValue,
]);

/** Ítem de grupo: identidad estable (ULID del servidor) + valores por id de bloque RELATIVO al grupo. */
export const GroupItem = z.strictObject({
  itemId: ItemId,
  values: z.record(BlockId, ScalarValue),
});
/** Invariantes NO exportables: itemId únicos (I-03); spec.min ≤ items.length ≤ spec.max (I-04). */
export const GroupValue = z.strictObject({ kind: z.literal("group"), items: z.array(GroupItem).max(24) });

export const BlockValue = z.discriminatedUnion("kind", [
  TextValue, RichTextValue, ListTextValue, ImageValue, AudioValue, DateValue, TimeValue,
  DateTimeRangeValue, LinkValue, LocationValue, ChoiceValue, BooleanValue, PersonValue, GroupValue,
]);

export const BlockKind = z.enum([
  "text", "richText", "listText", "image", "audio", "date", "time", "dateTimeRange",
  "link", "location", "choice", "boolean", "person", "group",
]);

// ---------------------------------------------------------------------------------------------
// 2. Roles (catálogo cerrado). El rol sustituye al emparejamiento por texto/posición (H-01, H-02)
//    y es la clave del mapeo al cambiar de plantilla (01 §6.3). Ampliar solo subiendo manifestVersion.
// ---------------------------------------------------------------------------------------------
export const BlockRole = z.enum([
  // portada
  "coverTitle", "coverSubtitle", "coverDate", "coverImage", "coverButtonLabel", "coverBackground",
  // celebrantes
  "celebrantA", "celebrantB", "honoree", "celebrantAPhoto", "celebrantBPhoto", "honoreePhoto",
  "celebrantAText", "celebrantBText", "honoreeMessage", "celebrantsHeading", "celebrantsDate",
  // familia
  "familyIntro", "parentA1", "parentA2", "parentB1", "parentB2", "godparentA", "godparentB",
  "personName", "personPhoto", "personLabel", "familyGroupTitle",
  // evento
  "eventTitle", "eventWhen", "eventDate", "eventTime", "eventPlace", "eventMapLink", "eventNote",
  // galería y redes
  "galleryPhoto", "galleryIntro", "hashtag", "hashtagLink",
  // mesa de regalos
  "giftOptionTitle", "giftOptionDetail", "giftOptionImage", "giftOptionLink", "giftOptionKind",
  // recomendaciones y amenidades
  "suggestionName", "suggestionDetail", "suggestionImage", "suggestionLink",
  "amenityName", "amenityDetail", "amenityImage", "amenityLink",
  // historia
  "storyTitle", "storyDate", "storyBody", "storyImage",
  // dress code
  "dressCodeTitle", "dressCodeDetail", "dressCodeImage",
  // rsvp
  "rsvpDeadline", "rsvpNote", "rsvpBackground",
  // pie y ambiente
  "footerNote", "footerLogo", "footerLink", "backgroundMusic", "backgroundMusicEnabled",
  // genéricos
  "sectionTitle", "sectionIntro", "sectionBackground", "decorative",
  // añadidos en la ronda 1R para cubrir el contenido real de las 9 plantillas sembradas (01 §10):
  "witness",                 // parents.* con etiqueta libre distinta de padre/madre/padrino
  "celebrantsMessage",       // texts.coupleMessage y phrases.pareja (antes sin destino)
  "coverButtonLink",         // sectionCover.button.url
  "hashtagPlatform",         // hashtags[].platform (choice: facebook | instagram | tiktok | x | otro)
  "rsvpKidsNote",            // rsvp.note, distinto de rsvp.message (→ rsvpNote)
  "rsvpChildrenAllowed",     // invitation.children_allowed (boolean de negocio)
  "rsvpYoungAllowed",        // invitation.young_allowed
  "personPhotoVisible",      // sectionFamily.items[].items[].showImage
  "eventLocationNote",       // sectionEvent.locationText (capability singlePlace, H-12)
  // ROLES DE GRUPO (I-25): un bloque `group` SOLO puede llevar uno de estos, y un bloque escalar NUNCA.
  // Antes del 1R los grupos reutilizaban el rol de uno de sus itemBlocks (p. ej. event.cards: "eventTitle"),
  // lo que hacía ambiguo el direccionamiento por rol de la IA y del mapeo al cambiar de plantilla.
  "familyGroup", "eventCards", "galleryPhotos", "storyMilestones", "giftOptions",
  "suggestionList", "amenityList", "dressCodeRules", "hashtagList", "personList",
]);

/** Roles reservados a bloques `group` (I-25). */
export const GROUP_ROLES = [
  "familyGroup", "eventCards", "galleryPhotos", "storyMilestones", "giftOptions",
  "suggestionList", "amenityList", "dressCodeRules", "hashtagList", "personList",
] as const;

/**
 * Roles SINGLETON (I-26): como mucho un bloque por manifiesto puede llevarlos, porque identifican
 * a una persona o a un dato único del evento. El resto de roles (sectionTitle, personName, …) se
 * repiten legítimamente y NO se validan por unicidad — verificado en la ronda 1R: boda-clasica@1.0.0
 * usa `sectionTitle` 8 veces de forma correcta (hallazgo 1R A-10).
 */
export const SINGLETON_ROLES = [
  "celebrantA", "celebrantB", "honoree", "celebrantAPhoto", "celebrantBPhoto", "honoreePhoto",
  "parentA1", "parentA2", "parentB1", "parentB2",
  "coverTitle", "coverSubtitle", "coverDate", "coverImage",
  "rsvpDeadline", "backgroundMusic", "hashtag",
] as const;

/** Campos de negocio que un bloque puede leer de Postgres (source = "business"). Tipo de bloque exigido → I-06. */
export const BusinessField = z.enum([
  "invitation.date",           // → date
  "invitation.time",           // → time
  "invitation.hashtag",        // → text
  "invitation.coverPhotoUrl",  // → image (resuelta por URL externa en la composición, nunca en el documento)
  "invitation.childrenAllowed",// → boolean
  "invitation.youngAllowed",   // → boolean
]);

// ---------------------------------------------------------------------------------------------
// 3. Especificaciones (lo que declara el manifiesto por bloque).
// ---------------------------------------------------------------------------------------------
const SpecBase = {
  id: BlockId,
  role: BlockRole,
  label: LocalizedText,
  help: LocalizedText.optional(),
  required: z.boolean().default(false),
  editable: z.boolean().default(true),
  /** user: lo escribe el cliente · business: lo lee la composición de Postgres · fixed: lo fija la plantilla */
  source: z.enum(["user", "business", "fixed"]).default("user"),
  businessField: BusinessField.optional(), // obligatorio si source = business (I-05)
  aiEditable: z.boolean().default(true),   // false ⇒ ninguna operación de IA puede tocarlo
};

export const TextSpec = z.strictObject({ ...SpecBase, type: z.literal("text"),
  constraints: z.strictObject({
    minLength: z.number().int().min(0).max(2000).default(0),
    maxLength: z.number().int().min(1).max(2000).default(200),
    pattern: z.string().max(200).optional(),
    multiline: z.boolean().default(false),
  }).default({ minLength: 0, maxLength: 200, multiline: false }),
});
export const RichTextSpec = z.strictObject({ ...SpecBase, type: z.literal("richText"),
  constraints: z.strictObject({ maxLength: z.number().int().min(1).max(8000).default(8000) }).default({ maxLength: 8000 }),
});
export const ListTextSpec = z.strictObject({ ...SpecBase, type: z.literal("listText"),
  constraints: z.strictObject({
    minItems: z.number().int().min(0).max(12).default(0),
    maxItems: z.number().int().min(1).max(12).default(12),
    maxItemLength: z.number().int().min(1).max(200).default(200),
  }).default({ minItems: 0, maxItems: 12, maxItemLength: 200 }),
});
export const ImageSpec = z.strictObject({ ...SpecBase, type: z.literal("image"),
  constraints: z.strictObject({
    aspect: z.enum(["free", "square", "portrait", "landscape", "wide"]).default("free"),
    maxBytes: z.number().int().min(1).max(15_728_640).default(8_388_608),
  }).default({ aspect: "free", maxBytes: 8_388_608 }),
});
export const AudioSpec = z.strictObject({ ...SpecBase, type: z.literal("audio"),
  constraints: z.strictObject({ maxBytes: z.number().int().min(1).max(8_388_608).default(8_388_608) }).default({ maxBytes: 8_388_608 }),
});
/** formatId: patrón declarado en la plantilla, resuelto por formatDate(value, formatId, locale) (H-27). */
export const DateSpec = z.strictObject({ ...SpecBase, type: z.literal("date"), formatId: Ident.default("long") });
export const TimeSpec = z.strictObject({ ...SpecBase, type: z.literal("time"), formatId: Ident.default("h12") });
export const DateTimeRangeSpec = z.strictObject({ ...SpecBase, type: z.literal("dateTimeRange"), formatId: Ident.default("long-h12") });
export const LinkSpec = z.strictObject({ ...SpecBase, type: z.literal("link") });
export const LocationSpec = z.strictObject({ ...SpecBase, type: z.literal("location") });
export const ChoiceSpec = z.strictObject({ ...SpecBase, type: z.literal("choice"),
  options: z.array(z.strictObject({ id: Ident, label: LocalizedText })).min(1).max(20),
});
export const BooleanSpec = z.strictObject({ ...SpecBase, type: z.literal("boolean") });
export const PersonSpec = z.strictObject({ ...SpecBase, type: z.literal("person") });

export const ScalarSpec = z.discriminatedUnion("type", [
  TextSpec, RichTextSpec, ListTextSpec, ImageSpec, AudioSpec, DateSpec, TimeSpec, DateTimeRangeSpec,
  LinkSpec, LocationSpec, ChoiceSpec, BooleanSpec, PersonSpec,
]);

/** Grupo repetible. Sus itemBlocks son escalares (no anidan). min ≤ max (I-07). */
export const GroupSpec = z.strictObject({ ...SpecBase, type: z.literal("group"),
  min: z.number().int().min(0).max(24).default(0),
  max: z.number().int().min(1).max(24).default(12),
  reorderable: z.boolean().default(true),
  itemLabel: LocalizedText,
  itemBlocks: z.array(ScalarSpec).min(1).max(12),
});

export const BlockSpec = z.discriminatedUnion("type", [
  TextSpec, RichTextSpec, ListTextSpec, ImageSpec, AudioSpec, DateSpec, TimeSpec, DateTimeRangeSpec,
  LinkSpec, LocationSpec, ChoiceSpec, BooleanSpec, PersonSpec, GroupSpec,
]);

export type BlockValue = z.infer<typeof BlockValue>;
export type ScalarValue = z.infer<typeof ScalarValue>;
export type GroupValue = z.infer<typeof GroupValue>;
export type BlockSpec = z.infer<typeof BlockSpec>;
export type GroupSpec = z.infer<typeof GroupSpec>;
export type BlockRole = z.infer<typeof BlockRole>;
