// packages/schema/src/introspect.ts — INTROSPECCIÓN de solo lectura del vocabulario cerrado.
//
// Por qué existe (handoffs/3-para-fase-4.md §2, evidencia/fase-3/i08-plantilla-minima/README.md):
// escribir a mano una plantilla mínima de 5 secciones costó 4 intentos, y los tres fallos fueron de
// vocabulario, no de volumen: (1) `role` es una enumeración cerrada de 90 valores que no se puede
// adivinar; (2) el `oneOf` de 14 ramas de `BlockSpec` responde «0 are valid» sin decir qué rama
// pretendías; (3) el manifiesto exige campos que solo aparecen leyendo `blocks.ts`.
//
// Reglas de este módulo:
//  - NO declara ni modifica ningún esquema: LEE los que ya existen (`blocks.ts`). Cero `.refine()`.
//  - Todo lo estructural (campos, obligatoriedad, valores de enum, defaults, restricciones) se
//    DERIVA del árbol Zod; si `blocks.ts` cambia, esto cambia solo.
//  - El único dato transcrito es el TEXTO humano (`ROLE_TEXT`, `BLOCK_TYPE_TEXT`) y los ejemplos
//    mínimos. Ambos llevan prueba de cobertura exacta contra el catálogo y, los ejemplos, prueba de
//    `parse` real contra el esquema (`test/introspect.contract.test.ts`).
import {
  BlockKind, BlockRole, BlockSpec, BlockValue, GROUP_ROLES, SINGLETON_ROLES,
} from "./blocks.ts";
import { SectionType } from "./manifest.ts";

// ---------------------------------------------------------------------------------------------
// 0. Acceso de solo lectura al árbol Zod 4.
//    `._zod.def` es la representación interna estable de Zod 4.5 (verificado con zod@4.5.4:
//    `def.type` ∈ {object, string, number, boolean, enum, literal, array, record, union, optional,
//    default, …}). Se aísla aquí, en un único punto, para que una subida de Zod se arregle en un
//    solo sitio en vez de en toda la superficie pública.
// ---------------------------------------------------------------------------------------------
interface ZodNode { readonly _zod: { readonly def: ZodDef } }
interface ZodDef {
  readonly type: string;
  readonly shape?: Readonly<Record<string, unknown>>;
  readonly innerType?: unknown;
  readonly defaultValue?: unknown;
  readonly entries?: Readonly<Record<string, string>>;
  readonly values?: readonly unknown[];
  readonly element?: unknown;
  readonly options?: readonly unknown[];
  readonly checks?: readonly unknown[];
  readonly discriminator?: string;
}
function zdef(schema: unknown): ZodDef {
  return (schema as ZodNode)._zod.def;
}

/** Restricciones expresables en JSON Schema que un campo declara (longitudes, rangos, patrón). */
export interface ShapeConstraints {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly pattern?: string;
  readonly format?: string;
}

/** Descripción estructural de UN campo, derivada del árbol Zod. Serializable a JSON. */
export interface ShapeField {
  readonly name: string;
  /** "string" | "number" | "boolean" | "enum" | "literal" | "object" | "array" | "record" | "union" | otro `def.type`. */
  readonly type: string;
  /** true si hay que escribirlo: ni `.optional()` ni `.default()`. */
  readonly required: boolean;
  /** true si el esquema lo rellena solo cuando falta (`.default()`). */
  readonly hasDefault: boolean;
  readonly defaultValue?: unknown;
  readonly enumValues?: readonly string[];
  readonly literal?: string | number | boolean | null;
  readonly constraints?: ShapeConstraints;
  /** Campos hijos si `type === "object"`. */
  readonly fields?: readonly ShapeField[];
  /** Forma del elemento si `type === "array"`. */
  readonly element?: ShapeField;
  /** Valores del discriminante si `type === "union"` (no se expande la rama: cortaría la lectura). */
  readonly unionOf?: readonly string[];
}

function readChecks(def: ZodDef): ShapeConstraints | undefined {
  const out: Record<string, number | string> = {};
  for (const raw of def.checks ?? []) {
    const c = zdef(raw) as unknown as Record<string, unknown>;
    switch (c["check"]) {
      case "min_length": out["minLength"] = c["minimum"] as number; break;
      case "max_length": out["maxLength"] = c["maximum"] as number; break;
      case "greater_than": out["minimum"] = c["value"] as number; break;
      case "less_than": out["maximum"] = c["value"] as number; break;
      case "number_format": out["format"] = String(c["format"]); break;
      case "string_format": {
        out["format"] = String(c["format"]);
        if (c["pattern"] instanceof RegExp) out["pattern"] = (c["pattern"] as RegExp).source;
        break;
      }
      default: break;
    }
  }
  return Object.keys(out).length > 0 ? (out as ShapeConstraints) : undefined;
}

/** Discriminante de una unión, para poder nombrar sus ramas sin expandirlas. */
function unionBranchNames(def: ZodDef): readonly string[] {
  const key = def.discriminator ?? "type";
  const names: string[] = [];
  for (const opt of def.options ?? []) {
    const shape = zdef(opt).shape;
    const field = shape?.[key];
    const values = field ? zdef(field).values : undefined;
    names.push(values && values.length > 0 ? String(values[0]) : "?");
  }
  return names;
}

/**
 * Describe un nodo Zod como `ShapeField`. Desenvuelve `optional`/`default`/`nullable` antes de mirar
 * el tipo, que es exactamente la distinción que faltaba en el intento 2 de I-08: `min` y `max` de un
 * grupo NO son obligatorios (tienen default) pero `itemLabel` e `itemBlocks` SÍ.
 */
export function describeField(name: string, schema: unknown): ShapeField {
  let node = schema;
  let required = true;
  let hasDefault = false;
  let defaultValue: unknown;
  for (;;) {
    const d = zdef(node);
    if (d.type === "optional" || d.type === "nullable") { required = false; node = d.innerType; continue; }
    if (d.type === "default" || d.type === "prefault") {
      required = false; hasDefault = true; defaultValue = d.defaultValue; node = d.innerType; continue;
    }
    break;
  }
  const def = zdef(node);
  const base = { name, type: def.type, required, hasDefault } as ShapeField;
  const extra: Record<string, unknown> = {};
  if (hasDefault) extra["defaultValue"] = defaultValue;
  const constraints = readChecks(def);
  if (constraints) extra["constraints"] = constraints;
  switch (def.type) {
    case "enum": extra["enumValues"] = Object.keys(def.entries ?? {}); break;
    case "literal": extra["literal"] = (def.values?.[0] ?? null) as string | number | boolean | null; break;
    case "object": extra["fields"] = describeShape(def.shape ?? {}); break;
    case "array": extra["element"] = describeField("[]", def.element); break;
    case "union": extra["unionOf"] = unionBranchNames(def); break;
    default: break;
  }
  return { ...base, ...extra };
}

function describeShape(shape: Readonly<Record<string, unknown>>): readonly ShapeField[] {
  return Object.entries(shape).map(([name, child]) => describeField(name, child));
}

// ---------------------------------------------------------------------------------------------
// 1. Ramas del `oneOf` de BlockSpec y de BlockValue, indexadas por tipo de bloque.
// ---------------------------------------------------------------------------------------------
export type BlockKindName = (typeof BlockKind)["options"][number];

/** Una rama del `oneOf`: qué hay que escribir, qué se puede omitir y qué rellena el esquema. */
export interface BranchShape {
  /** Campos sin `.optional()` ni `.default()`: si falta uno, el `parse` falla. */
  readonly required: readonly string[];
  /** Campos con `.default()`: se pueden omitir y el esquema los rellena. */
  readonly withDefault: readonly string[];
  /** Campos `.optional()`: se pueden omitir y quedan ausentes. */
  readonly optional: readonly string[];
  /** Toda propiedad admitida por la rama, en el orden en que la declara el esquema. */
  readonly all: readonly string[];
  readonly fields: readonly ShapeField[];
}

function branchOf(union: unknown, discriminatorValue: string): BranchShape {
  const def = zdef(union);
  for (const opt of def.options ?? []) {
    const shape = zdef(opt).shape ?? {};
    const key = def.discriminator ?? "type";
    const marker = shape[key];
    if (marker && String(zdef(marker).values?.[0]) === discriminatorValue) {
      const fields = describeShape(shape);
      return {
        required: fields.filter(f => f.required).map(f => f.name),
        withDefault: fields.filter(f => f.hasDefault).map(f => f.name),
        optional: fields.filter(f => !f.required && !f.hasDefault).map(f => f.name),
        all: fields.map(f => f.name),
        fields,
      };
    }
  }
  throw new Error(`introspect: la unión no tiene una rama "${discriminatorValue}"`);
}

// ---------------------------------------------------------------------------------------------
// 2. Texto humano. ÚNICO dato transcrito de este módulo; su cobertura exacta contra el catálogo
//    cerrado la comprueba `test/introspect.contract.test.ts` (falla al añadir un tipo o un rol sin
//    texto, y también al dejar texto de un valor que ya no existe).
// ---------------------------------------------------------------------------------------------
export const BLOCK_TYPE_TEXT: Readonly<Record<BlockKindName, string>> = {
  text: "Una línea o un párrafo de texto plano, con longitud mínima y máxima por plantilla.",
  richText: "Texto con párrafos y marcas cerradas (negrita, cursiva, enlace); nunca HTML libre.",
  listText: "Lista corta de cadenas sueltas, por ejemplo una lista de notas o de recomendaciones.",
  image: "Una imagen del cliente, referida por `assetId` opaco, con texto alternativo y punto focal.",
  audio: "Un archivo de audio del cliente, referido por `assetId` opaco (música de fondo).",
  date: "Una fecha local sin hora ni zona, con un `formatId` que decide cómo se imprime.",
  time: "Una hora local de 24 horas, con un `formatId` que decide cómo se imprime.",
  dateTimeRange: "Un intervalo de fecha y hora locales (inicio y fin opcional), para un momento del evento.",
  link: "Un enlace http(s) absoluto con etiqueta opcional.",
  location: "Un lugar con nombre, dirección opcional y enlace opcional al mapa.",
  choice: "Una opción de una lista cerrada que declara la propia plantilla en `options`.",
  boolean: "Un sí o un no: una casilla que la plantilla enseña o esconde.",
  person: "El nombre de una persona con una nota opcional (parentesco, papel en el evento).",
  group: "Una lista repetible de fichas; sus `itemBlocks` son bloques escalares y no anidan.",
};

/** Ámbito de un rol: los roles de grupo solo valen en bloques `group` y viceversa (I-25). */
export type RoleScope = "group" | "scalar";

/** Ficha completa de un rol del catálogo cerrado. Serializable a JSON. */
export interface RoleInfo {
  readonly role: string;
  /** Para qué sirve, en una frase (es-MX). */
  readonly description: string;
  readonly scope: RoleScope;
  /** true si como mucho un bloque del manifiesto puede llevarlo (I-26, ADR-1R-D-04). */
  readonly singleton: boolean;
  /** Tipos de bloque con los que el rol tiene sentido; el primero es el habitual. */
  readonly blockTypes: readonly BlockKindName[];
  /** Tipos de sección donde el rol es admisible (01 §3.1, columna "Bloques admitidos"). */
  readonly sectionTypes: readonly string[];
}

type RoleText = { d: string; t: readonly BlockKindName[]; s: readonly string[] };

const ALL_SECTION_TYPES = SectionType.options;
const GALLERY = ["gallery"] as const;

/**
 * Tabla de texto por rol. `t` = tipos de bloque razonables, `s` = tipos de sección admisibles.
 * `scope` y `singleton` NO están aquí: se derivan de `GROUP_ROLES`/`SINGLETON_ROLES` (blocks.ts).
 * Nota: el esquema solo prohíbe cruzar grupo/escalar (I-25); `t` es la recomendación del catálogo,
 * no una restricción nueva.
 */
const ROLE_TEXT: Readonly<Record<string, RoleText>> = {
  // --- genéricos: admisibles en CUALQUIER tipo de sección (01 §3.1, párrafo final) ---
  sectionTitle: { d: "Título de la sección.", t: ["text"], s: ALL_SECTION_TYPES },
  sectionIntro: { d: "Texto introductorio de la sección.", t: ["richText", "text", "listText"], s: ALL_SECTION_TYPES },
  sectionBackground: { d: "Imagen de fondo de la sección.", t: ["image"], s: ALL_SECTION_TYPES },
  decorative: { d: "Adorno sin significado: no aporta información, solo decora.", t: ["image"], s: ALL_SECTION_TYPES },
  // --- portada ---
  coverTitle: { d: "Nombre o título principal de la portada.", t: ["text"], s: ["cover"] },
  coverSubtitle: { d: "Frase secundaria bajo el título de la portada.", t: ["text"], s: ["cover"] },
  coverDate: { d: "Fecha del evento tal como se ve en la portada.", t: ["date"], s: ["cover"] },
  coverImage: { d: "Fotografía principal de la portada.", t: ["image"], s: ["cover"] },
  coverBackground: { d: "Imagen de fondo de la portada.", t: ["image"], s: ["cover"] },
  coverButtonLabel: { d: "Texto del botón de la portada.", t: ["text"], s: ["cover"] },
  coverButtonLink: { d: "Destino del botón de la portada.", t: ["link"], s: ["cover"] },
  // --- celebrantes ---
  celebrantsHeading: { d: "Encabezado de la sección de celebrantes.", t: ["text"], s: ["celebrant"] },
  celebrantsDate: { d: "Fecha que acompaña a los celebrantes.", t: ["date"], s: ["celebrant"] },
  celebrantsMessage: { d: "Mensaje conjunto de los celebrantes a sus invitados.", t: ["richText", "text"], s: ["celebrant"] },
  celebrantA: { d: "Primera persona celebrante (por ejemplo la novia).", t: ["person"], s: ["celebrant"] },
  celebrantB: { d: "Segunda persona celebrante (por ejemplo el novio).", t: ["person"], s: ["celebrant"] },
  honoree: { d: "Persona homenajeada cuando el evento gira en torno a una sola (XV, bautizo).", t: ["person"], s: ["celebrant"] },
  celebrantAPhoto: { d: "Fotografía de la primera persona celebrante.", t: ["image"], s: ["celebrant"] },
  celebrantBPhoto: { d: "Fotografía de la segunda persona celebrante.", t: ["image"], s: ["celebrant"] },
  honoreePhoto: { d: "Fotografía de la persona homenajeada.", t: ["image"], s: ["celebrant"] },
  celebrantAText: { d: "Texto propio de la primera persona celebrante.", t: ["richText", "text"], s: ["celebrant"] },
  celebrantBText: { d: "Texto propio de la segunda persona celebrante.", t: ["richText", "text"], s: ["celebrant"] },
  honoreeMessage: { d: "Mensaje de la persona homenajeada.", t: ["richText", "text"], s: ["celebrant"] },
  // --- familia ---
  familyIntro: { d: "Presentación de la sección de familia y padrinos.", t: ["listText", "richText", "text"], s: ["family"] },
  familyGroupTitle: { d: "Título de un grupo de familia concreto (Mis padres, Mis padrinos).", t: ["text"], s: ["family"] },
  parentA1: { d: "Primer progenitor de la persona celebrante A.", t: ["person"], s: ["family"] },
  parentA2: { d: "Segundo progenitor de la persona celebrante A.", t: ["person"], s: ["family"] },
  parentB1: { d: "Primer progenitor de la persona celebrante B.", t: ["person"], s: ["family"] },
  parentB2: { d: "Segundo progenitor de la persona celebrante B.", t: ["person"], s: ["family"] },
  godparentA: { d: "Primera persona madrina o padrino.", t: ["person"], s: ["family"] },
  godparentB: { d: "Segunda persona madrina o padrino.", t: ["person"], s: ["family"] },
  witness: { d: "Persona con un papel de etiqueta libre distinto de progenitor o padrino.", t: ["person"], s: ["family"] },
  familyGroup: { d: "Lista repetible de personas de la familia con su etiqueta.", t: ["group"], s: ["family"] },
  personList: { d: "Segunda lista repetible de personas, para separar padres de padrinos.", t: ["group"], s: ["family"] },
  personName: { d: "Nombre de una persona dentro de una lista de familia.", t: ["person"], s: ["family"] },
  personLabel: { d: "Papel de esa persona en el evento (madre, padrino, testigo).", t: ["text"], s: ["family"] },
  personPhoto: { d: "Fotografía de una persona de la lista de familia.", t: ["image"], s: ["family"] },
  personPhotoVisible: { d: "Si la fotografía de esa persona se muestra o no.", t: ["boolean"], s: ["family"] },
  // --- evento ---
  eventLocationNote: { d: "Nota sobre el lugar cuando todo el evento ocurre en un solo sitio.", t: ["text"], s: ["event"] },
  eventCards: { d: "Lista repetible de momentos del evento (misa, recepción, fiesta).", t: ["group"], s: ["event"] },
  eventTitle: { d: "Nombre de un momento del evento.", t: ["text"], s: ["event"] },
  eventWhen: { d: "Intervalo de fecha y hora de un momento del evento.", t: ["dateTimeRange"], s: ["event"] },
  eventDate: { d: "Fecha de un momento del evento.", t: ["date"], s: ["event"] },
  eventTime: { d: "Hora de un momento del evento.", t: ["time"], s: ["event"] },
  eventPlace: { d: "Lugar de un momento del evento, con dirección y mapa.", t: ["location"], s: ["event"] },
  eventMapLink: { d: "Enlace al mapa del lugar.", t: ["link"], s: ["event"] },
  eventNote: { d: "Aclaración sobre un momento del evento.", t: ["text"], s: ["event"] },
  // --- galería y redes ---
  galleryIntro: { d: "Texto que presenta la galería de fotografías.", t: ["richText", "text"], s: GALLERY },
  galleryPhotos: { d: "Lista repetible de fotografías de la galería.", t: ["group"], s: GALLERY },
  galleryPhoto: { d: "Una fotografía de la galería.", t: ["image"], s: GALLERY },
  hashtag: { d: "Etiqueta de redes sociales del evento.", t: ["text"], s: GALLERY },
  hashtagList: { d: "Lista repetible de etiquetas de redes sociales.", t: ["group"], s: GALLERY },
  hashtagLink: { d: "Enlace al perfil o a la búsqueda de esa etiqueta.", t: ["link"], s: GALLERY },
  hashtagPlatform: { d: "Red social a la que pertenece la etiqueta.", t: ["choice"], s: GALLERY },
  // --- mesa de regalos ---
  giftOptions: { d: "Lista repetible de opciones de regalo.", t: ["group"], s: ["giftTable"] },
  giftOptionKind: { d: "Tipo de opción de regalo, de una lista cerrada de la plantilla.", t: ["choice"], s: ["giftTable"] },
  giftOptionTitle: { d: "Nombre de una opción de regalo.", t: ["text"], s: ["giftTable"] },
  giftOptionDetail: { d: "Datos de la opción de regalo (cuenta, tienda, instrucciones).", t: ["listText", "richText", "text"], s: ["giftTable"] },
  giftOptionImage: { d: "Imagen o logotipo de la opción de regalo.", t: ["image"], s: ["giftTable"] },
  giftOptionLink: { d: "Enlace de la opción de regalo.", t: ["link"], s: ["giftTable"] },
  // --- recomendaciones ---
  suggestionList: { d: "Lista repetible de recomendaciones para los invitados.", t: ["group"], s: ["suggestions"] },
  suggestionName: { d: "Nombre de la recomendación (hotel, restaurante).", t: ["text"], s: ["suggestions"] },
  suggestionDetail: { d: "Detalle de la recomendación.", t: ["listText", "text"], s: ["suggestions"] },
  suggestionImage: { d: "Imagen de la recomendación.", t: ["image"], s: ["suggestions"] },
  suggestionLink: { d: "Enlace de la recomendación.", t: ["link"], s: ["suggestions"] },
  // --- amenidades ---
  amenityList: { d: "Lista repetible de amenidades del lugar.", t: ["group"], s: ["amenities"] },
  amenityName: { d: "Nombre de la amenidad.", t: ["text"], s: ["amenities"] },
  amenityDetail: { d: "Detalle de la amenidad.", t: ["listText", "text"], s: ["amenities"] },
  amenityImage: { d: "Imagen de la amenidad.", t: ["image"], s: ["amenities"] },
  amenityLink: { d: "Enlace de la amenidad.", t: ["link"], s: ["amenities"] },
  // --- historia ---
  storyMilestones: { d: "Lista repetible de hitos de la historia de la pareja o de la persona.", t: ["group"], s: ["story"] },
  storyTitle: { d: "Título de un hito de la historia.", t: ["text"], s: ["story"] },
  storyDate: { d: "Fecha de un hito de la historia.", t: ["date"], s: ["story"] },
  storyBody: { d: "Relato de un hito de la historia.", t: ["richText", "text"], s: ["story"] },
  storyImage: { d: "Imagen de un hito de la historia.", t: ["image"], s: ["story"] },
  // --- código de vestimenta ---
  dressCodeRules: { d: "Lista repetible de reglas de vestimenta.", t: ["group"], s: ["dressCode"] },
  dressCodeTitle: { d: "Nombre de la regla de vestimenta (etiqueta, formal, playa).", t: ["choice", "text"], s: ["dressCode"] },
  dressCodeDetail: { d: "Explicación de la regla de vestimenta.", t: ["text"], s: ["dressCode"] },
  dressCodeImage: { d: "Ilustración de la regla de vestimenta.", t: ["image"], s: ["dressCode"] },
  // --- confirmación ---
  rsvpDeadline: { d: "Fecha límite para confirmar asistencia.", t: ["date"], s: ["rsvp"] },
  rsvpNote: { d: "Mensaje principal de la sección de confirmación.", t: ["listText", "richText", "text"], s: ["rsvp"] },
  rsvpKidsNote: { d: "Aclaración sobre la asistencia de menores, distinta del mensaje principal.", t: ["text"], s: ["rsvp"] },
  rsvpChildrenAllowed: { d: "Si se admiten niños; lo aporta el negocio, no el cliente.", t: ["boolean"], s: ["rsvp"] },
  rsvpYoungAllowed: { d: "Si se admiten jóvenes; lo aporta el negocio, no el cliente.", t: ["boolean"], s: ["rsvp"] },
  rsvpBackground: { d: "Imagen de fondo de la sección de confirmación.", t: ["image"], s: ["rsvp"] },
  // --- pie y ambiente ---
  footerNote: { d: "Nota de cierre al pie de la invitación.", t: ["richText", "text"], s: ["footer"] },
  footerLogo: { d: "Logotipo o firma al pie.", t: ["image"], s: ["footer"] },
  footerLink: { d: "Enlace al pie de la invitación.", t: ["link"], s: ["footer"] },
  backgroundMusic: { d: "Música de fondo de la invitación.", t: ["audio"], s: ["footer"] },
  backgroundMusicEnabled: { d: "Si la música de fondo suena por omisión.", t: ["boolean"], s: ["footer"] },
};

/**
 * Ejemplo mínimo VÁLIDO por tipo de bloque: exactamente los campos obligatorios, ni uno más.
 * No se dan por buenos: `test/introspect.contract.test.ts` los pasa por `BlockSpec.parse` y
 * `BlockValue.parse` reales y comprueba que sus claves coinciden con las que la introspección
 * declara obligatorias — así, un campo nuevo en `blocks.ts` rompe la prueba en vez de pasar.
 */
const EXAMPLE_ASSET_ID = "as_01HZYQK3M4N5P6R7S8T9VWXYZA";
const EXAMPLE_ITEM_ID = "01HZYQK3M4N5P6R7S8T9VWXYZA";

interface MinimalExample {
  readonly spec: Readonly<Record<string, unknown>>;
  readonly value: Readonly<Record<string, unknown>>;
}
const L = (es: string) => ({ "es-MX": es });
const MINIMAL: Readonly<Record<BlockKindName, MinimalExample>> = {
  text: {
    spec: { id: "seccion.texto", type: "text", role: "sectionTitle", label: L("Título") },
    value: { kind: "text", value: "Nuestra boda" },
  },
  richText: {
    spec: { id: "seccion.relato", type: "richText", role: "sectionIntro", label: L("Introducción") },
    value: { kind: "richText", doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hola" }] }] } },
  },
  listText: {
    spec: { id: "seccion.notas", type: "listText", role: "sectionIntro", label: L("Notas") },
    value: { kind: "listText", items: ["Primera nota"] },
  },
  image: {
    spec: { id: "seccion.foto", type: "image", role: "sectionBackground", label: L("Fondo") },
    value: { kind: "image", assetId: EXAMPLE_ASSET_ID, alt: "Fondo de la sección", focal: { x: 0.5, y: 0.5 } },
  },
  audio: {
    spec: { id: "pie.musica", type: "audio", role: "backgroundMusic", label: L("Música") },
    value: { kind: "audio", assetId: EXAMPLE_ASSET_ID },
  },
  date: {
    spec: { id: "portada.fecha", type: "date", role: "coverDate", label: L("Fecha") },
    value: { kind: "date", value: "2026-11-14" },
  },
  time: {
    spec: { id: "evento.hora", type: "time", role: "eventTime", label: L("Hora") },
    value: { kind: "time", value: "18:30" },
  },
  dateTimeRange: {
    spec: { id: "evento.cuando", type: "dateTimeRange", role: "eventWhen", label: L("Cuándo") },
    value: { kind: "dateTimeRange", start: "2026-11-14T18:30" },
  },
  link: {
    spec: { id: "evento.mapa", type: "link", role: "eventMapLink", label: L("Mapa") },
    value: { kind: "link", href: "https://maps.example.com/lugar" },
  },
  location: {
    spec: { id: "evento.lugar", type: "location", role: "eventPlace", label: L("Lugar") },
    value: { kind: "location", name: "Jardín Las Rosas" },
  },
  choice: {
    spec: {
      id: "regalos.tipo", type: "choice", role: "giftOptionKind", label: L("Tipo"),
      options: [{ id: "sobre", label: L("Sobre") }],
    },
    value: { kind: "choice", optionId: "sobre" },
  },
  boolean: {
    spec: { id: "pie.musicaActiva", type: "boolean", role: "backgroundMusicEnabled", label: L("Suena sola") },
    value: { kind: "boolean", value: true },
  },
  person: {
    spec: { id: "celebrante.persona", type: "person", role: "honoree", label: L("Nombre") },
    value: { kind: "person", name: "María" },
  },
  group: {
    spec: {
      id: "evento.momentos", type: "group", role: "eventCards", label: L("Momentos"),
      itemLabel: L("Momento"),
      itemBlocks: [{ id: "titulo", type: "text", role: "eventTitle", label: L("Título") }],
    },
    value: { kind: "group", items: [{ itemId: EXAMPLE_ITEM_ID, values: { titulo: { kind: "text", value: "Misa" } } }] },
  },
};

// ---------------------------------------------------------------------------------------------
// 3. Superficie pública.
// ---------------------------------------------------------------------------------------------
/** Claves de la tabla de texto por rol. Existe para que la prueba de cobertura pueda detectar
 *  también el caso contrario al de un rol sin texto: texto de un rol que ya no existe. */
export const ROLE_TEXT_KEYS: readonly string[] = Object.keys(ROLE_TEXT);

export const BLOCK_TYPES: readonly BlockKindName[] = BlockKind.options;
export const ROLES: readonly string[] = BlockRole.options;
export const SECTION_TYPES: readonly string[] = SectionType.options;

/** Todo lo que hay que saber de un tipo de bloque para poder escribirlo a la primera. */
export interface BlockTypeInfo {
  readonly type: BlockKindName;
  /** Para qué sirve, en una frase (es-MX). */
  readonly summary: string;
  /** Forma exacta de la rama del `oneOf` de `BlockSpec` (lo que va en `template.json`). */
  readonly spec: BranchShape;
  /** Forma exacta del valor (lo que va en `defaults.json` y en `doc.content`). */
  readonly value: BranchShape;
  /** Roles del catálogo cerrado que este tipo de bloque puede llevar. */
  readonly roles: readonly string[];
  /** `BlockSpec` mínimo válido: exactamente los campos obligatorios. */
  readonly minimalSpec: Readonly<Record<string, unknown>>;
  /** `BlockValue` mínimo válido. */
  readonly minimalValue: Readonly<Record<string, unknown>>;
}

const blockTypeCache = new Map<string, BlockTypeInfo>();

/** Ficha completa de un tipo de bloque. Lanza si el tipo no está en el catálogo cerrado. */
export function describeBlockType(type: string): BlockTypeInfo {
  const cached = blockTypeCache.get(type);
  if (cached) return cached;
  if (!(BLOCK_TYPES as readonly string[]).includes(type)) {
    const cerca = suggestBlockType(type);
    throw new Error(
      `introspect: "${type}" no es un tipo de bloque` +
      (cerca.length > 0 ? `. ¿Quisiste decir ${cerca.map(c => `"${c}"`).join(", ")}?` : ""),
    );
  }
  const kind = type as BlockKindName;
  const info: BlockTypeInfo = {
    type: kind,
    summary: BLOCK_TYPE_TEXT[kind],
    spec: branchOf(BlockSpec, kind),
    value: branchOf(BlockValue, kind),
    roles: ROLES.filter(r => (ROLE_TEXT[r]?.t ?? []).includes(kind)),
    minimalSpec: MINIMAL[kind].spec,
    minimalValue: MINIMAL[kind].value,
  };
  blockTypeCache.set(type, info);
  return info;
}

/** Los 14 tipos de bloque descritos, en el orden del catálogo cerrado. */
export function describeBlockTypes(): readonly BlockTypeInfo[] {
  return BLOCK_TYPES.map(t => describeBlockType(t));
}

const GROUP_ROLE_SET: ReadonlySet<string> = new Set<string>(GROUP_ROLES);
const SINGLETON_ROLE_SET: ReadonlySet<string> = new Set<string>(SINGLETON_ROLES);

/** Ficha de un rol, o `undefined` si el rol no está en el catálogo cerrado. */
export function describeRole(role: string): RoleInfo | undefined {
  const text = ROLE_TEXT[role];
  if (!text || !(ROLES as readonly string[]).includes(role)) return undefined;
  return {
    role,
    description: text.d,
    scope: GROUP_ROLE_SET.has(role) ? "group" : "scalar",
    singleton: SINGLETON_ROLE_SET.has(role),
    blockTypes: text.t,
    sectionTypes: text.s,
  };
}

/** Los 90 roles descritos, en el orden del catálogo cerrado (`BlockRole`). */
export function describeRoles(): readonly RoleInfo[] {
  const out: RoleInfo[] = [];
  for (const r of ROLES) {
    const info = describeRole(r);
    if (info) out.push(info);
  }
  return out;
}

/** Roles admisibles en un tipo de sección (incluye los cuatro genéricos). */
export function rolesForSectionType(sectionType: string): readonly RoleInfo[] {
  return describeRoles().filter(r => r.sectionTypes.includes(sectionType));
}

// ---------------------------------------------------------------------------------------------
// 4. Sugerencia por cercanía. Distancia de Levenshtein sobre minúsculas, con una bonificación por
//    prefijo común: los fallos reales de I-08 fueron `celebrantName` y `momentPlace`, palabras
//    compuestas donde la mitad es correcta y la distancia sola no basta.
// ---------------------------------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost));
    }
    prev = row;
  }
  return prev[b.length];
}

function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

export interface Suggestion {
  readonly value: string;
  /** Distancia de edición cruda (sin la bonificación). Cuanto menor, más parecido. */
  readonly distance: number;
}

/**
 * Candidatos más cercanos a `input`, del más al menos parecido. Puntúa por distancia de edición y
 * descuenta hasta 3 puntos por prefijo común de 4 o más caracteres; descarta lo que ni siquiera se
 * parece (puntuación > el máximo de 3 y un tercio de la longitud).
 */
export function suggestClosest(
  input: string, candidates: readonly string[], limit = 3,
): readonly Suggestion[] {
  const needle = input.toLowerCase();
  const umbral = Math.max(3, Math.floor(needle.length / 3));
  const scored: Array<{ value: string; distance: number; score: number }> = [];
  for (const candidate of candidates) {
    const hay = candidate.toLowerCase();
    const distance = levenshtein(needle, hay);
    const prefijo = commonPrefix(needle, hay);
    const bonus = prefijo >= 4 ? Math.min(3, prefijo - 3) : 0;
    const score = distance - bonus;
    if (score <= umbral) scored.push({ value: candidate, distance, score });
  }
  scored.sort((x, y) => x.score - y.score || x.distance - y.distance || x.value.localeCompare(y.value));
  return scored.slice(0, limit).map(({ value, distance }) => ({ value, distance }));
}

/** «¿Quisiste decir …?» sobre los 90 roles del catálogo cerrado. */
export function suggestRole(input: string, limit = 3): readonly string[] {
  return suggestClosest(input, ROLES, limit).map(s => s.value);
}
/** «¿Quisiste decir …?» sobre los 14 tipos de bloque. */
export function suggestBlockType(input: string, limit = 3): readonly string[] {
  return suggestClosest(input, BLOCK_TYPES, limit).map(s => s.value);
}
/** «¿Quisiste decir …?» sobre los 12 tipos de sección. */
export function suggestSectionType(input: string, limit = 3): readonly string[] {
  return suggestClosest(input, SECTION_TYPES, limit).map(s => s.value);
}

// ---------------------------------------------------------------------------------------------
// 5. Explicación de un BlockSpec crudo: la respuesta al «0 are valid» del intento 2 de I-08.
// ---------------------------------------------------------------------------------------------
export interface BlockSpecExplanation {
  /** `type` leído del objeto crudo, tal cual venía. */
  readonly declaredType: unknown;
  /** true si `declaredType` es uno de los 14 tipos del catálogo cerrado. */
  readonly known: boolean;
  /** Campos obligatorios de la rama que faltan en el objeto. */
  readonly missing: readonly string[];
  /** Propiedades del objeto que la rama no admite (los `strictObject` las rechazan). */
  readonly unknown: readonly string[];
  /** Campos con `.default()` que se omitieron: no son un error, se rellenan solos. */
  readonly omittedWithDefault: readonly string[];
  /** Sugerencias por cercanía para `type` y para `role`. */
  readonly suggestions: Readonly<{ type?: readonly string[]; role?: readonly string[] }>;
  /** Mensaje listo para imprimir (es-MX). */
  readonly message: string;
}

/**
 * Dice QUÉ rama del `oneOf` pretendías y qué le falta, en vez de «0 are valid». No valida: para eso
 * está `BlockSpec.parse`. Complementa el error del `parse` con el vocabulario que el autor no tiene.
 */
export function explainBlockSpec(raw: unknown): BlockSpecExplanation {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const declaredType = obj["type"];
  const known = typeof declaredType === "string" && (BLOCK_TYPES as readonly string[]).includes(declaredType);
  const suggestions: { type?: readonly string[]; role?: readonly string[] } = {};
  if (!known) {
    suggestions.type = typeof declaredType === "string" ? suggestBlockType(declaredType) : BLOCK_TYPES.slice(0, 3);
    const partes = [
      typeof declaredType === "string"
        ? `"${declaredType}" no es uno de los 14 tipos de bloque.`
        : "falta la propiedad `type`, que decide la rama del `oneOf`.",
      suggestions.type.length > 0 ? ` ¿Quisiste decir ${suggestions.type.map(t => `"${t}"`).join(", ")}?` : "",
    ];
    return {
      declaredType, known: false, missing: [], unknown: [], omittedWithDefault: [],
      suggestions, message: partes.join(""),
    };
  }
  const info = describeBlockType(declaredType as string);
  const presentes = new Set(Object.keys(obj));
  const admitidas = new Set(info.spec.all);
  const missing = info.spec.required.filter(f => !presentes.has(f));
  const sobrantes = [...presentes].filter(f => !admitidas.has(f));
  const omitted = info.spec.withDefault.filter(f => !presentes.has(f));
  const rol = obj["role"];
  if (typeof rol === "string" && describeRole(rol) === undefined) suggestions.role = suggestRole(rol);
  const trozos: string[] = [`bloque \`type: "${declaredType}"\`.`];
  if (missing.length > 0) trozos.push(`Faltan: ${missing.join(", ")}.`);
  if (sobrantes.length > 0) {
    trozos.push(`No admite: ${sobrantes.join(", ")} (esta rama admite ${info.spec.all.join(", ")}).`);
  }
  if (suggestions.role) {
    trozos.push(
      `El rol "${String(rol)}" no está en el catálogo cerrado` +
      (suggestions.role.length > 0 ? `; ¿quisiste decir ${suggestions.role.map(r => `"${r}"`).join(", ")}?` : "."),
    );
  }
  if (missing.length === 0 && sobrantes.length === 0 && !suggestions.role) trozos.push("No falta ni sobra ninguna propiedad.");
  return {
    declaredType, known: true, missing, unknown: sobrantes, omittedWithDefault: omitted,
    suggestions, message: trozos.join(" "),
  };
}
