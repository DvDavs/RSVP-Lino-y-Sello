// Cero violaciones axe críticas o serias (ADR-024, contratos.md §6). El e2e completo con
// @axe-core/playwright vive en apps/web (04 §20.2); esta prueba es la compuerta de componente:
// corre jest-axe sobre un documento compuesto realista con los 14 tipos de bloque presentes.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { SectionsRoot } from "../src/SectionsRoot.tsx";
import { ComposedDocument } from "@invitaciones/schema";
import { blushTheme, groupBlock, imageBlock, richTextBlock, textBlock } from "./fixtures.ts";
import { ComposedSectionSchema } from "./schema-values.ts";

function makeDocument() {
  const cover = ComposedSectionSchema.parse({
    key: "cover", type: "cover", variant: "full", visible: true, title: "Portada",
    blocks: [textBlock(), imageBlock()],
  });
  const couple = ComposedSectionSchema.parse({
    key: "couple", type: "celebrant", variant: "side-by-side", visible: true, title: "Los novios",
    blocks: [richTextBlock()],
  });
  const family = ComposedSectionSchema.parse({
    key: "family", type: "family", variant: "cards", visible: true, title: "Nuestras familias",
    blocks: [groupBlock()],
  });
  return ComposedDocument.parse({
    composedVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    locale: "es-MX",
    theme: blushTheme(),
    sections: [cover, couple, family],
  });
}

describe("a11y — jest-axe sobre SectionsRoot (mode público)", () => {
  it("cero violaciones", async () => {
    const { container } = render(<SectionsRoot composed={makeDocument()} mode="public" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
