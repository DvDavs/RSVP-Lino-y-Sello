// packages/sections/test/amenities.test.tsx — `AmenitiesSection` (tipo `amenities`, 01 §3.1).
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { AmenitiesSection } from "../src/sections/AmenitiesSection.tsx";
import { SectionsRoot } from "../src/SectionsRoot.tsx";
import { ComposedDocument } from "@invitaciones/schema";
import { ComposedBlockSchema, ComposedSectionSchema } from "../src/schema-types.ts";
import { goldenSection, goldenTheme } from "./golden-c.ts";

// El golden real de boda-clasica trae `amenities.visible: false` (04 §17.3 solo exige
// estructura semántica cuando SÍ se pinta; se fuerza `visible:true` aquí porque estas pruebas
// afirman sobre el DOM de la sección misma, no sobre `SectionsRoot` filtrando invisibles).
const REAL_SECTION = { ...goldenSection("amenities"), visible: true };

function withRoot(section: typeof REAL_SECTION, mode: "public" | "canvas", onActivate?: () => void) {
  const doc = ComposedDocument.parse({
    composedVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    locale: "es-MX",
    theme: goldenTheme(),
    sections: [section],
  });
  return render(<SectionsRoot composed={doc} mode={mode} onActivate={onActivate} />);
}

describe("AmenitiesSection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it("variant fuera de supportedVariants ⇒ data-variant='cards' (defaultVariant)", () => {
    const { container } = render(
      <AmenitiesSection section={REAL_SECTION} variant="no-existe" mode="public" />,
    );
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("cards");
  });

  it("avisa por consola SOLO en mode='canvas'", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<AmenitiesSection section={REAL_SECTION} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<AmenitiesSection section={REAL_SECTION} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe("AmenitiesSection — variante 'list' también renderiza", () => {
  it("data-variant='list' sin lanzar", () => {
    const { container } = render(<AmenitiesSection section={REAL_SECTION} variant="list" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("list");
  });
});

describe("AmenitiesSection — value:null en cada rol propio no rompe (R2/R5)", () => {
  const emptySection = ComposedSectionSchema.parse({
    key: "amenities", type: "amenities", variant: "cards", visible: true, title: "Amenidades",
    blocks: [
      ComposedBlockSchema.parse({
        id: "amenities.title", role: "sectionTitle", type: "text", label: "Título",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "amenities.intro", role: "sectionIntro", type: "text", label: "Introducción",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "amenities.background", role: "sectionBackground", type: "image", label: "Fondo",
        provenance: "empty", value: null,
      }),
    ],
  });

  it("no lanza y cae al título fijo del manifiesto", () => {
    const { container } = render(<AmenitiesSection section={emptySection} variant="cards" mode="public" />);
    expect(container.querySelector("h2")!.textContent).toBe("Amenidades");
  });
});

describe("AmenitiesSection — mode='public' no lleva data-block-*", () => {
  it("cero atributos data-block-id/data-item-id/data-item-block-id", () => {
    const { container } = withRoot(REAL_SECTION, "public");
    expect(container.querySelectorAll("[data-block-id], [data-item-id], [data-item-block-id]").length).toBe(0);
  });

  it("mode='canvas' sí los lleva", () => {
    const { container } = withRoot(REAL_SECTION, "canvas", vi.fn());
    expect(container.querySelectorAll("[data-block-id]").length).toBeGreaterThan(0);
  });
});

describe("AmenitiesSection — el enlace real del golden lleva rel seguro", () => {
  it("target=_blank, rel=noopener noreferrer", () => {
    const { container } = render(<AmenitiesSection section={REAL_SECTION} variant="cards" mode="public" />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("AmenitiesSection — a11y (jest-axe, datos reales de boda-clasica)", () => {
  it("cero violaciones", async () => {
    const { container } = withRoot(REAL_SECTION, "public");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
