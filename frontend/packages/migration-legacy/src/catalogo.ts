// src/catalogo.ts — la FORMA del paquete nuevo: qué secciones y qué bloques puede emitir la
// conversión, con su `type`, su `role`, su etiqueta y sus restricciones.
//
// Es el otro extremo de la tabla de reglas: `reglas-*.ts` dice a QUÉ `blockId` va cada hoja y este
// catálogo dice QUÉ ES ese `blockId`. `test/catalogo.test.ts` comprueba que los dos lados casan: todo
// destino de una regla existe aquí y todo bloque de aquí es destino de alguna regla (si no, sería un
// bloque que nunca se puede rellenar).
//
// El manifiesto NO se escribe a mano: una sección se emite si su clave existe en F1 y un bloque se
// emite si al menos una hoja de F1 lo tiene como destino. Así el manifiesto es una FUNCIÓN de los
// datos legados, no una opinión.

import type { BlockRole, SectionType } from "@invitaciones/schema";
import type { Cohorte } from "./plantillas.ts";

export interface SeccionCatalogo {
  readonly key: string;
  readonly tipo: SectionType;
  /** Clave de `config` en F1 que hace que esta sección exista. */
  readonly legado: string;
  readonly titulo: string;
  readonly variantes: readonly string[];
  readonly variantePorDefecto: string;
  /** `required: true` ⇒ `visible` no puede ponerse a `false` (I-17). */
  readonly required: boolean;
}

/** Orden canónico de la página. `structure.sections` hereda este orden (01 §2.3). */
export const SECCIONES: readonly SeccionCatalogo[] = [
  { key: "cover", tipo: "cover", legado: "sectionCover", titulo: "Portada", variantes: ["full"], variantePorDefecto: "full", required: true },
  { key: "couple", tipo: "celebrant", legado: "sectionCouple", titulo: "Celebrantes", variantes: ["centered", "side-by-side"], variantePorDefecto: "centered", required: true },
  { key: "family", tipo: "family", legado: "sectionFamily", titulo: "Familia", variantes: ["cards", "list"], variantePorDefecto: "cards", required: false },
  { key: "event", tipo: "event", legado: "sectionEvent", titulo: "Itinerario", variantes: ["cards", "single-place"], variantePorDefecto: "cards", required: true },
  { key: "story", tipo: "story", legado: "sectionStory", titulo: "Nuestra historia", variantes: ["line"], variantePorDefecto: "line", required: false },
  { key: "gallery", tipo: "gallery", legado: "sectionGallery", titulo: "Galería", variantes: ["grid-6"], variantePorDefecto: "grid-6", required: false },
  { key: "suggestions", tipo: "suggestions", legado: "sectionSuggestions", titulo: "Recomendaciones", variantes: ["cards"], variantePorDefecto: "cards", required: false },
  { key: "amenities", tipo: "amenities", legado: "sectionAmenities", titulo: "Amenidades", variantes: ["cards"], variantePorDefecto: "cards", required: false },
  { key: "gifts", tipo: "giftTable", legado: "sectionGifttable", titulo: "Mesa de regalos", variantes: ["cards"], variantePorDefecto: "cards", required: false },
  { key: "dressCode", tipo: "dressCode", legado: "sectionDresscode", titulo: "Código de vestimenta", variantes: ["two-columns"], variantePorDefecto: "two-columns", required: false },
  { key: "rsvp", tipo: "rsvp", legado: "sectionStarted", titulo: "Confirmación", variantes: ["banner"], variantePorDefecto: "banner", required: true },
  { key: "footer", tipo: "footer", legado: "sectionFooter", titulo: "Pie", variantes: ["simple"], variantePorDefecto: "simple", required: true },
];

export type TipoBloque =
  | "text" | "richText" | "listText" | "image" | "audio" | "date" | "time"
  | "dateTimeRange" | "link" | "location" | "choice" | "boolean" | "person" | "group";

export interface BloqueCatalogo {
  readonly id: string;
  readonly seccion: string;
  readonly tipo: TipoBloque;
  readonly rol: BlockRole;
  readonly etiqueta: string;
  readonly ayuda?: string;
  readonly requerido?: boolean;
  readonly editable?: boolean;
  readonly fuente?: "user" | "business" | "fixed";
  readonly campoNegocio?: string;
  readonly maxLength?: number;
  readonly multilinea?: boolean;
  readonly formatId?: string;
  readonly opciones?: readonly { readonly id: string; readonly etiqueta: string }[];
  readonly cohortes?: readonly Cohorte[];
  /** Sólo `group`: bloques del ítem. */
  readonly itemBlocks?: readonly BloqueItemCatalogo[];
  readonly etiquetaItem?: string;
  readonly maxItems?: number;
}

export interface BloqueItemCatalogo {
  readonly id: string;
  readonly tipo: Exclude<TipoBloque, "group">;
  readonly rol: BlockRole;
  readonly etiqueta: string;
  readonly maxLength?: number;
  readonly formatId?: string;
  readonly opciones?: readonly { readonly id: string; readonly etiqueta: string }[];
}

const PERSONA_ITEM: readonly BloqueItemCatalogo[] = [
  { id: "person", tipo: "person", rol: "personName", etiqueta: "Nombre" },
  { id: "label", tipo: "text", rol: "personLabel", etiqueta: "Parentesco", maxLength: 80 },
  { id: "photo", tipo: "image", rol: "personPhoto", etiqueta: "Foto" },
  { id: "showPhoto", tipo: "boolean", rol: "personPhotoVisible", etiqueta: "Mostrar la foto" },
];

const TARJETA_EVENTO: readonly BloqueItemCatalogo[] = [
  { id: "title", tipo: "text", rol: "eventTitle", etiqueta: "Título", maxLength: 120 },
  { id: "when", tipo: "dateTimeRange", rol: "eventWhen", etiqueta: "Cuándo", formatId: "long-h12" },
  { id: "place", tipo: "location", rol: "eventPlace", etiqueta: "Dónde" },
];

/** Bloques estáticos. Los dinámicos (`family.group<N>`) los resuelve `bloqueDe`. */
const ESTATICOS: readonly BloqueCatalogo[] = [
  // cover
  { id: "cover.title", seccion: "cover", tipo: "text", rol: "coverTitle", etiqueta: "Título de portada", maxLength: 200 },
  { id: "cover.subtitle", seccion: "cover", tipo: "text", rol: "coverSubtitle", etiqueta: "Subtítulo", maxLength: 200 },
  { id: "cover.date", seccion: "cover", tipo: "date", rol: "coverDate", etiqueta: "Fecha del evento",
    fuente: "business", campoNegocio: "invitation.date", editable: false, formatId: "long",
    ayuda: "Se lee de los datos del evento; no se edita aquí (mata H-04)." },
  { id: "cover.image", seccion: "cover", tipo: "image", rol: "coverImage", etiqueta: "Foto de portada" },
  { id: "cover.buttonLabel", seccion: "cover", tipo: "text", rol: "coverButtonLabel", etiqueta: "Texto del botón", maxLength: 80, fuente: "fixed", editable: false },
  // couple
  { id: "couple.heading", seccion: "couple", tipo: "text", rol: "celebrantsHeading", etiqueta: "Encabezado", maxLength: 200 },
  { id: "couple.date", seccion: "couple", tipo: "date", rol: "celebrantsDate", etiqueta: "Fecha",
    fuente: "business", campoNegocio: "invitation.date", editable: false, formatId: "long" },
  { id: "couple.honoree", seccion: "couple", tipo: "person", rol: "honoree", etiqueta: "Celebrante", cohortes: ["no-boda"] },
  { id: "couple.honoreePhoto", seccion: "couple", tipo: "image", rol: "honoreePhoto", etiqueta: "Foto del celebrante", cohortes: ["no-boda"] },
  { id: "couple.honoreeMessage", seccion: "couple", tipo: "richText", rol: "honoreeMessage", etiqueta: "Mensaje", cohortes: ["no-boda"] },
  { id: "couple.groom", seccion: "couple", tipo: "person", rol: "celebrantA", etiqueta: "Novio", cohortes: ["boda"] },
  { id: "couple.bride", seccion: "couple", tipo: "person", rol: "celebrantB", etiqueta: "Novia", cohortes: ["boda"] },
  { id: "couple.groomPhoto", seccion: "couple", tipo: "image", rol: "celebrantAPhoto", etiqueta: "Foto del novio", cohortes: ["boda"] },
  { id: "couple.bridePhoto", seccion: "couple", tipo: "image", rol: "celebrantBPhoto", etiqueta: "Foto de la novia", cohortes: ["boda"] },
  { id: "couple.groomText", seccion: "couple", tipo: "richText", rol: "celebrantAText", etiqueta: "Texto del novio", cohortes: ["boda"] },
  { id: "couple.brideText", seccion: "couple", tipo: "richText", rol: "celebrantBText", etiqueta: "Texto de la novia", cohortes: ["boda"] },
  { id: "couple.message", seccion: "couple", tipo: "richText", rol: "celebrantsMessage", etiqueta: "Mensaje de la pareja", cohortes: ["boda"] },
  // family
  { id: "family.title", seccion: "family", tipo: "text", rol: "sectionTitle", etiqueta: "Título de la sección", maxLength: 200 },
  { id: "family.intro", seccion: "family", tipo: "listText", rol: "familyIntro", etiqueta: "Introducción" },
  { id: "family.people", seccion: "family", tipo: "group", rol: "personList", etiqueta: "Personas",
    etiquetaItem: "Persona", maxItems: 12, itemBlocks: PERSONA_ITEM },
  // event
  { id: "event.title", seccion: "event", tipo: "text", rol: "sectionTitle", etiqueta: "Título de la sección", maxLength: 200 },
  { id: "event.locationNote", seccion: "event", tipo: "text", rol: "eventLocationNote", etiqueta: "Nota del lugar", maxLength: 300, multilinea: true },
  { id: "event.cards", seccion: "event", tipo: "group", rol: "eventCards", etiqueta: "Momentos",
    etiquetaItem: "Momento", maxItems: 8, itemBlocks: TARJETA_EVENTO },
  { id: "event.singlePlaceCards", seccion: "event", tipo: "group", rol: "eventCards", etiqueta: "Momentos (mismo lugar)",
    etiquetaItem: "Momento", maxItems: 8, itemBlocks: TARJETA_EVENTO },
  // story
  { id: "story.title", seccion: "story", tipo: "text", rol: "sectionTitle", etiqueta: "Título de la sección", maxLength: 200 },
  { id: "story.milestones", seccion: "story", tipo: "group", rol: "storyMilestones", etiqueta: "Hitos",
    etiquetaItem: "Hito", maxItems: 12, itemBlocks: [
      { id: "title", tipo: "text", rol: "storyTitle", etiqueta: "Título", maxLength: 200 },
      { id: "date", tipo: "date", rol: "storyDate", etiqueta: "Fecha", formatId: "month-year" },
      { id: "body", tipo: "richText", rol: "storyBody", etiqueta: "Texto" },
      { id: "image", tipo: "image", rol: "storyImage", etiqueta: "Imagen" },
    ] },
  // gallery
  { id: "gallery.title", seccion: "gallery", tipo: "text", rol: "sectionTitle", etiqueta: "Título de la sección", maxLength: 200 },
  { id: "gallery.intro", seccion: "gallery", tipo: "text", rol: "galleryIntro", etiqueta: "Introducción", maxLength: 300, multilinea: true },
  { id: "gallery.photos", seccion: "gallery", tipo: "group", rol: "galleryPhotos", etiqueta: "Fotos",
    etiquetaItem: "Foto", maxItems: 24, itemBlocks: [{ id: "image", tipo: "image", rol: "galleryPhoto", etiqueta: "Imagen" }] },
  { id: "gallery.hashtags", seccion: "gallery", tipo: "group", rol: "hashtagList", etiqueta: "Hashtags",
    etiquetaItem: "Hashtag", maxItems: 4, itemBlocks: [
      { id: "tag", tipo: "text", rol: "hashtag", etiqueta: "Hashtag", maxLength: 80 },
      { id: "link", tipo: "link", rol: "hashtagLink", etiqueta: "Enlace" },
      { id: "platform", tipo: "choice", rol: "hashtagPlatform", etiqueta: "Red social", opciones: [
        { id: "facebook", etiqueta: "Facebook" }, { id: "instagram", etiqueta: "Instagram" },
        { id: "tiktok", etiqueta: "TikTok" }, { id: "x", etiqueta: "X" }, { id: "otro", etiqueta: "Otra" },
      ] },
    ] },
  // suggestions
  { id: "suggestions.title", seccion: "suggestions", tipo: "text", rol: "sectionTitle", etiqueta: "Título de la sección", maxLength: 200 },
  { id: "suggestions.items", seccion: "suggestions", tipo: "group", rol: "suggestionList", etiqueta: "Recomendaciones",
    etiquetaItem: "Recomendación", maxItems: 12, itemBlocks: [
      { id: "name", tipo: "text", rol: "suggestionName", etiqueta: "Nombre", maxLength: 200 },
      { id: "detail", tipo: "listText", rol: "suggestionDetail", etiqueta: "Detalle" },
      { id: "image", tipo: "image", rol: "suggestionImage", etiqueta: "Imagen" },
      { id: "link", tipo: "link", rol: "suggestionLink", etiqueta: "Enlace" },
    ] },
  // amenities
  { id: "amenities.title", seccion: "amenities", tipo: "text", rol: "sectionTitle", etiqueta: "Título de la sección", maxLength: 200 },
  { id: "amenities.items", seccion: "amenities", tipo: "group", rol: "amenityList", etiqueta: "Amenidades",
    etiquetaItem: "Amenidad", maxItems: 12, itemBlocks: [
      { id: "name", tipo: "text", rol: "amenityName", etiqueta: "Nombre", maxLength: 200 },
      { id: "detail", tipo: "listText", rol: "amenityDetail", etiqueta: "Detalle" },
      { id: "image", tipo: "image", rol: "amenityImage", etiqueta: "Imagen" },
      { id: "link", tipo: "link", rol: "amenityLink", etiqueta: "Enlace" },
    ] },
  // gifts
  { id: "gifts.title", seccion: "gifts", tipo: "text", rol: "sectionTitle", etiqueta: "Título de la sección", maxLength: 200 },
  { id: "gifts.options", seccion: "gifts", tipo: "group", rol: "giftOptions", etiqueta: "Opciones de regalo",
    etiquetaItem: "Opción", maxItems: 12, itemBlocks: [
      { id: "kind", tipo: "choice", rol: "giftOptionKind", etiqueta: "Tipo", opciones: [
        { id: "cash", etiqueta: "Depósito o transferencia" }, { id: "digital", etiqueta: "Mesa digital" }, { id: "store", etiqueta: "Tienda" },
      ] },
      { id: "title", tipo: "text", rol: "giftOptionTitle", etiqueta: "Título", maxLength: 200 },
      { id: "detail", tipo: "listText", rol: "giftOptionDetail", etiqueta: "Detalle" },
      { id: "image", tipo: "image", rol: "giftOptionImage", etiqueta: "Imagen" },
      { id: "link", tipo: "link", rol: "giftOptionLink", etiqueta: "Enlace" },
    ] },
  // dressCode
  { id: "dressCode.title", seccion: "dressCode", tipo: "text", rol: "sectionTitle", etiqueta: "Título de la sección", maxLength: 200 },
  { id: "dressCode.rules", seccion: "dressCode", tipo: "group", rol: "dressCodeRules", etiqueta: "Reglas",
    etiquetaItem: "Regla", maxItems: 8, itemBlocks: [
      { id: "title", tipo: "text", rol: "dressCodeTitle", etiqueta: "Título", maxLength: 120 },
      { id: "detail", tipo: "text", rol: "dressCodeDetail", etiqueta: "Detalle", maxLength: 600 },
      { id: "image", tipo: "image", rol: "dressCodeImage", etiqueta: "Imagen" },
    ] },
  // rsvp
  { id: "rsvp.title", seccion: "rsvp", tipo: "text", rol: "sectionTitle", etiqueta: "Título de la sección", maxLength: 200 },
  { id: "rsvp.note", seccion: "rsvp", tipo: "text", rol: "rsvpNote", etiqueta: "Nota", maxLength: 600, multilinea: true },
  { id: "rsvp.deadline", seccion: "rsvp", tipo: "date", rol: "rsvpDeadline", etiqueta: "Fecha límite", formatId: "long" },
  { id: "rsvp.background", seccion: "rsvp", tipo: "image", rol: "rsvpBackground", etiqueta: "Fondo", fuente: "fixed", editable: false },
  // footer
  { id: "footer.note", seccion: "footer", tipo: "text", rol: "footerNote", etiqueta: "Aviso legal", maxLength: 300, fuente: "fixed", editable: false },
  { id: "footer.music", seccion: "footer", tipo: "audio", rol: "backgroundMusic", etiqueta: "Música de fondo" },
  { id: "footer.musicEnabled", seccion: "footer", tipo: "boolean", rol: "backgroundMusicEnabled", etiqueta: "Reproducir la música" },
];

const POR_ID = new Map(ESTATICOS.map((b) => [b.id, b]));

const RE_GRUPO_FAMILIA = /^family\.group(\d{1,2})$/;
const RE_GRUPO_FAMILIA_TITULO = /^family\.group(\d{1,2})Title$/;

/**
 * Resuelve un `blockId` a su definición. Los grupos de familia son DINÁMICOS: el legado anida
 * `sectionFamily.items[i].items[j]` y los grupos del esquema nuevo no anidan (01 §3.2), así que cada
 * `items[i]` se convierte en su propio bloque `group` (`family.group1`, `family.group2`, …).
 */
export function bloqueDe(blockId: string): BloqueCatalogo | null {
  const est = POR_ID.get(blockId);
  if (est) return est;
  const g = RE_GRUPO_FAMILIA.exec(blockId);
  if (g) {
    return {
      id: blockId, seccion: "family", tipo: "group", rol: "familyGroup",
      etiqueta: `Grupo de familia ${g[1]}`, etiquetaItem: "Persona", maxItems: 12, itemBlocks: PERSONA_ITEM,
    };
  }
  const t = RE_GRUPO_FAMILIA_TITULO.exec(blockId);
  if (t) {
    return {
      id: blockId, seccion: "family", tipo: "text", rol: "familyGroupTitle",
      etiqueta: `Título del grupo de familia ${t[1]}`, maxLength: 200,
    };
  }
  return null;
}

/** Todos los bloques estáticos (para las comprobaciones de coherencia de las pruebas). */
export const BLOQUES_ESTATICOS = ESTATICOS;

export function seccionDe(key: string): SeccionCatalogo | null {
  return SECCIONES.find((s) => s.key === key) ?? null;
}
