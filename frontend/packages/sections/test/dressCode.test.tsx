// packages/sections/test/dressCode.test.tsx — 3-2b, DressCodeSection.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { DressCodeSection } from "../src/sections/DressCodeSection.tsx";
import { composedSection, textBlock, realBodaClasicaSection } from "./fixtures.ts";
import { ComposedBlockSchema, ComposedGroupSchema } from "../src/schema-types.ts";

function ruleItem(itemId: string, title: string, detail: string) {
  return {
    itemId,
    blocks: [
      ComposedBlockSchema.parse({
        id: "title",
        role: "dressCodeTitle",
        type: "text",
        label: "Para quién",
        provenance: "user",
        value: { kind: "text", value: title },
      }),
      ComposedBlockSchema.parse({
        id: "detail",
        role: "dressCodeDetail",
        type: "text",
        label: "Descripción",
        provenance: "user",
        value: { kind: "text", value: detail },
      }),
    ],
  };
}

function rulesGroup(overrides: Record<string, unknown> = {}) {
  return ComposedGroupSchema.parse({
    id: "dressCode.rules",
    role: "dressCodeRules",
    type: "group",
    label: "Reglas",
    provenance: "user",
    items: [
      ruleItem("01J8DEM0000000000000000DC1", "Damas", "Vestido largo o corto."),
      ruleItem("01J8DEM0000000000000000DC2", "Caballeros", "Traje o esmoquin."),
    ],
    ...overrides,
  });
}

function dressCode(overrides: Record<string, unknown> = {}) {
  return composedSection({
    key: "dressCode",
    type: "dressCode",
    title: "Código de vestimenta",
    blocks: [
      textBlock({
        id: "dressCode.title",
        role: "sectionTitle",
        value: { kind: "text", value: "Código de vestimenta" },
      }),
      rulesGroup(),
    ],
    ...overrides,
  });
}

describe("DressCodeSection — variantes soportadas", () => {
  for (const variant of ["two-columns", "cards"]) {
    it(`pinta data-variant="${variant}" sin lanzar`, () => {
      const { container } = render(<DressCodeSection section={dressCode()} variant={variant} mode="public" />);
      expect(container.querySelector("section")!.getAttribute("data-variant")).toBe(variant);
      expect(container.textContent).toContain("Damas");
      expect(container.textContent).toContain("Caballeros");
    });
  }

  it('"two-columns" y "cards" tienen data-variant distinto', () => {
    const cols = render(<DressCodeSection section={dressCode()} variant="two-columns" mode="public" />).container;
    const cards = render(<DressCodeSection section={dressCode()} variant="cards" mode="public" />).container;
    expect(cols.querySelector("section")!.getAttribute("data-variant")).not.toBe(
      cards.querySelector("section")!.getAttribute("data-variant"),
    );
  });
});

describe("DressCodeSection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it('data-variant refleja "two-columns" (defaultVariant)', () => {
    const { container } = render(<DressCodeSection section={dressCode()} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("two-columns");
  });

  it("avisa por consola solo en canvas", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<DressCodeSection section={dressCode()} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<DressCodeSection section={dressCode()} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("DressCodeSection — value:null / grupo vacío no rompe ni pinta hueco", () => {
  it("grupo con items:[] no lanza y no pinta <ul>", () => {
    const section = dressCode({ blocks: [rulesGroup({ items: [] })] });
    const { container } = render(<DressCodeSection section={section} variant="two-columns" mode="public" />);
    expect(() => container).not.toThrow();
    expect(container.querySelector("ul")).toBeNull();
  });

  it("sin dressCodeRules, la sección monta su <h2> igual", () => {
    const section = dressCode({ blocks: [] });
    const { container } = render(<DressCodeSection section={section} variant="two-columns" mode="public" />);
    expect(container.querySelector("h2")!.textContent).toBe("Código de vestimenta");
  });
});

describe("DressCodeSection — R5: un rol que no contempla no se pinta", () => {
  it('un bloque con rol "storyTitle" no aparece', () => {
    const strayBlock = ComposedBlockSchema.parse({
      id: "dressCode.stray",
      role: "storyTitle",
      type: "text",
      label: "Nota",
      provenance: "user",
      value: { kind: "text", value: "esto no debería pintarse" },
    });
    const section = dressCode({ blocks: [rulesGroup(), strayBlock] });
    const { container } = render(<DressCodeSection section={section} variant="two-columns" mode="public" />);
    expect(container.textContent).not.toContain("esto no debería pintarse");
  });
});

describe("DressCodeSection — mode público vs canvas", () => {
  it("mode=public no lleva data-block-*", () => {
    const { container } = render(<DressCodeSection section={dressCode()} variant="two-columns" mode="public" />);
    expect(container.querySelectorAll("[data-block-id]").length).toBe(0);
  });

  it("mode=canvas SÍ marca los bloques del grupo", () => {
    const { container } = render(
      <DressCodeSection section={dressCode()} variant="cards" mode="canvas" onActivate={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-item-id]").length).toBeGreaterThan(0);
  });
});

describe("DressCodeSection — estructura semántica", () => {
  it("exactamente un <h2>, aria-labelledby correcto, 2 <li>", () => {
    const { container } = render(<DressCodeSection section={dressCode()} variant="two-columns" mode="public" />);
    expect(container.querySelectorAll("h2").length).toBe(1);
    const heading = container.querySelector("h2")!;
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(container.querySelectorAll("li").length).toBe(2);
  });
});

describe("DressCodeSection — jest-axe con datos reales de boda-clasica@1.0.0", () => {
  for (const variant of ["two-columns", "cards"]) {
    it(`cero violaciones (variant=${variant})`, async () => {
      const section = realBodaClasicaSection("dressCode");
      const { container } = render(<DressCodeSection section={section} variant={variant} mode="public" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }
});
