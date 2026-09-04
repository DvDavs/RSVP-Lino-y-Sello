// test/fixtures/composed.ts — documento compuesto mínimo para las pruebas del núcleo del editor.
//
// Se construye a mano en vez de copiar un golden entero (que son de `packages/schema`, de solo
// lectura, y traen 12 secciones): estas pruebas comprueban REGLAS del núcleo (inversas,
// coalescencia, reescritura de ids, conflicto), no la composición — de eso ya hay 505 pruebas en
// `packages/schema`. Cada objeto valida contra los esquemas de `composed.ts`.
import type { ComposedDocument, InvitationDocument } from "@invitaciones/schema";

export const ULID_A = "01J8ZQ5W9K3TQY7B4N2XCVMR6H";
export const ULID_B = "01J8ZQ5W9K3TQY7B4N2XCVMR7J";

export function composedFixture(): ComposedDocument {
  return {
    composedVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    locale: "es-MX",
    theme: {
      paletteId: "olivo",
      fontSetId: "serif-clasica",
      tokens: {
        bg: "#ffffff",
        surface: "#ffffff",
        ink: "#16130f",
        accent: "#3a3630",
        accentInk: "#ffffff",
        muted: "#6b655c",
      },
      fonts: {
        heading: { family: "Fraunces", weights: [400, 700], source: "bundled" },
        body: { family: "Inter", weights: [400], source: "bundled" },
      },
    },
    sections: [
      {
        key: "cover",
        type: "cover",
        variant: "centrada",
        visible: true,
        title: "Portada",
        blocks: [
          {
            id: "cover.title",
            role: "coverTitle",
            type: "text",
            label: "Título de la portada",
            // El caso que importa para U-09: contenido de DEMOSTRACIÓN, no del usuario.
            provenance: "default",
            value: { kind: "text", value: "Nuestra boda" },
          },
          {
            id: "cover.subtitle",
            role: "coverSubtitle",
            type: "text",
            label: "Subtítulo de la portada",
            provenance: "user",
            value: { kind: "text", value: "Te esperamos" },
          },
          {
            id: "cover.date",
            role: "coverDate",
            type: "date",
            label: "Fecha",
            provenance: "business",
            value: { kind: "date", value: "2026-11-14", formatted: "14 de noviembre de 2026" },
          },
        ],
      },
      {
        key: "gallery",
        type: "gallery",
        variant: "mosaico",
        visible: true,
        title: "Galería",
        blocks: [
          {
            id: "gallery.photos",
            role: "galleryPhotos",
            type: "group",
            label: "Fotos",
            provenance: "user",
            items: [
              {
                itemId: ULID_A,
                blocks: [
                  {
                    id: "caption",
                    role: "galleryPhoto",
                    type: "text",
                    label: "Pie de foto",
                    provenance: "empty",
                    value: null,
                  },
                ],
              },
              {
                itemId: ULID_B,
                blocks: [
                  {
                    id: "caption",
                    role: "galleryPhoto",
                    type: "text",
                    label: "Pie de foto",
                    provenance: "user",
                    value: { kind: "text", value: "En la playa" },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        key: "story",
        type: "story",
        variant: "linea",
        visible: true,
        title: "Nuestra historia",
        blocks: [],
      },
    ],
  };
}

/** Documento crudo coherente con el compuesto: `cover.title` NO tiene valor de usuario (H-03). */
export function documentFixture(): InvitationDocument {
  return {
    schemaVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    theme: { paletteId: "olivo", fontSetId: "serif-clasica" },
    structure: {
      sections: [
        { key: "cover", variant: "centrada", visible: true },
        { key: "gallery", variant: "mosaico", visible: true },
        { key: "story", variant: "linea", visible: true },
      ],
    },
    content: {
      "cover.subtitle": { kind: "text", value: "Te esperamos" },
      "gallery.photos": {
        kind: "group",
        items: [
          { itemId: ULID_A, values: {} },
          { itemId: ULID_B, values: { caption: { kind: "text", value: "En la playa" } } },
        ],
      },
    },
    attic: {},
    meta: { locale: "es-MX" },
  };
}
