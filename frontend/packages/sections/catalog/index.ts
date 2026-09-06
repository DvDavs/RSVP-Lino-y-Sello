// packages/sections/catalog/index.ts — CATÁLOGO de metadatos de las 12 secciones (fase 4, kit de autor).
//
// POR QUÉ NO ESTÁ EN `src/`: `test/lint-guards.test.ts` (04 §19.3) prohíbe todo import de VALOR de
// `@invitaciones/schema` dentro de `src/**`, y no por higiene: está MEDIDO que un solo import de
// valor mete 87,8 KB gz de Zod en la primera carga del render público y revienta el presupuesto de
// 150 KB (`contratos.md §12.2`, hoy en 144,2 KB). Este módulo SÍ necesita el esquema como valor
// (`describeRole`, `SINGLETON_ROLES`), pero solo lo carga el CLI del kit desde Node, jamás
// `apps/web`. Vive fuera de `src/` para que ningún empaquetador del sitio lo alcance y para no
// tocar esa guarda. Por el mismo motivo NO se re-exporta desde `src/index.ts`: el punto de entrada
// del kit es `@invitaciones/sections/catalog` (package.json → exports).
//
// Responde, sin leer código, a: «voy a declarar una sección de tipo X: ¿qué variantes admite, qué
// bloques espera, cuáles son obligatorios y qué `role` va en cada hueco?». Es el vocabulario que
// faltó en la medición de I-08 (`evidencia/fase-3/i08-plantilla-minima/README.md`: 4 intentos, los
// tres fallos de vocabulario cerrado).
//
// REGLAS DE ESTE MÓDULO (no romperlas o el CLI del kit deja de poder importarlo):
//  - Solo metadatos: nombres, variantes, roles, huecos. NUNCA color, CSS ni tokens (P3).
//  - Cero imports de React, de `.tsx` y de `.module.css`: se importa desde Node puro por el punto de
//    entrada `@invitaciones/sections/catalog` (`test/catalog.node.test.ts` lo comprueba lanzando un
//    proceso `node` de verdad). Solo depende de `../src/registry-data.ts` (la frontera sin JSX del
//    paquete) y de `@invitaciones/schema`.
//  - Todo el texto de un rol (para qué sirve) sale de `describeRole()` del esquema: aquí NO se
//    transcribe ninguna descripción, para que no puedan divergir.
//  - Serializable a JSON.
import { SINGLETON_ROLES, describeRole } from "@invitaciones/schema";
import type { BlockRole, SectionType } from "@invitaciones/schema";
import { SECTION_REGISTRY_DATA, VARIANT_LABELS_ES_MX } from "../src/registry-data.ts";

/** Los 14 tipos de bloque del catálogo cerrado (`BlockKind` de `@invitaciones/schema`). */
export type CatalogBlockType =
  | "text" | "richText" | "listText" | "image" | "audio" | "date" | "time" | "dateTimeRange"
  | "link" | "location" | "choice" | "boolean" | "person" | "group";

/** Cuántas secciones de este tipo tiene sentido declarar en un manifiesto (01 §3.1, columna "Card."). */
export type SectionCardinality = "1" | "0..n" | "1..n";

/** Un hueco: qué bloque va aquí, con qué rol y si el andamio lo escribe por omisión. */
export interface CatalogSlot {
  /** Sufijo del `blockId`, RELATIVO a la sección: el id final es `<sectionKey>.<blockId>`
   *  (o, dentro de un grupo, este mismo sufijo suelto: los `itemBlocks` llevan ids cortos, 01 §3.2). */
  readonly blockId: string;
  readonly type: CatalogBlockType;
  readonly role: BlockRole;
  /** Se copia tal cual en `BlockSpec.required`: el cliente no puede dejarlo vacío. */
  readonly required: boolean;
  /** true si `nueva-plantilla` lo escribe por omisión; false si es un hueco disponible pero opcional. */
  readonly scaffold: boolean;
  /** Derivado de `SINGLETON_ROLES` (I-26, ADR-1R-D-04): como mucho un bloque por manifiesto. */
  readonly singletonRole: boolean;
  /** Para qué es, en una frase. Viene de `describeRole(role).description`, nunca se escribe aquí. */
  readonly purpose: string;
  /** Solo en `type: "group"`: los bloques escalares de cada ficha (no anidan, 01 §2.5). */
  readonly itemBlocks?: readonly CatalogSlot[];
  /** Solo en `type: "group"`: tamaños sugeridos para `min`/`max`. */
  readonly min?: number;
  readonly max?: number;
  /** Solo en `type: "group"`: etiqueta es-MX sugerida para `itemLabel`. */
  readonly itemLabel?: string;
  /** Sugerido cuando el dato NO lo escribe el cliente (I-05/I-06); ausente = `"user"`. */
  readonly source?: "business" | "fixed";
  readonly businessField?: string;
}

export interface CatalogVariant {
  readonly id: string;
  /** Etiqueta es-MX (fuente única: `VARIANT_LABELS_ES_MX` de `registry-data.ts`). */
  readonly label: string;
}

export interface CatalogSection {
  readonly type: SectionType;
  /** Nombre legible en es-MX. */
  readonly name: string;
  /** Para qué sirve la sección, en una frase. */
  readonly purpose: string;
  readonly cardinality: SectionCardinality;
  readonly variants: readonly CatalogVariant[];
  readonly defaultVariant: string;
  readonly slots: readonly CatalogSlot[];
}

// ---------------------------------------------------------------------------------------------
// Declaración. `variants`/`defaultVariant` se declaran aquí y `test/catalog.contract.test.ts` los
// compara contra `SECTION_REGISTRY_DATA` (lo que los componentes saben pintar de verdad): si el
// registro gana o pierde una variante y este catálogo no, la prueba se pone en rojo.
// ---------------------------------------------------------------------------------------------
type SlotSeed = Omit<CatalogSlot, "singletonRole" | "purpose" | "itemBlocks"> & {
  readonly itemBlocks?: readonly SlotSeed[];
};
interface SectionSeed {
  readonly name: string;
  readonly purpose: string;
  readonly cardinality: SectionCardinality;
  readonly variants: readonly string[];
  readonly defaultVariant: string;
  readonly slots: readonly SlotSeed[];
}

/** Huecos genéricos: los cuatro roles admisibles en CUALQUIER tipo de sección (01 §3.1). */
const GENERIC_SLOTS: readonly SlotSeed[] = [
  { blockId: "heading", type: "text", role: "sectionTitle", required: false, scaffold: false },
  { blockId: "lead", type: "richText", role: "sectionIntro", required: false, scaffold: false },
  { blockId: "backdrop", type: "image", role: "sectionBackground", required: false, scaffold: false },
  { blockId: "ornament", type: "image", role: "decorative", required: false, scaffold: false },
];
/** El hueco de título, ya en el andamio: las secciones de lista sin título no se leen. Va DELANTE
 *  de los huecos propios para que el manifiesto generado empiece por el título. */
const TITLE_SLOT: SlotSeed = { blockId: "heading", type: "text", role: "sectionTitle", required: false, scaffold: true };
/** Los otros tres genéricos, que van al final de la sección. */
const GENERIC_TAIL: readonly SlotSeed[] = GENERIC_SLOTS.filter(s => s.role !== "sectionTitle");

const SEEDS: Readonly<Record<SectionType, SectionSeed>> = {
  cover: {
    name: "Portada",
    purpose: "La primera pantalla: quién celebra, cuándo y la fotografía principal.",
    cardinality: "1",
    variants: ["full", "framed", "split"],
    defaultVariant: "full",
    slots: [
      { blockId: "title", type: "text", role: "coverTitle", required: true, scaffold: true },
      { blockId: "subtitle", type: "text", role: "coverSubtitle", required: false, scaffold: false },
      { blockId: "date", type: "date", role: "coverDate", required: false, scaffold: true },
      { blockId: "image", type: "image", role: "coverImage", required: true, scaffold: true },
      { blockId: "background", type: "image", role: "coverBackground", required: false, scaffold: false },
      { blockId: "buttonLabel", type: "text", role: "coverButtonLabel", required: false, scaffold: false },
      { blockId: "buttonLink", type: "link", role: "coverButtonLink", required: false, scaffold: false },
      ...GENERIC_SLOTS,
    ],
  },
  celebrant: {
    name: "Celebrantes",
    purpose: "Quién celebra: una persona homenajeada o una pareja, con su foto y su mensaje.",
    cardinality: "1",
    variants: ["side-by-side", "stacked", "centered"],
    defaultVariant: "side-by-side",
    slots: [
      { blockId: "title", type: "text", role: "celebrantsHeading", required: false, scaffold: true },
      { blockId: "date", type: "date", role: "celebrantsDate", required: false, scaffold: false },
      { blockId: "message", type: "richText", role: "celebrantsMessage", required: false, scaffold: false },
      { blockId: "personA", type: "person", role: "celebrantA", required: false, scaffold: false },
      { blockId: "personB", type: "person", role: "celebrantB", required: false, scaffold: false },
      { blockId: "honoree", type: "person", role: "honoree", required: true, scaffold: true },
      { blockId: "photoA", type: "image", role: "celebrantAPhoto", required: false, scaffold: false },
      { blockId: "photoB", type: "image", role: "celebrantBPhoto", required: false, scaffold: false },
      { blockId: "honoreePhoto", type: "image", role: "honoreePhoto", required: false, scaffold: false },
      { blockId: "textA", type: "richText", role: "celebrantAText", required: false, scaffold: false },
      { blockId: "textB", type: "richText", role: "celebrantBText", required: false, scaffold: false },
      { blockId: "honoreeMessage", type: "richText", role: "honoreeMessage", required: false, scaffold: false },
      ...GENERIC_SLOTS,
    ],
  },
  event: {
    name: "Evento",
    purpose: "Cuándo y dónde: uno o varios momentos con su hora, su lugar y su mapa.",
    cardinality: "1..n",
    variants: ["timeline", "cards", "single-place"],
    defaultVariant: "timeline",
    slots: [
      TITLE_SLOT,
      { blockId: "locationNote", type: "text", role: "eventLocationNote", required: false, scaffold: false },
      { blockId: "place", type: "location", role: "eventPlace", required: false, scaffold: false },
      {
        blockId: "cards", type: "group", role: "eventCards", required: true, scaffold: true,
        min: 1, max: 6, itemLabel: "Momento",
        itemBlocks: [
          { blockId: "title", type: "text", role: "eventTitle", required: true, scaffold: true },
          { blockId: "when", type: "dateTimeRange", role: "eventWhen", required: false, scaffold: true },
          { blockId: "date", type: "date", role: "eventDate", required: false, scaffold: false },
          { blockId: "time", type: "time", role: "eventTime", required: false, scaffold: false },
          { blockId: "place", type: "location", role: "eventPlace", required: false, scaffold: true },
          { blockId: "mapLink", type: "link", role: "eventMapLink", required: false, scaffold: false },
          { blockId: "note", type: "text", role: "eventNote", required: false, scaffold: false },
        ],
      },
      ...GENERIC_TAIL,
    ],
  },
  gallery: {
    name: "Galería",
    purpose: "Las fotografías del evento y las etiquetas de redes sociales.",
    cardinality: "0..n",
    variants: ["grid-6", "grid-9", "carousel", "masonry"],
    defaultVariant: "grid-6",
    slots: [
      TITLE_SLOT,
      { blockId: "intro", type: "richText", role: "galleryIntro", required: false, scaffold: false },
      {
        blockId: "photos", type: "group", role: "galleryPhotos", required: true, scaffold: true,
        min: 1, max: 12, itemLabel: "Fotografía",
        itemBlocks: [{ blockId: "photo", type: "image", role: "galleryPhoto", required: true, scaffold: true }],
      },
      { blockId: "hashtag", type: "text", role: "hashtag", required: false, scaffold: false },
      {
        blockId: "hashtags", type: "group", role: "hashtagList", required: false, scaffold: false,
        min: 0, max: 4, itemLabel: "Etiqueta",
        itemBlocks: [
          { blockId: "tag", type: "text", role: "hashtag", required: true, scaffold: true },
          { blockId: "link", type: "link", role: "hashtagLink", required: false, scaffold: false },
          { blockId: "platform", type: "choice", role: "hashtagPlatform", required: false, scaffold: false },
        ],
      },
      ...GENERIC_TAIL,
    ],
  },
  giftTable: {
    name: "Mesa de regalos",
    purpose: "Las opciones de regalo: sobre, tienda o transferencia, con su enlace.",
    cardinality: "0..n",
    variants: ["cards", "list"],
    defaultVariant: "cards",
    slots: [
      TITLE_SLOT,
      {
        blockId: "options", type: "group", role: "giftOptions", required: true, scaffold: true,
        min: 1, max: 6, itemLabel: "Opción de regalo",
        itemBlocks: [
          { blockId: "kind", type: "choice", role: "giftOptionKind", required: false, scaffold: false },
          { blockId: "title", type: "text", role: "giftOptionTitle", required: true, scaffold: true },
          { blockId: "detail", type: "listText", role: "giftOptionDetail", required: false, scaffold: true },
          { blockId: "image", type: "image", role: "giftOptionImage", required: false, scaffold: false },
          { blockId: "link", type: "link", role: "giftOptionLink", required: false, scaffold: false },
        ],
      },
      ...GENERIC_TAIL,
    ],
  },
  suggestions: {
    name: "Recomendaciones",
    purpose: "Hoteles, restaurantes y sitios que los invitados deberían conocer.",
    cardinality: "0..n",
    variants: ["cards", "list"],
    defaultVariant: "cards",
    slots: [
      TITLE_SLOT,
      {
        blockId: "list", type: "group", role: "suggestionList", required: true, scaffold: true,
        min: 1, max: 8, itemLabel: "Recomendación",
        itemBlocks: [
          { blockId: "name", type: "text", role: "suggestionName", required: true, scaffold: true },
          { blockId: "detail", type: "listText", role: "suggestionDetail", required: false, scaffold: true },
          { blockId: "image", type: "image", role: "suggestionImage", required: false, scaffold: false },
          { blockId: "link", type: "link", role: "suggestionLink", required: false, scaffold: false },
        ],
      },
      ...GENERIC_TAIL,
    ],
  },
  amenities: {
    name: "Amenidades",
    purpose: "Lo que ofrece el lugar: estacionamiento, alberca, área de niños.",
    cardinality: "0..n",
    variants: ["cards", "list"],
    defaultVariant: "cards",
    slots: [
      TITLE_SLOT,
      {
        blockId: "list", type: "group", role: "amenityList", required: true, scaffold: true,
        min: 1, max: 8, itemLabel: "Amenidad",
        itemBlocks: [
          { blockId: "name", type: "text", role: "amenityName", required: true, scaffold: true },
          { blockId: "detail", type: "listText", role: "amenityDetail", required: false, scaffold: true },
          { blockId: "image", type: "image", role: "amenityImage", required: false, scaffold: false },
          { blockId: "link", type: "link", role: "amenityLink", required: false, scaffold: false },
        ],
      },
      ...GENERIC_TAIL,
    ],
  },
  rsvp: {
    name: "Confirmación",
    purpose: "La llamada a confirmar asistencia: mensaje, fecha límite y reglas para menores.",
    cardinality: "1",
    variants: ["banner", "form-inline"],
    defaultVariant: "banner",
    slots: [
      TITLE_SLOT,
      { blockId: "note", type: "text", role: "rsvpNote", required: false, scaffold: true },
      { blockId: "kidsNote", type: "text", role: "rsvpKidsNote", required: false, scaffold: false },
      { blockId: "deadline", type: "date", role: "rsvpDeadline", required: false, scaffold: false },
      {
        blockId: "childrenAllowed", type: "boolean", role: "rsvpChildrenAllowed", required: false,
        scaffold: false, source: "business", businessField: "invitation.childrenAllowed",
      },
      {
        blockId: "youngAllowed", type: "boolean", role: "rsvpYoungAllowed", required: false,
        scaffold: false, source: "business", businessField: "invitation.youngAllowed",
      },
      { blockId: "background", type: "image", role: "rsvpBackground", required: false, scaffold: false },
      ...GENERIC_TAIL,
    ],
  },
  family: {
    name: "Familia y padrinos",
    purpose: "Quién acompaña: padres, padrinos y testigos, por rol explícito.",
    cardinality: "0..n",
    variants: ["cards", "list"],
    defaultVariant: "cards",
    slots: [
      TITLE_SLOT,
      { blockId: "intro", type: "listText", role: "familyIntro", required: false, scaffold: false },
      { blockId: "groupTitle", type: "text", role: "familyGroupTitle", required: false, scaffold: false },
      { blockId: "parentA1", type: "person", role: "parentA1", required: false, scaffold: false },
      { blockId: "parentA2", type: "person", role: "parentA2", required: false, scaffold: false },
      { blockId: "parentB1", type: "person", role: "parentB1", required: false, scaffold: false },
      { blockId: "parentB2", type: "person", role: "parentB2", required: false, scaffold: false },
      { blockId: "godparentA", type: "person", role: "godparentA", required: false, scaffold: false },
      { blockId: "godparentB", type: "person", role: "godparentB", required: false, scaffold: false },
      { blockId: "witness", type: "person", role: "witness", required: false, scaffold: false },
      {
        blockId: "members", type: "group", role: "familyGroup", required: true, scaffold: true,
        min: 1, max: 12, itemLabel: "Persona",
        itemBlocks: [
          { blockId: "name", type: "person", role: "personName", required: true, scaffold: true },
          { blockId: "label", type: "text", role: "personLabel", required: false, scaffold: true },
          { blockId: "photo", type: "image", role: "personPhoto", required: false, scaffold: false },
          { blockId: "photoVisible", type: "boolean", role: "personPhotoVisible", required: false, scaffold: false },
        ],
      },
      {
        blockId: "others", type: "group", role: "personList", required: false, scaffold: false,
        min: 0, max: 12, itemLabel: "Persona",
        itemBlocks: [
          { blockId: "name", type: "person", role: "personName", required: true, scaffold: true },
          { blockId: "label", type: "text", role: "personLabel", required: false, scaffold: true },
          { blockId: "photo", type: "image", role: "personPhoto", required: false, scaffold: false },
          { blockId: "photoVisible", type: "boolean", role: "personPhotoVisible", required: false, scaffold: false },
        ],
      },
      ...GENERIC_TAIL,
    ],
  },
  story: {
    name: "Nuestra historia",
    purpose: "Los hitos de la historia, en orden, con fecha e imagen.",
    cardinality: "0..n",
    variants: ["line", "alternating"],
    defaultVariant: "line",
    slots: [
      TITLE_SLOT,
      {
        blockId: "milestones", type: "group", role: "storyMilestones", required: true, scaffold: true,
        min: 1, max: 8, itemLabel: "Hito",
        itemBlocks: [
          { blockId: "title", type: "text", role: "storyTitle", required: true, scaffold: true },
          { blockId: "date", type: "date", role: "storyDate", required: false, scaffold: true },
          { blockId: "body", type: "richText", role: "storyBody", required: false, scaffold: true },
          { blockId: "image", type: "image", role: "storyImage", required: false, scaffold: false },
        ],
      },
      ...GENERIC_TAIL,
    ],
  },
  dressCode: {
    name: "Código de vestimenta",
    purpose: "Cómo vestir, regla por regla y con su explicación.",
    cardinality: "0..n",
    variants: ["two-columns", "cards"],
    defaultVariant: "two-columns",
    slots: [
      TITLE_SLOT,
      {
        blockId: "rules", type: "group", role: "dressCodeRules", required: true, scaffold: true,
        min: 1, max: 4, itemLabel: "Regla",
        itemBlocks: [
          { blockId: "title", type: "text", role: "dressCodeTitle", required: true, scaffold: true },
          { blockId: "detail", type: "text", role: "dressCodeDetail", required: false, scaffold: true },
          { blockId: "image", type: "image", role: "dressCodeImage", required: false, scaffold: false },
        ],
      },
      ...GENERIC_TAIL,
    ],
  },
  footer: {
    name: "Pie",
    purpose: "El cierre de la invitación: nota final, firma, enlace y música de fondo.",
    cardinality: "1",
    variants: ["simple"],
    defaultVariant: "simple",
    slots: [
      { blockId: "note", type: "text", role: "footerNote", required: false, scaffold: true },
      { blockId: "logo", type: "image", role: "footerLogo", required: false, scaffold: false },
      { blockId: "link", type: "link", role: "footerLink", required: false, scaffold: false },
      { blockId: "music", type: "audio", role: "backgroundMusic", required: false, scaffold: false },
      { blockId: "musicEnabled", type: "boolean", role: "backgroundMusicEnabled", required: false, scaffold: false },
      ...GENERIC_SLOTS,
    ],
  },
};

const SINGLETON: ReadonlySet<string> = new Set<string>(SINGLETON_ROLES);

function hydrate(seed: SlotSeed): CatalogSlot {
  const info = describeRole(seed.role);
  if (!info) throw new Error(`catalog.ts: el rol "${seed.role}" no está en el catálogo cerrado del esquema`);
  const { itemBlocks, ...resto } = seed;
  const base = { ...resto, singletonRole: SINGLETON.has(seed.role), purpose: info.description };
  return itemBlocks ? { ...base, itemBlocks: itemBlocks.map(hydrate) } : base;
}

function build(): Readonly<Record<SectionType, CatalogSection>> {
  const out: Partial<Record<SectionType, CatalogSection>> = {};
  for (const [type, seed] of Object.entries(SEEDS) as Array<[SectionType, SectionSeed]>) {
    out[type] = {
      type,
      name: seed.name,
      purpose: seed.purpose,
      cardinality: seed.cardinality,
      defaultVariant: seed.defaultVariant,
      variants: seed.variants.map(id => {
        const label = VARIANT_LABELS_ES_MX[id];
        if (label === undefined) throw new Error(`catalog.ts: falta la etiqueta es-MX de la variante "${id}"`);
        return { id, label };
      }),
      slots: seed.slots.map(hydrate),
    };
  }
  return out as Record<SectionType, CatalogSection>;
}

/** Catálogo completo de las 12 secciones. Solo lectura y serializable a JSON. */
export const sectionCatalog: Readonly<Record<SectionType, CatalogSection>> = build();

/** Los 12 tipos de sección, en el orden del catálogo. */
export const CATALOG_SECTION_TYPES: readonly SectionType[] = Object.keys(sectionCatalog) as SectionType[];

/** Ficha de un tipo de sección, o `undefined` si no está en el catálogo cerrado. */
export function describeSection(type: string): CatalogSection | undefined {
  return (sectionCatalog as Readonly<Record<string, CatalogSection | undefined>>)[type];
}

/** Los huecos que el andamio `nueva-plantilla` escribe por omisión (siempre al menos uno). */
export function scaffoldSlots(type: SectionType): readonly CatalogSlot[] {
  return sectionCatalog[type].slots.filter(s => s.scaffold);
}

/** Id completo del bloque de nivel de sección: `<sectionKey>.<slot.blockId>` (01 §3.2). */
export function blockIdFor(sectionKey: string, slot: CatalogSlot): string {
  return `${sectionKey}.${slot.blockId}`;
}

/** El hueco de un rol dentro de un tipo de sección, buscando también dentro de los grupos. */
export function slotForRole(type: SectionType, role: string): CatalogSlot | undefined {
  for (const slot of sectionCatalog[type].slots) {
    if (slot.role === role) return slot;
    for (const item of slot.itemBlocks ?? []) if (item.role === role) return item;
  }
  return undefined;
}
