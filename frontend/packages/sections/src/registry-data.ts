// packages/sections/src/registry-data.ts — datos PUROS del registro (variantes/roles/etiquetas
// por tipo de sección), sin React ni JSX.
//
// Separado de `registry.ts` a propósito: `scripts/emit-section-variants.ts` corre con
// `node --experimental-strip-types` (mismo patrón que `packages/schema/scripts/emit-json-schema.ts`),
// que SOLO borra anotaciones de tipo — no transforma JSX. `registry.ts` importa
// `createPlaceholderSection` de `placeholder/SectionPlaceholder.tsx`, que sí tiene JSX real; si el
// script importara `registry.ts` directamente, Node fallaría al parsear esa cadena de imports.
// Este archivo es la frontera: cero imports de `.tsx`, así que el script puede cargarlo solo.
import type { SectionType, BlockRole } from "@invitaciones/schema";

export interface SectionRegistryData {
  readonly supportedVariants: readonly string[];
  readonly defaultVariant: string;
  readonly roles: readonly BlockRole[];
}

/** Roles genéricos, admisibles en CUALQUIER tipo de sección (01 §3.1, párrafo final de la tabla). */
const GENERIC_ROLES = ["sectionTitle", "sectionIntro", "sectionBackground", "decorative"] as const;

function data(
  supportedVariants: readonly string[],
  defaultVariant: string,
  ownRoles: readonly BlockRole[],
): SectionRegistryData {
  return {
    supportedVariants,
    defaultVariant,
    roles: Array.from(new Set<BlockRole>([...ownRoles, ...GENERIC_ROLES])),
  };
}

/**
 * Bloques admitidos por tipo: `01 §3.1`, columna "Bloques admitidos" (normativa), + roles
 * genéricos. Variantes: unión de "variantes de referencia" (`01 §3.1`) y las que declaran de
 * verdad los dos paquetes de `frontend/templates/` — verificado [V] contra `template.json` de
 * `boda-clasica@1.0.0` y `xv-jardin@1.0.0` (bitácora 3-2a). `gallery.masonry` no está en la tabla
 * de `01 §3.1` (que solo lista `grid-6`/`grid-9`/`carousel`) — discrepancia real entre el diseño y
 * el paquete registrado, registrada en `preguntas-abiertas.md`; se incluye igual para que la
 * regla 5 de `04 §5.2` (`SectionSpec.variants ⊆ supportedVariants`) no falle contra el real.
 */
export const SECTION_REGISTRY_DATA: Readonly<Record<SectionType, SectionRegistryData>> = {
  cover: data(
    ["full", "framed", "split"],
    "full",
    ["coverTitle", "coverSubtitle", "coverDate", "coverImage", "coverBackground", "coverButtonLabel", "coverButtonLink"],
  ),
  celebrant: data(
    ["side-by-side", "stacked", "centered"],
    "side-by-side",
    [
      "celebrantsHeading", "celebrantsDate", "celebrantsMessage", "celebrantA", "celebrantB",
      "honoree", "celebrantAPhoto", "celebrantBPhoto", "honoreePhoto", "celebrantAText",
      "celebrantBText", "honoreeMessage",
    ],
  ),
  event: data(["timeline", "cards", "single-place"], "timeline", ["eventLocationNote", "eventPlace", "eventCards"]),
  gallery: data(["grid-6", "grid-9", "carousel", "masonry"], "grid-6", ["galleryIntro", "galleryPhotos", "hashtag", "hashtagList"]),
  giftTable: data(["cards", "list"], "cards", ["giftOptions"]),
  suggestions: data(["cards", "list"], "cards", ["suggestionList"]),
  amenities: data(["cards", "list"], "cards", ["amenityList"]),
  rsvp: data(
    ["banner", "form-inline"],
    "banner",
    ["rsvpNote", "rsvpKidsNote", "rsvpDeadline", "rsvpChildrenAllowed", "rsvpYoungAllowed", "rsvpBackground"],
  ),
  family: data(
    ["cards", "list"],
    "cards",
    [
      "familyIntro", "familyGroupTitle", "parentA1", "parentA2", "parentB1", "parentB2",
      "godparentA", "godparentB", "witness", "familyGroup", "personList",
    ],
  ),
  story: data(["line", "alternating"], "line", ["storyMilestones"]),
  dressCode: data(["two-columns", "cards"], "two-columns", ["dressCodeRules"]),
  footer: data(
    ["simple"],
    "simple",
    ["footerNote", "footerLogo", "footerLink", "backgroundMusic", "backgroundMusicEnabled"],
  ),
};

/** Etiquetas es-MX de toda variante usada (H-F-06: selector por etiqueta + diagrama SVG, no fotos). */
export const VARIANT_LABELS_ES_MX: Readonly<Record<string, string>> = {
  full: "Pantalla completa",
  framed: "Enmarcada",
  split: "Dividida",
  "side-by-side": "Uno junto al otro",
  stacked: "Apilados",
  centered: "Centrado",
  cards: "Tarjetas",
  list: "Lista",
  timeline: "Línea de tiempo",
  "single-place": "Un solo lugar",
  "grid-6": "Cuadrícula de 6",
  "grid-9": "Cuadrícula de 9",
  carousel: "Carrusel",
  masonry: "Mosaico",
  banner: "Banner",
  "form-inline": "Formulario en línea",
  line: "Línea",
  alternating: "Alternada",
  "two-columns": "Dos columnas",
  simple: "Simple",
};

export function labelsFor(variants: readonly string[]): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const variant of variants) {
    const label = VARIANT_LABELS_ES_MX[variant];
    if (label === undefined) {
      throw new Error(`registry-data.ts: falta la etiqueta es-MX de la variante "${variant}"`);
    }
    out[variant] = label;
  }
  return out;
}
