// packages/sections/test/family.test.tsx — `FamilySection` (tipo `family`, 01 §3.1).
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { FamilySection } from "../src/sections/FamilySection.tsx";
import { SectionsRoot } from "../src/SectionsRoot.tsx";
import { ComposedDocument } from "@invitaciones/schema";
import { ComposedBlockSchema, ComposedSectionSchema } from "../src/schema-types.ts";
import { goldenSection, goldenTheme } from "./golden-c.ts";

const REAL_SECTION = goldenSection("family");

function withRoot(section: ReturnType<typeof goldenSection>, mode: "public" | "canvas", onActivate?: () => void) {
  const doc = ComposedDocument.parse({
    composedVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    locale: "es-MX",
    theme: goldenTheme(),
    sections: [section],
  });
  return render(<SectionsRoot composed={doc} mode={mode} onActivate={onActivate} />);
}

describe("FamilySection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it("variant fuera de supportedVariants ⇒ data-variant='cards' (defaultVariant)", () => {
    const { container } = render(<FamilySection section={REAL_SECTION} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("cards");
  });

  it("avisa por consola SOLO en mode='canvas'", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<FamilySection section={REAL_SECTION} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<FamilySection section={REAL_SECTION} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe("FamilySection — variante 'list' también renderiza", () => {
  it("data-variant='list' sin lanzar", () => {
    const { container } = render(<FamilySection section={REAL_SECTION} variant="list" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("list");
  });
});

describe("FamilySection — cada padre usa `block.label` real como etiqueta (dato del manifiesto, no inventado)", () => {
  it("el nombre de parentA1 aparece junto a su etiqueta ('Madre del novio')", () => {
    const { container } = render(<FamilySection section={REAL_SECTION} variant="cards" mode="public" />);
    expect(container.textContent).toContain("María Rocha Luis");
    expect(container.textContent).toContain("Madre del novio");
  });
});

describe("FamilySection — el grupo de padrinos cae al `group.label` del manifiesto sin familyGroupTitle", () => {
  it("pinta 'Padrinos' como h3 (label del grupo, no un bloque de contenido)", () => {
    const { container } = render(<FamilySection section={REAL_SECTION} variant="cards" mode="public" />);
    const h3 = Array.from(container.querySelectorAll("h3")).map((n) => n.textContent);
    expect(h3).toContain("Padrinos");
  });
});

describe("FamilySection — value:null en cada rol propio no rompe (R2/R5)", () => {
  const emptySection = ComposedSectionSchema.parse({
    key: "family", type: "family", variant: "cards", visible: true, title: "Nuestros padres y padrinos",
    blocks: [
      ComposedBlockSchema.parse({
        id: "family.title", role: "sectionTitle", type: "text", label: "Título",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "family.intro", role: "familyIntro", type: "listText", label: "Frases",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "family.parentA1", role: "parentA1", type: "person", label: "Madre del novio",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "family.background", role: "sectionBackground", type: "image", label: "Fondo",
        provenance: "empty", value: null,
      }),
    ],
  });

  it("no lanza y cae al título fijo del manifiesto, sin columnas de padres", () => {
    const { container } = render(<FamilySection section={emptySection} variant="cards" mode="public" />);
    expect(container.querySelector("h2")!.textContent).toBe("Nuestros padres y padrinos");
    expect(container.textContent).not.toContain("Madre del novio");
  });
});

describe("FamilySection — mode='public' no lleva data-block-*", () => {
  it("cero atributos data-block-id/data-item-id/data-item-block-id", () => {
    const { container } = withRoot(REAL_SECTION, "public");
    expect(container.querySelectorAll("[data-block-id], [data-item-id], [data-item-block-id]").length).toBe(0);
  });

  it("mode='canvas' sí los lleva (incluidos los padres sueltos, roles singleton)", () => {
    const { container } = withRoot(REAL_SECTION, "canvas", vi.fn());
    expect(container.querySelectorAll("[data-block-id]").length).toBeGreaterThan(0);
  });
});

describe("FamilySection — a11y (jest-axe, datos reales de boda-clasica)", () => {
  it("cero violaciones", async () => {
    const { container } = withRoot(REAL_SECTION, "public");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
