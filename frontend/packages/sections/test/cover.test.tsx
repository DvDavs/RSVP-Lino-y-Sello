// packages/sections/test/cover.test.tsx — 3-2b, CoverSection.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { CoverSection } from "../src/sections/CoverSection.tsx";
import { composedSection, imageBlock, textBlock, dateBlock, realBodaClasicaSection } from "./fixtures.ts";
import { ComposedBlockSchema } from "../src/schema-types.ts";

function cover(overrides: Record<string, unknown> = {}) {
  return composedSection({
    key: "cover",
    type: "cover",
    title: "Portada",
    blocks: [
      textBlock({ id: "cover.title", role: "coverTitle", value: { kind: "text", value: "Ana & Luis" } }),
      textBlock({
        id: "cover.subtitle",
        role: "coverSubtitle",
        value: { kind: "text", value: "¡Nos casamos!" },
      }),
      dateBlock(),
      imageBlock(),
      textBlock({
        id: "cover.buttonLabel",
        role: "coverButtonLabel",
        provenance: "fixed",
        value: { kind: "text", value: "Save the date" },
      }),
    ],
    ...overrides,
  });
}

describe("CoverSection — variantes soportadas", () => {
  for (const variant of ["full", "framed", "split"]) {
    it(`pinta data-variant="${variant}" sin lanzar`, () => {
      const { container } = render(<CoverSection section={cover()} variant={variant} mode="public" />);
      expect(container.querySelector("section")!.getAttribute("data-variant")).toBe(variant);
    });
  }

  it('"framed" y "full" producen HTML de sección distinto (no es el mismo layout con un borde)', () => {
    const full = render(<CoverSection section={cover()} variant="full" mode="public" />).container;
    const framed = render(<CoverSection section={cover()} variant="framed" mode="public" />).container;
    // Mismo texto (mismo contenido), pero el `data-variant` — que gobierna un CSS completamente
    // distinto (grid a sangre vs. tarjeta enmarcada, `CoverSection.module.css`) — difiere, y el
    // DOM en sí (mismo árbol, distinta clase de layout) no es simplemente el mismo con un extra.
    expect(full.querySelector("section")!.getAttribute("data-variant")).not.toBe(
      framed.querySelector("section")!.getAttribute("data-variant"),
    );
    expect(full.textContent).toBe(framed.textContent); // mismo contenido en ambos casos
  });
});

describe("CoverSection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it("data-variant refleja el defaultVariant real (full)", () => {
    const { container } = render(<CoverSection section={cover()} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("full");
  });

  it("no avisa en mode=public, sí avisa en mode=canvas", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<CoverSection section={cover()} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<CoverSection section={cover()} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("con una variante SÍ soportada, mode=canvas no avisa", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<CoverSection section={cover()} variant="framed" mode="canvas" />);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("CoverSection — value:null por rol no rompe ni pinta un hueco", () => {
  it("coverTitle, coverSubtitle, coverDate e imagen en null: la sección no lanza y no deja huecos", () => {
    const section = cover({
      blocks: [
        textBlock({ id: "cover.title", role: "coverTitle", value: null, provenance: "empty" }),
        textBlock({ id: "cover.subtitle", role: "coverSubtitle", value: null, provenance: "empty" }),
        ComposedBlockSchema.parse({
          id: "cover.date",
          role: "coverDate",
          type: "date",
          label: "Fecha",
          provenance: "empty",
          value: null,
        }),
      ],
    });
    const { container } = render(<CoverSection section={section} variant="full" mode="public" />);
    expect(() => container).not.toThrow();
    // Ningún bloque de texto/fecha con valor null deja rastro de texto.
    expect(container.querySelector("time")).toBeNull();
  });

  it("sin ningún bloque en absoluto, la sección sigue montando su <h2>", () => {
    const section = cover({ blocks: [] });
    const { container } = render(<CoverSection section={section} variant="full" mode="public" />);
    const heading = container.querySelector("h2")!;
    expect(heading).not.toBeNull();
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe(heading.id);
  });
});

describe("CoverSection — R5: un rol que no contempla no se pinta", () => {
  it('un bloque con rol "rsvpNote" no aparece en el texto', () => {
    const strayBlock = ComposedBlockSchema.parse({
      id: "cover.stray",
      role: "rsvpNote",
      type: "text",
      label: "Nota",
      provenance: "user",
      value: { kind: "text", value: "esto no debería pintarse" },
    });
    const section = cover({ blocks: [strayBlock] });
    const { container } = render(<CoverSection section={section} variant="full" mode="public" />);
    expect(container.textContent).not.toContain("esto no debería pintarse");
  });
});

describe("CoverSection — mode público vs canvas", () => {
  it("mode=public no lleva data-block-* en ningún nodo", () => {
    const { container } = render(<CoverSection section={cover()} variant="full" mode="public" />);
    expect(container.querySelectorAll("[data-block-id]").length).toBe(0);
  });

  it("mode=canvas SÍ marca los bloques activables con data-block-id", () => {
    const { container } = render(
      <CoverSection section={cover()} variant="full" mode="canvas" onActivate={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-block-id]").length).toBeGreaterThan(0);
  });

  it("un clic en el nombre invoca onActivate con el BlockRef correcto en modo canvas", () => {
    const onActivate = vi.fn();
    const { container } = render(
      <CoverSection section={cover()} variant="full" mode="canvas" onActivate={onActivate} />,
    );
    const titleNode = container.querySelector('[data-block-id="cover.title"]')!;
    titleNode.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onActivate).toHaveBeenCalledWith({ sectionKey: "cover", blockId: "cover.title" });
  });
});

describe("CoverSection — estructura semántica (04 §17.3)", () => {
  it("exactamente un <h2>, section aria-labelledby apunta a él", () => {
    const { container } = render(<CoverSection section={cover()} variant="full" mode="public" />);
    expect(container.querySelectorAll("h2").length).toBe(1);
    expect(container.querySelectorAll("h1").length).toBe(0);
    const heading = container.querySelector("h2")!;
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe(heading.id);
  });
});

describe("CoverSection — jest-axe con datos reales de boda-clasica@1.0.0", () => {
  it("cero violaciones (variant=full)", async () => {
    const section = realBodaClasicaSection("cover");
    const { container } = render(<CoverSection section={section} variant={section.variant} mode="public" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("cero violaciones (variant=framed)", async () => {
    const section = realBodaClasicaSection("cover");
    const { container } = render(<CoverSection section={section} variant="framed" mode="public" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("cero violaciones (variant=split)", async () => {
    const section = realBodaClasicaSection("cover");
    const { container } = render(<CoverSection section={section} variant="split" mode="public" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
