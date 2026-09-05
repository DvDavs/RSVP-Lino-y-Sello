// packages/sections/test/fixtures.ts — datos de prueba VALIDADOS contra los esquemas Zod reales
// (`.parse()`, no `as ComposedBlock` a ciegas) — si un fixture no encaja con el esquema real, la
// prueba falla aquí, no en un `.map()` silencioso más abajo.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ComposedBlockSchema,
  ComposedGroupSchema,
  ComposedSectionSchema,
  ResolvedThemeSchema,
} from "./schema-values.ts";
import type { ComposedBlock, ComposedGroup, ComposedSection, ResolvedTheme } from "../src/schema-types.ts";
import {
  compose,
  TemplateManifest,
  ThemeSpec,
  DefaultsFile,
  type TemplatePackage,
  type BusinessSnapshot,
  type AssetIndex,
  type ComposedDocument,
} from "@invitaciones/schema";

export function textBlock(overrides: Record<string, unknown> = {}): ComposedBlock {
  return ComposedBlockSchema.parse({
    id: "cover.title",
    role: "coverTitle",
    type: "text",
    label: "Título",
    provenance: "user",
    value: { kind: "text", value: "Ana & Luis" },
    ...overrides,
  });
}

export function nullTextBlock(overrides: Record<string, unknown> = {}): ComposedBlock {
  return ComposedBlockSchema.parse({
    id: "cover.subtitle",
    role: "coverSubtitle",
    type: "text",
    label: "Subtítulo",
    provenance: "empty",
    value: null,
    ...overrides,
  });
}

export function richTextBlock(overrides: Record<string, unknown> = {}): ComposedBlock {
  return ComposedBlockSchema.parse({
    id: "couple.groomText",
    role: "celebrantAText",
    type: "richText",
    label: "Mensaje",
    provenance: "user",
    value: {
      kind: "richText",
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Te prometo amor ", marks: [] },
              { type: "text", text: "eterno", marks: ["bold", "italic"] },
              { type: "text", text: " y visitar ", marks: [] },
              { type: "text", text: "nuestra historia", href: "https://ejemplo.mx/historia" },
            ],
          },
        ],
      },
    },
    ...overrides,
  });
}

export function imageBlock(overrides: Record<string, unknown> = {}): ComposedBlock {
  return ComposedBlockSchema.parse({
    id: "cover.image",
    role: "coverImage",
    type: "image",
    label: "Foto de portada",
    provenance: "user",
    value: {
      kind: "image",
      url: "https://cdn.ejemplo.mx/assets/portada.webp",
      alt: "Ana y Luis abrazados frente al mar",
      focal: { x: 0.5, y: 0.35 },
    },
    ...overrides,
  });
}

export function decorativeImageBlock(overrides: Record<string, unknown> = {}): ComposedBlock {
  return imageBlock({
    id: "footer.logo",
    role: "decorative",
    label: "Ornamento",
    value: {
      kind: "image",
      url: "https://cdn.ejemplo.mx/assets/ornamento.svg",
      alt: "",
      focal: { x: 0.5, y: 0.5 },
    },
    ...overrides,
  });
}

export function dateBlock(overrides: Record<string, unknown> = {}): ComposedBlock {
  return ComposedBlockSchema.parse({
    id: "cover.date",
    role: "coverDate",
    type: "date",
    label: "Fecha",
    provenance: "user",
    value: { kind: "date", value: "2026-12-12", formatted: "12 de diciembre de 2026" },
    ...overrides,
  });
}

export function groupBlock(overrides: Record<string, unknown> = {}): ComposedGroup {
  return ComposedGroupSchema.parse({
    id: "family.godparents",
    role: "familyGroup",
    type: "group",
    label: "Padrinos",
    provenance: "user",
    items: [
      {
        itemId: "01J8DEM0000000000000000GP1",
        blocks: [
          ComposedBlockSchema.parse({
            id: "person",
            role: "personName",
            type: "person",
            label: "Nombre",
            provenance: "user",
            value: { kind: "person", name: "Roberto Cruz" },
          }),
        ],
      },
      {
        itemId: "01J8DEM0000000000000000GP2",
        blocks: [
          ComposedBlockSchema.parse({
            id: "person",
            role: "personName",
            type: "person",
            label: "Nombre",
            provenance: "user",
            value: { kind: "person", name: "Carolina Aquino" },
          }),
        ],
      },
      {
        itemId: "01J8DEM0000000000000000GP3",
        blocks: [
          ComposedBlockSchema.parse({
            id: "person",
            role: "personName",
            type: "person",
            label: "Nombre",
            provenance: "user",
            value: { kind: "person", name: "Familia Gómez" },
          }),
        ],
      },
    ],
    ...overrides,
  });
}

export function composedSection(overrides: Record<string, unknown> = {}): ComposedSection {
  return ComposedSectionSchema.parse({
    key: "cover",
    type: "cover",
    variant: "full",
    visible: true,
    title: "Portada",
    blocks: [textBlock(), imageBlock()],
    ...overrides,
  });
}

/** Igual a `boda-clasica@1.0.0/theme.json` `palettes[0]` ("blush") — verificado [V] contra el archivo real. */
export function blushTheme(overrides: Record<string, unknown> = {}): ResolvedTheme {
  return ResolvedThemeSchema.parse({
    paletteId: "blush",
    fontSetId: "serif-elegante",
    tokens: {
      bg: "#FDF7F5",
      surface: "#FFFFFF",
      ink: "#3A2E2B",
      accent: "#C98B8B",
      accentInk: "#FFFFFF",
      muted: "#9A8A86",
    },
    fonts: {
      heading: { family: "Cormorant Garamond", weights: [400, 600], source: "google" },
      body: { family: "Inter", weights: [400, 500], source: "google" },
    },
    ...overrides,
  });
}

/** Igual a `boda-clasica@1.0.0/theme.json` `palettes[1]` ("olive") — verificado [V]. */
export function oliveTheme(overrides: Record<string, unknown> = {}): ResolvedTheme {
  return ResolvedThemeSchema.parse({
    paletteId: "olive",
    fontSetId: "serif-elegante",
    tokens: {
      bg: "#F7F5EE",
      surface: "#FFFFFF",
      ink: "#2F3A2B",
      accent: "#6B7B4A",
      accentInk: "#FFFFFF",
      muted: "#8A9178",
    },
    fonts: {
      heading: { family: "Cormorant Garamond", weights: [400, 600], source: "google" },
      body: { family: "Inter", weights: [400, 500], source: "google" },
    },
    ...overrides,
  });
}

/** Igual a `boda-clasica@1.0.0/theme.json` `palettes[2]` ("navy") — verificado [V]. */
export function navyTheme(overrides: Record<string, unknown> = {}): ResolvedTheme {
  return ResolvedThemeSchema.parse({
    paletteId: "navy",
    fontSetId: "serif-elegante",
    tokens: {
      bg: "#F4F6FA",
      surface: "#FFFFFF",
      ink: "#1E2A44",
      accent: "#2E4A7D",
      accentInk: "#FFFFFF",
      muted: "#7C889E",
    },
    fonts: {
      heading: { family: "Cormorant Garamond", weights: [400, 600], source: "google" },
      body: { family: "Inter", weights: [400, 500], source: "google" },
    },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------------------------
// AÑADIDO por 3-2b: documento REAL de `boda-clasica@1.0.0`, compuesto con el `compose()` de verdad
// (`@invitaciones/schema`) contra `frontend/templates/boda-clasica/1.0.0/{template,theme,defaults}
// .json`. `doc.structure.sections: []` + `doc.content: {}` deliberado: R1c inserta las 12 secciones
// del manifiesto en su posición y R2 cae a `defaults.json` para cada bloque — es decir, exactamente
// el contenido de fábrica de la plantilla real, sin inventar nada a mano en la prueba (04 §20.1,
// "jest-axe sobre tu sección con datos de boda-clasica"). Memoizado: `compose()` es puro (R6) y
// cada `describe` que lo usa no necesita recomponerlo.
// ---------------------------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const BODA_CLASICA_DIR = resolve(here, "../../../templates/boda-clasica/1.0.0");

function readJson(fileName: string): unknown {
  return JSON.parse(readFileSync(resolve(BODA_CLASICA_DIR, fileName), "utf8"));
}

/** `assetId` → URL falsa pero bien formada, solo para los assetId que `defaults.json` usa de verdad. */
const BODA_CLASICA_ASSETS: AssetIndex = {
  as_01J8DEM000000000000000C0V1: { url: "https://cdn.ejemplo.mx/assets/portada.webp" },
  as_01J8DEM000000000000000N0V1: { url: "https://cdn.ejemplo.mx/assets/novio.webp" },
  as_01J8DEM000000000000000N0V2: { url: "https://cdn.ejemplo.mx/assets/novia.webp" },
  as_01J8DEM0000000000000000GA1: { url: "https://cdn.ejemplo.mx/assets/galeria-1.webp" },
  as_01J8DEM0000000000000000GA2: { url: "https://cdn.ejemplo.mx/assets/galeria-2.webp" },
  as_01J8DEM000000000000000H1S1: { url: "https://cdn.ejemplo.mx/assets/historia-1.webp" },
  as_01J8DEM000000000000000RSV1: { url: "https://cdn.ejemplo.mx/assets/rsvp-fondo.webp" },
};

const BODA_CLASICA_BUSINESS: BusinessSnapshot = {
  invitationId: 1,
  date: "2026-12-12",
  time: "16:30",
  hashtag: "#CamilaYAntonio",
  coverPhotoUrl: null,
  childrenAllowed: true,
  youngAllowed: true,
  eventKind: "wedding",
  planTier: 2,
  timezone: "America/Mexico_City",
};

let bodaClasicaComposedCache: ComposedDocument | undefined;

/** El `ComposedDocument` real de `boda-clasica@1.0.0` con TODO su contenido de fábrica. */
export function realBodaClasicaDocument(): ComposedDocument {
  if (bodaClasicaComposedCache) return bodaClasicaComposedCache;
  const pkg: TemplatePackage = {
    manifest: TemplateManifest.parse(readJson("template.json")),
    theme: ThemeSpec.parse(readJson("theme.json")),
    defaults: DefaultsFile.parse(readJson("defaults.json")),
  };
  const doc = {
    schemaVersion: 1 as const,
    template: { slug: "boda-clasica", version: "1.0.0" },
    theme: { paletteId: "blush", fontSetId: "serif-elegante" },
    structure: { sections: [] },
    content: {},
    attic: {},
    meta: { locale: "es-MX" as const },
  };
  const { composed } = compose(pkg, doc, BODA_CLASICA_BUSINESS, BODA_CLASICA_ASSETS, "es-MX");
  bodaClasicaComposedCache = composed;
  return composed;
}

/** Una sección concreta (por `key`, p. ej. "cover"/"event"/"gallery") del documento real de arriba. */
export function realBodaClasicaSection(key: string): ComposedSection {
  const section = realBodaClasicaDocument().sections.find((s) => s.key === key);
  if (!section) throw new Error(`fixtures.ts: boda-clasica@1.0.0 no tiene la sección "${key}"`);
  return section;
}
