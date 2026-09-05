// packages/sections/test/harness-c/data.ts — un `ComposedDocument` por sección para el banco de
// capturas (TAREA 3 del brief 3-2c). Parte de la sección REAL de
// `packages/schema/golden/templates/boda-clasica-1.0.0/compuesto.json` (mismo golden que usan las
// pruebas unitarias, `test/golden-c.ts`) y solo AÑADE lo que el golden no trae — más ítems de
// grupo e imágenes — para que la captura muestre una grilla real y no una tarjeta solitaria. Cada
// añadido se documenta: nunca se inventa un dato de negocio, solo se completa contenido editorial
// plausible del mismo tipo que ya declara el manifiesto (p. ej. una segunda opción de regalo).
//
// NO reutiliza `../golden-c.ts` (deliberado): ese módulo lee el golden con `node:fs`, que Vitest
// ejecuta en Node — pero este archivo lo importa `main.tsx`, que Vite empaqueta para el
// NAVEGADOR. `node:fs` se "externaliza" ahí y `readFileSync` lanza en tiempo de ejecución (medido
// [V]: "Module 'node:fs' has been externalized for browser compatibility"). En su lugar se
// importa el MISMO `compuesto.json` como módulo JSON (soportado nativamente por Vite, sin tocar
// disco en el navegador) y se replica aquí la extracción por tipo, sin duplicar lectura de disco.
import { ComposedDocument } from "@invitaciones/schema";
import { ComposedBlockSchema, ComposedGroupSchema, ComposedSectionSchema } from "../schema-values.ts";
import type { ComposedSection, ResolvedTheme } from "../../src/schema-types.ts";
import goldenRaw from "../../../schema/golden/templates/boda-clasica-1.0.0/compuesto.json" with { type: "json" };
import { placeholderPhoto } from "./placeholder-image.ts";

const GOLDEN = ComposedDocument.parse(goldenRaw);

function goldenSection(type: string): ComposedSection {
  const section = GOLDEN.sections.find((s) => s.type === type);
  if (section === undefined) {
    throw new Error(`data.ts: boda-clasica-1.0.0/compuesto.json no tiene una sección "${type}"`);
  }
  return section as ComposedSection;
}

function goldenTheme(): ResolvedTheme {
  return GOLDEN.theme as ResolvedTheme;
}

function withGroupItems(
  section: ComposedSection,
  groupRole: string,
  extraItems: ReadonlyArray<Record<string, unknown>>,
): ComposedSection {
  const blocks = section.blocks.map((block) => {
    if (block.role !== groupRole || !("items" in block)) return block;
    return ComposedGroupSchema.parse({
      ...block,
      items: [...block.items, ...extraItems],
    });
  });
  return ComposedSectionSchema.parse({ ...section, visible: true, blocks });
}

function image(role: string, id: string, seed: number, alt: string) {
  return ComposedBlockSchema.parse({
    id, role, type: "image", label: "Imagen", provenance: "user",
    value: { kind: "image", url: placeholderPhoto(seed), alt, focal: { x: 0.5, y: 0.4 } },
  });
}

const giftTable = withGroupItems(goldenSection("giftTable"), "giftOptions", [
  {
    itemId: "01J8DEM0000000000000000GF2",
    blocks: [
      ComposedBlockSchema.parse({
        id: "kind", role: "giftOptionKind", type: "choice", label: "Tipo", provenance: "user",
        value: { kind: "choice", optionId: "store", label: "Mesa en tienda" },
      }),
      ComposedBlockSchema.parse({
        id: "title", role: "giftOptionTitle", type: "text", label: "Título", provenance: "user",
        value: { kind: "text", value: "Mesa de regalos Liverpool" },
      }),
      ComposedBlockSchema.parse({
        id: "detail", role: "giftOptionDetail", type: "listText", label: "Detalles", provenance: "user",
        value: { kind: "listText", items: ["Evento: 48231"] },
      }),
      ComposedBlockSchema.parse({
        id: "link", role: "giftOptionLink", type: "link", label: "Enlace", provenance: "user",
        value: { kind: "link", href: "https://www.liverpool.com.mx/tienda/mesaderegalos" },
      }),
      image("giftOptionImage", "image", 1, ""),
    ],
  },
  {
    itemId: "01J8DEM0000000000000000GF3",
    blocks: [
      ComposedBlockSchema.parse({
        id: "kind", role: "giftOptionKind", type: "choice", label: "Tipo", provenance: "user",
        value: { kind: "choice", optionId: "cash", label: "Lluvia de sobres" },
      }),
      ComposedBlockSchema.parse({
        id: "title", role: "giftOptionTitle", type: "text", label: "Título", provenance: "user",
        value: { kind: "text", value: "Lluvia de sobres" },
      }),
      ComposedBlockSchema.parse({
        id: "detail", role: "giftOptionDetail", type: "listText", label: "Detalles", provenance: "user",
        value: { kind: "listText", items: ["Habrá una urna en la recepción"] },
      }),
      image("giftOptionImage", "image", 2, ""),
    ],
  },
]);

const suggestions = withGroupItems(goldenSection("suggestions"), "suggestionList", [
  {
    itemId: "01J8DEM0000000000000000SG2",
    blocks: [
      ComposedBlockSchema.parse({
        id: "name", role: "suggestionName", type: "text", label: "Nombre", provenance: "user",
        value: { kind: "text", value: "Hotel Camino Real Oaxaca" },
      }),
      ComposedBlockSchema.parse({
        id: "detail", role: "suggestionDetail", type: "listText", label: "Detalles", provenance: "user",
        value: { kind: "listText", items: ["A 10 min del salón", "Tarifa preferencial con el código BODA26"] },
      }),
      ComposedBlockSchema.parse({
        id: "link", role: "suggestionLink", type: "link", label: "Enlace", provenance: "user",
        value: { kind: "link", href: "https://www.caminoreal.com/oaxaca" },
      }),
      image("suggestionImage", "image", 3, ""),
    ],
  },
]);

const amenities = withGroupItems(goldenSection("amenities"), "amenityList", [
  {
    itemId: "01J8DEM0000000000000000AM2",
    blocks: [
      ComposedBlockSchema.parse({
        id: "name", role: "amenityName", type: "text", label: "Nombre", provenance: "user",
        value: { kind: "text", value: "Transporte al salón" },
      }),
      ComposedBlockSchema.parse({
        id: "detail", role: "amenityDetail", type: "listText", label: "Detalles", provenance: "user",
        value: { kind: "listText", items: ["Camión saliendo del hotel sede a las 16:00"] },
      }),
      image("amenityImage", "image", 4, ""),
    ],
  },
]);

const family = withGroupItems(goldenSection("family"), "familyGroup", [
  {
    itemId: "01J8DEM0000000000000000GP2",
    blocks: [
      ComposedBlockSchema.parse({
        id: "person", role: "personName", type: "person", label: "Nombre", provenance: "user",
        value: { kind: "person", name: "Fernando Ibarra y Lucía Ponce" },
      }),
      ComposedBlockSchema.parse({
        id: "label", role: "personLabel", type: "text", label: "De qué", provenance: "user",
        value: { kind: "text", value: "Padrinos de anillos" },
      }),
      image("personPhoto", "photo", 5, ""),
    ],
  },
  {
    itemId: "01J8DEM0000000000000000GP3",
    blocks: [
      ComposedBlockSchema.parse({
        id: "person", role: "personName", type: "person", label: "Nombre", provenance: "user",
        value: { kind: "person", name: "Sofía Ramírez" },
      }),
      ComposedBlockSchema.parse({
        id: "label", role: "personLabel", type: "text", label: "De qué", provenance: "user",
        value: { kind: "text", value: "Madrina de lazo" },
      }),
      image("personPhoto", "photo", 6, ""),
    ],
  },
]);
// El primer ítem del golden real no trae foto (provenance:"empty") — se completa con una
// miniatura para que la grilla no muestre un hueco vacío junto a las dos nuevas.
const familyWithPhoto = ComposedSectionSchema.parse({
  ...family,
  blocks: family.blocks.map((block) => {
    if (block.role !== "familyGroup" || !("items" in block)) return block;
    return ComposedGroupSchema.parse({
      ...block,
      items: block.items.map((item, index) =>
        index === 0
          ? {
              ...item,
              blocks: item.blocks.map((b) => (b.role === "personPhoto" ? image("personPhoto", "photo", 0, "") : b)),
            }
          : item,
      ),
    });
  }),
});

const rsvp = ComposedSectionSchema.parse({
  ...goldenSection("rsvp"),
  blocks: goldenSection("rsvp").blocks.map((block) => {
    if (block.role === "rsvpDeadline") {
      return ComposedBlockSchema.parse({
        ...block,
        provenance: "user",
        value: { kind: "date", value: "2026-12-01", formatted: "1 de diciembre de 2026" },
      });
    }
    if (block.role === "rsvpBackground") {
      return image("rsvpBackground", block.id, 7, "");
    }
    return block;
  }),
});

const footer = ComposedSectionSchema.parse({
  ...goldenSection("footer"),
  blocks: [
    ...goldenSection("footer").blocks,
    ComposedBlockSchema.parse({
      id: "footer.link", role: "footerLink", type: "link", label: "Enlace", provenance: "user",
      value: { kind: "link", href: "https://www.instagram.com/camilayantonio", label: "@camilayantonio" },
    }),
  ],
});

function documentOf(section: ComposedSection): ComposedDocument {
  return ComposedDocument.parse({
    composedVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    locale: "es-MX",
    theme: goldenTheme(),
    sections: [section],
  });
}

export const HARNESS_DOCS: Readonly<Record<string, ComposedDocument>> = {
  giftTable: documentOf(giftTable),
  suggestions: documentOf(suggestions),
  amenities: documentOf(amenities),
  rsvp: documentOf(rsvp),
  family: documentOf(familyWithPhoto),
  footer: documentOf(footer),
};
