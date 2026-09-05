// packages/sections/test/celebrant.test.tsx — 3-2b, CelebrantSection.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { CelebrantSection } from "../src/sections/CelebrantSection.tsx";
import { composedSection, textBlock, richTextBlock, imageBlock, realBodaClasicaSection } from "./fixtures.ts";
import { ComposedBlockSchema } from "./schema-values.ts";

function personBlock(overrides: Record<string, unknown> = {}) {
  return ComposedBlockSchema.parse({
    id: "couple.groom",
    role: "celebrantA",
    type: "person",
    label: "Novio",
    provenance: "user",
    value: { kind: "person", name: "Antonio" },
    ...overrides,
  });
}

function celebrant(overrides: Record<string, unknown> = {}) {
  return composedSection({
    key: "couple",
    type: "celebrant",
    title: "Los novios",
    blocks: [
      textBlock({ id: "couple.heading", role: "celebrantsHeading", value: { kind: "text", value: "Save the date!" } }),
      personBlock(),
      personBlock({ id: "couple.bride", role: "celebrantB", value: { kind: "person", name: "Camila" } }),
      imageBlock({ id: "couple.groomPhoto", role: "celebrantAPhoto" }),
      imageBlock({ id: "couple.bridePhoto", role: "celebrantBPhoto" }),
      richTextBlock({ id: "couple.groomText", role: "celebrantAText" }),
      richTextBlock({ id: "couple.brideText", role: "celebrantBText" }),
    ],
    ...overrides,
  });
}

describe("CelebrantSection — variantes soportadas", () => {
  for (const variant of ["side-by-side", "stacked", "centered"]) {
    it(`pinta data-variant="${variant}" sin lanzar, con ambas personas`, () => {
      const { container } = render(<CelebrantSection section={celebrant()} variant={variant} mode="public" />);
      expect(container.querySelector("section")!.getAttribute("data-variant")).toBe(variant);
      expect(container.textContent).toContain("Antonio");
      expect(container.textContent).toContain("Camila");
    });
  }
});

describe("CelebrantSection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it('data-variant refleja "side-by-side" (defaultVariant)', () => {
    const { container } = render(<CelebrantSection section={celebrant()} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("side-by-side");
  });

  it("avisa por consola solo en canvas", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<CelebrantSection section={celebrant()} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<CelebrantSection section={celebrant()} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("CelebrantSection — un solo homenajeadx (xv-jardin: honoree) sin celebrantA/B", () => {
  it("renderiza una sola tarjeta y no lanza", () => {
    const section = celebrant({
      key: "honoree",
      type: "celebrant",
      title: "La quinceañera",
      blocks: [
        ComposedBlockSchema.parse({
          id: "honoree.person",
          role: "honoree",
          type: "person",
          label: "Quinceañera",
          provenance: "user",
          value: { kind: "person", name: "Valentina" },
        }),
        imageBlock({ id: "honoree.photo", role: "honoreePhoto" }),
        richTextBlock({ id: "honoree.message", role: "honoreeMessage" }),
      ],
    });
    const { container } = render(<CelebrantSection section={section} variant="centered" mode="public" />);
    expect(container.textContent).toContain("Valentina");
    expect(container.querySelector("section")!.getAttribute("data-people")).toBe("1");
  });
});

describe("CelebrantSection — value:null por rol no rompe ni pinta un hueco", () => {
  it("celebrantA/B en null: no lanza y no deja una tarjeta vacía", () => {
    const section = celebrant({
      blocks: [
        personBlock({ value: null, provenance: "empty" }),
        personBlock({ id: "couple.bride", role: "celebrantB", value: null, provenance: "empty" }),
      ],
    });
    const { container } = render(<CelebrantSection section={section} variant="side-by-side" mode="public" />);
    expect(() => container).not.toThrow();
    expect(container.querySelectorAll("h3").length).toBe(0);
  });

  it("sin ningún bloque, la sección monta su <h2> igual", () => {
    const section = celebrant({ blocks: [] });
    const { container } = render(<CelebrantSection section={section} variant="side-by-side" mode="public" />);
    const heading = container.querySelector("h2")!;
    expect(heading.textContent).toBe("Los novios");
  });
});

describe("CelebrantSection — R5: un rol que no contempla no se pinta", () => {
  it('un bloque con rol "dressCodeTitle" no aparece', () => {
    const strayBlock = ComposedBlockSchema.parse({
      id: "couple.stray",
      role: "dressCodeTitle",
      type: "text",
      label: "Nota",
      provenance: "user",
      value: { kind: "text", value: "esto no debería pintarse" },
    });
    const section = celebrant({ blocks: [strayBlock] });
    const { container } = render(<CelebrantSection section={section} variant="side-by-side" mode="public" />);
    expect(container.textContent).not.toContain("esto no debería pintarse");
  });
});

describe("CelebrantSection — mode público vs canvas", () => {
  it("mode=public no lleva data-block-*", () => {
    const { container } = render(<CelebrantSection section={celebrant()} variant="side-by-side" mode="public" />);
    expect(container.querySelectorAll("[data-block-id]").length).toBe(0);
  });

  it("mode=canvas SÍ marca los bloques activables", () => {
    const { container } = render(
      <CelebrantSection section={celebrant()} variant="side-by-side" mode="canvas" onActivate={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-block-id]").length).toBeGreaterThan(0);
  });
});

describe("CelebrantSection — estructura semántica", () => {
  it("un <h2> visible + un <h3> por persona con nombre", () => {
    const { container } = render(<CelebrantSection section={celebrant()} variant="side-by-side" mode="public" />);
    expect(container.querySelectorAll("h2").length).toBe(1);
    expect(container.querySelectorAll("h3").length).toBe(2);
    const heading = container.querySelector("h2")!;
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe(heading.id);
  });
});

describe("CelebrantSection — jest-axe con datos reales de boda-clasica@1.0.0", () => {
  for (const variant of ["side-by-side", "stacked", "centered"]) {
    it(`cero violaciones (variant=${variant})`, async () => {
      const section = realBodaClasicaSection("couple");
      const { container } = render(<CelebrantSection section={section} variant={variant} mode="public" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }
});
