import { describe, expect, it } from "vitest";
import type { ComposedDocument } from "@invitaciones/schema";
import { fechaDe, fondoSeguroDe, portadaDe, subtituloDe, tituloDe } from "./composed-lectura";

// app/(public)/_componentes/composed-lectura.test.ts — la lectura del documento para los metadatos
// y el `<h1>` (04 §15.4 / §17.3). Es la única lógica propia de la ruta pública, y decide qué sale
// de la invitación hacia una tarjeta de enlace: se prueba, en particular, qué NO debe salir.

function doc(secciones: unknown[], tokens: Record<string, string> = {}): ComposedDocument {
  return {
    theme: {
      tokens: { bg: "#FDF7F5", surface: "#FFFFFF", ink: "#3A2E2B", accent: "#B35B5B", accentInk: "#FFFFFF", muted: "#9A8A86", ...tokens },
      fonts: { heading: { family: "Cormorant Garamond", weights: [400], source: "google" }, body: { family: "Inter", weights: [400], source: "google" } },
      paletteId: "blush",
      fontSetId: "serif-elegante",
    },
    locale: "es-MX",
    sections: secciones,
    template: { slug: "boda-clasica", version: "1.0.0" },
    composedVersion: 1,
  } as unknown as ComposedDocument;
}

const seccionPortada = (visible: boolean, extra: unknown[] = []) => ({
  key: "cover",
  type: "cover",
  variant: "full",
  visible,
  title: "Portada",
  blocks: [
    { id: "cover.title", role: "coverTitle", type: "text", value: { kind: "text", value: "  Ana Sofía & Diego  " } },
    { id: "cover.subtitle", role: "coverSubtitle", type: "text", value: { kind: "text", value: "Nos casamos" } },
    { id: "cover.date", role: "coverDate", type: "date", value: { kind: "date", value: "2027-04-18", formatted: "18 de abril de 2027" } },
    ...extra,
  ],
});

describe("lectura del documento compuesto para la página pública", () => {
  it("saca el título, el subtítulo y la fecha de portada por ROL, y recorta el espacio sobrante", () => {
    const d = doc([seccionPortada(true)]);
    expect(tituloDe(d)).toBe("Ana Sofía & Diego");
    expect(subtituloDe(d)).toBe("Nos casamos");
    expect(fechaDe(d)).toBe("18 de abril de 2027");
  });

  it("NO lee nada de una sección oculta: lo que el invitado no ve, tampoco viaja a los metadatos", () => {
    const d = doc([seccionPortada(false)]);
    expect(tituloDe(d)).toBeNull();
    expect(subtituloDe(d)).toBeNull();
    expect(portadaDe(d)).toBeNull();
  });

  it("devuelve null cuando el bloque existe pero está vacío, sin inventar un valor (P1)", () => {
    const d = doc([
      {
        key: "cover",
        type: "cover",
        variant: "full",
        visible: true,
        title: "Portada",
        blocks: [{ id: "cover.title", role: "coverTitle", type: "text", value: null }],
      },
    ]);
    expect(tituloDe(d)).toBeNull();
  });

  it("un texto de solo espacios cuenta como ausente, no como título vacío", () => {
    const d = doc([
      {
        key: "cover",
        type: "cover",
        variant: "full",
        visible: true,
        title: "Portada",
        blocks: [{ id: "cover.title", role: "coverTitle", type: "text", value: { kind: "text", value: "   " } }],
      },
    ]);
    expect(tituloDe(d)).toBeNull();
  });

  it("ignora los grupos al buscar por rol (un ComposedGroup no tiene `value`)", () => {
    const d = doc([
      {
        key: "family",
        type: "family",
        variant: "cards",
        visible: true,
        title: "Padres",
        blocks: [{ id: "family.list", role: "coverTitle", type: "group", items: [] }],
      },
      seccionPortada(true),
    ]);
    // El grupo lleva el mismo rol a propósito: si se leyera, `value` sería `undefined` y el título
    // saldría vacío. Debe saltárselo y quedarse con el de la portada.
    expect(tituloDe(d)).toBe("Ana Sofía & Diego");
  });

  it("resuelve la portada por `coverImage` y cae a `coverBackground` si no la hay", () => {
    const conImagen = doc([
      seccionPortada(true, [
        { id: "cover.image", role: "coverImage", type: "image", value: { kind: "image", url: "http://x/a.webp", alt: "Guirnalda" } },
      ]),
    ]);
    expect(portadaDe(conImagen)).toEqual({ url: "http://x/a.webp", alt: "Guirnalda" });

    const soloFondo = doc([
      seccionPortada(true, [
        { id: "cover.bg", role: "coverBackground", type: "image", value: { kind: "image", url: "http://x/b.webp", alt: "" } },
      ]),
    ]);
    expect(portadaDe(soloFondo)).toEqual({ url: "http://x/b.webp", alt: "" });
  });

  it("acepta el fondo solo si es un #rrggbb — un valor fuera de forma nunca se interpola en el <style>", () => {
    expect(fondoSeguroDe(doc([], { bg: "#FDF7F5" }))).toBe("#FDF7F5");
    expect(fondoSeguroDe(doc([], { bg: "rojo" }))).toBeNull();
    expect(fondoSeguroDe(doc([], { bg: "#FFF" }))).toBeNull();
    expect(fondoSeguroDe(doc([], { bg: "#fff;} body{display:none" }))).toBeNull();
  });

  it("lee richText como una sola línea de texto plano, sin etiquetas", () => {
    const d = doc([
      {
        key: "cover",
        type: "cover",
        variant: "full",
        visible: true,
        title: "Portada",
        blocks: [
          {
            id: "cover.subtitle",
            role: "coverSubtitle",
            type: "richText",
            value: {
              kind: "richText",
              doc: {
                type: "doc",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Nos " }, { type: "text", text: "casamos" }] },
                  { type: "paragraph", content: [{ type: "text", text: "en abril" }] },
                ],
              },
            },
          },
        ],
      },
    ]);
    expect(subtituloDe(d)).toBe("Nos casamos en abril");
  });
});
