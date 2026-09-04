// packages/sections/test/story.test.tsx — 3-2b, StorySection.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { StorySection } from "../src/sections/StorySection.tsx";
import { composedSection, textBlock, realBodaClasicaSection } from "./fixtures.ts";
import { ComposedBlockSchema, ComposedGroupSchema } from "../src/schema-types.ts";

function milestoneItem(itemId: string, title: string) {
  return {
    itemId,
    blocks: [
      ComposedBlockSchema.parse({
        id: "title",
        role: "storyTitle",
        type: "text",
        label: "Título",
        provenance: "user",
        value: { kind: "text", value: title },
      }),
      ComposedBlockSchema.parse({
        id: "date",
        role: "storyDate",
        type: "date",
        label: "Fecha",
        provenance: "user",
        value: { kind: "date", value: "2019-03-01", formatted: "marzo de 2019" },
      }),
      ComposedBlockSchema.parse({
        id: "body",
        role: "storyBody",
        type: "richText",
        label: "Relato",
        provenance: "user",
        value: {
          kind: "richText",
          doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Un relato." }] }] },
        },
      }),
      ComposedBlockSchema.parse({
        id: "image",
        role: "storyImage",
        type: "image",
        label: "Foto",
        provenance: "user",
        value: { kind: "image", url: `https://cdn.ejemplo.mx/${itemId}.webp`, alt: "", focal: { x: 0.5, y: 0.5 } },
      }),
    ],
  };
}

function milestonesGroup(overrides: Record<string, unknown> = {}) {
  return ComposedGroupSchema.parse({
    id: "story.milestones",
    role: "storyMilestones",
    type: "group",
    label: "Momentos",
    provenance: "user",
    items: [
      milestoneItem("01J8DEM0000000000000000ST1", "Nos conocimos"),
      milestoneItem("01J8DEM0000000000000000ST2", "La propuesta"),
    ],
    ...overrides,
  });
}

function story(overrides: Record<string, unknown> = {}) {
  return composedSection({
    key: "story",
    type: "story",
    title: "Nuestra historia",
    blocks: [
      textBlock({ id: "story.title", role: "sectionTitle", value: { kind: "text", value: "Nuestra historia" } }),
      milestonesGroup(),
    ],
    ...overrides,
  });
}

describe("StorySection — variantes soportadas", () => {
  for (const variant of ["line", "alternating"]) {
    it(`pinta data-variant="${variant}" sin lanzar`, () => {
      const { container } = render(<StorySection section={story()} variant={variant} mode="public" />);
      expect(container.querySelector("section")!.getAttribute("data-variant")).toBe(variant);
      expect(container.textContent).toContain("Nos conocimos");
      expect(container.textContent).toContain("La propuesta");
    });
  }
});

describe("StorySection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it('data-variant refleja "line" (defaultVariant)', () => {
    const { container } = render(<StorySection section={story()} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("line");
  });

  it("avisa por consola solo en canvas", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<StorySection section={story()} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<StorySection section={story()} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("StorySection — value:null / grupo vacío no rompe ni pinta hueco", () => {
  it("grupo con items:[] no lanza y no pinta <ul>", () => {
    const section = story({ blocks: [milestonesGroup({ items: [] })] });
    const { container } = render(<StorySection section={section} variant="line" mode="public" />);
    expect(() => container).not.toThrow();
    expect(container.querySelector("ul")).toBeNull();
  });

  it("sin storyMilestones, la sección monta su <h2> igual", () => {
    const section = story({ blocks: [] });
    const { container } = render(<StorySection section={section} variant="line" mode="public" />);
    expect(container.querySelector("h2")!.textContent).toBe("Nuestra historia");
  });
});

describe("StorySection — R7: los ítems se pintan en el orden de items", () => {
  it("2 ítems -> 2 <li>, en orden", () => {
    const { container } = render(<StorySection section={story()} variant="line" mode="public" />);
    const items = Array.from(container.querySelectorAll("li"));
    expect(items.length).toBe(2);
    expect(items[0]!.textContent).toContain("Nos conocimos");
    expect(items[1]!.textContent).toContain("La propuesta");
  });
});

describe("StorySection — R5: un rol que no contempla no se pinta", () => {
  it('un bloque con rol "hashtag" no aparece', () => {
    const strayBlock = ComposedBlockSchema.parse({
      id: "story.stray",
      role: "hashtag",
      type: "text",
      label: "Nota",
      provenance: "user",
      value: { kind: "text", value: "esto no debería pintarse" },
    });
    const section = story({ blocks: [milestonesGroup(), strayBlock] });
    const { container } = render(<StorySection section={section} variant="line" mode="public" />);
    expect(container.textContent).not.toContain("esto no debería pintarse");
  });
});

describe("StorySection — mode público vs canvas", () => {
  it("mode=public no lleva data-block-*", () => {
    const { container } = render(<StorySection section={story()} variant="line" mode="public" />);
    expect(container.querySelectorAll("[data-block-id]").length).toBe(0);
  });

  it("mode=canvas SÍ marca los bloques del grupo", () => {
    const { container } = render(
      <StorySection section={story()} variant="alternating" mode="canvas" onActivate={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-item-id]").length).toBeGreaterThan(0);
  });
});

describe("StorySection — estructura semántica", () => {
  it("exactamente un <h2>, aria-labelledby correcto", () => {
    const { container } = render(<StorySection section={story()} variant="line" mode="public" />);
    expect(container.querySelectorAll("h2").length).toBe(1);
    const heading = container.querySelector("h2")!;
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe(heading.id);
  });
});

describe("StorySection — jest-axe con datos reales de boda-clasica@1.0.0", () => {
  for (const variant of ["line", "alternating"]) {
    it(`cero violaciones (variant=${variant})`, async () => {
      const section = realBodaClasicaSection("story");
      const { container } = render(<StorySection section={section} variant={variant} mode="public" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }
});
