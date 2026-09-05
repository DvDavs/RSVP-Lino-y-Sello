// packages/sections/test/event.test.tsx — 3-2b, EventSection.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { EventSection } from "../src/sections/EventSection.tsx";
import { composedSection, textBlock, realBodaClasicaSection } from "./fixtures.ts";
import { ComposedBlockSchema, ComposedGroupSchema } from "./schema-values.ts";

function eventCardsGroup(overrides: Record<string, unknown> = {}) {
  return ComposedGroupSchema.parse({
    id: "event.cards",
    role: "eventCards",
    type: "group",
    label: "Momentos del día",
    provenance: "user",
    items: [
      {
        itemId: "01J8DEM0000000000000000EV1",
        blocks: [
          ComposedBlockSchema.parse({
            id: "title",
            role: "eventTitle",
            type: "text",
            label: "Nombre",
            provenance: "user",
            value: { kind: "text", value: "Ceremonia religiosa" },
          }),
          ComposedBlockSchema.parse({
            id: "when",
            role: "eventWhen",
            type: "dateTimeRange",
            label: "Cuándo",
            provenance: "user",
            value: { kind: "dateTimeRange", start: "2026-12-12T16:30", formatted: "12 de diciembre de 2026, 4:30 pm" },
          }),
          ComposedBlockSchema.parse({
            id: "place",
            role: "eventPlace",
            type: "location",
            label: "Dónde",
            provenance: "user",
            value: { kind: "location", name: "Templo de Santo Domingo" },
          }),
        ],
      },
    ],
    ...overrides,
  });
}

function event(overrides: Record<string, unknown> = {}) {
  return composedSection({
    key: "event",
    type: "event",
    title: "Itinerario",
    blocks: [
      textBlock({ id: "event.title", role: "sectionTitle", value: { kind: "text", value: "Itinerario" } }),
      eventCardsGroup(),
    ],
    ...overrides,
  });
}

describe("EventSection — variantes soportadas", () => {
  for (const variant of ["timeline", "cards", "single-place"]) {
    it(`pinta data-variant="${variant}" sin lanzar`, () => {
      const { container } = render(<EventSection section={event()} variant={variant} mode="public" />);
      expect(container.querySelector("section")!.getAttribute("data-variant")).toBe(variant);
      expect(container.textContent).toContain("Ceremonia religiosa");
    });
  }

  it('"timeline" produce marcadores/eje (li::before vía CSS) distintos de "cards" (rejilla)', () => {
    const timeline = render(<EventSection section={event()} variant="timeline" mode="public" />).container;
    const cards = render(<EventSection section={event()} variant="cards" mode="public" />).container;
    expect(timeline.querySelector("section")!.getAttribute("data-variant")).not.toBe(
      cards.querySelector("section")!.getAttribute("data-variant"),
    );
  });
});

describe("EventSection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it('data-variant refleja "timeline" (defaultVariant)', () => {
    const { container } = render(<EventSection section={event()} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("timeline");
  });

  it("avisa por consola solo en canvas", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<EventSection section={event()} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<EventSection section={event()} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("EventSection — grupo con varios ítems se pinta como <ul>/<li> en orden (R7)", () => {
  it("3 ítems producen 3 <li>", () => {
    const group = eventCardsGroup({
      items: [
        { itemId: "01J8DEM0000000000000000EV1", blocks: [] },
        { itemId: "01J8DEM0000000000000000EV2", blocks: [] },
        { itemId: "01J8DEM0000000000000000EV3", blocks: [] },
      ],
    });
    const section = event({ blocks: [group] });
    const { container } = render(<EventSection section={section} variant="timeline" mode="public" />);
    expect(container.querySelectorAll("li").length).toBe(3);
  });
});

describe("EventSection — value:null / grupo vacío no rompe ni pinta hueco", () => {
  it("grupo con items:[] no lanza y no pinta <ul>", () => {
    const section = event({ blocks: [eventCardsGroup({ items: [] })] });
    const { container } = render(<EventSection section={section} variant="timeline" mode="public" />);
    expect(() => container).not.toThrow();
    expect(container.querySelector("ul")).toBeNull();
  });

  it("sin eventCards ni eventPlace, la sección monta su <h2> igual y no lanza", () => {
    const section = event({ blocks: [] });
    const { container } = render(<EventSection section={section} variant="timeline" mode="public" />);
    expect(container.querySelector("h2")!.textContent).toBe("Itinerario");
  });
});

describe("EventSection — variante single-place con eventPlace/eventLocationNote sin grupo", () => {
  it("usa el bloque escalar eventPlace cuando no hay eventCards", () => {
    const section = event({
      blocks: [
        textBlock({ id: "event.title", role: "sectionTitle", value: { kind: "text", value: "Itinerario" } }),
        ComposedBlockSchema.parse({
          id: "event.place",
          role: "eventPlace",
          type: "location",
          label: "Dónde",
          provenance: "user",
          value: { kind: "location", name: "Salón Zorba" },
        }),
      ],
    });
    const { container } = render(<EventSection section={section} variant="single-place" mode="public" />);
    expect(container.textContent).toContain("Salón Zorba");
    expect(container.querySelector("ul")).toBeNull();
  });
});

describe("EventSection — R5: un rol que no contempla no se pinta", () => {
  it('un bloque con rol "dressCodeDetail" no aparece', () => {
    const strayBlock = ComposedBlockSchema.parse({
      id: "event.stray",
      role: "dressCodeDetail",
      type: "text",
      label: "Nota",
      provenance: "user",
      value: { kind: "text", value: "esto no debería pintarse" },
    });
    const section = event({ blocks: [eventCardsGroup(), strayBlock] });
    const { container } = render(<EventSection section={section} variant="timeline" mode="public" />);
    expect(container.textContent).not.toContain("esto no debería pintarse");
  });
});

describe("EventSection — mode público vs canvas", () => {
  it("mode=public no lleva data-block-*", () => {
    const { container } = render(<EventSection section={event()} variant="timeline" mode="public" />);
    expect(container.querySelectorAll("[data-block-id]").length).toBe(0);
  });

  it("mode=canvas SÍ marca los bloques del grupo (data-item-id/data-item-block-id)", () => {
    const { container } = render(
      <EventSection section={event()} variant="timeline" mode="canvas" onActivate={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-item-id]").length).toBeGreaterThan(0);
  });
});

describe("EventSection — estructura semántica", () => {
  it("exactamente un <h2>, aria-labelledby correcto", () => {
    const { container } = render(<EventSection section={event()} variant="timeline" mode="public" />);
    expect(container.querySelectorAll("h2").length).toBe(1);
    const heading = container.querySelector("h2")!;
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe(heading.id);
  });
});

describe("EventSection — jest-axe con datos reales de boda-clasica@1.0.0", () => {
  for (const variant of ["timeline", "cards"]) {
    it(`cero violaciones (variant=${variant})`, async () => {
      const section = realBodaClasicaSection("event");
      const { container } = render(<EventSection section={section} variant={variant} mode="public" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }
});
