// Pruebas del marcador de posición honesto (04 §5.2 reglas 2/5 aplicadas al componente en sí,
// mismo criterio que U-01 aunque ese escenario es de las secciones reales, no de este marcador).
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { sectionRegistry } from "../../src/registry.ts";
import { composedSection } from "../fixtures.ts";
import { ComposedBlockSchema } from "../../src/schema-types.ts";

describe("SectionPlaceholder — estructura semántica (04 §17.3)", () => {
  it("<section aria-labelledby> con un <h2> con el título de la sección", () => {
    const CoverComponent = sectionRegistry.cover.component;
    const section = composedSection();
    const { container } = render(
      <CoverComponent section={section} variant="full" mode="public" />,
    );
    const sectionEl = container.querySelector("section")!;
    const heading = container.querySelector("h2")!;
    expect(sectionEl.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(heading.textContent).toBe("Portada");
  });
});

describe("SectionPlaceholder — variante desconocida cae a defaultVariant (regla 2, 04 §5.2)", () => {
  it("una variant fuera de supportedVariants se resuelve como defaultVariant", () => {
    const CoverComponent = sectionRegistry.cover.component;
    const section = composedSection({ variant: "no-existe" });
    const { container } = render(<CoverComponent section={section} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe(
      sectionRegistry.cover.defaultVariant,
    );
  });

  it("avisa por consola SOLO en mode='canvas' (en público no hay a quién avisarle)", () => {
    const CoverComponent = sectionRegistry.cover.component;
    const section = composedSection({ variant: "no-existe" });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<CoverComponent section={section} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<CoverComponent section={section} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("SectionPlaceholder — rol fuera de `roles` no se pinta (R5)", () => {
  it("un bloque con un rol que la sección no contempla no genera ningún nodo", () => {
    const CoverComponent = sectionRegistry.cover.component;
    const strayBlock = ComposedBlockSchema.parse({
      // "rsvpNote" no está entre los roles de `cover` (sectionRegistry.cover.roles).
      id: "cover.strayNote", role: "rsvpNote", type: "text", label: "Nota", provenance: "user",
      value: { kind: "text", value: "esto no debería pintarse en cover" },
    });
    const section = composedSection({ blocks: [strayBlock] });
    const { container } = render(<CoverComponent section={section} variant="full" mode="public" />);
    expect(container.textContent).not.toContain("esto no debería pintarse en cover");
  });
});

describe("SectionPlaceholder — despacha los 12 tipos sin lanzar", () => {
  for (const [type, entry] of Object.entries(sectionRegistry)) {
    it(`"${type}" renderiza una sección vacía sin lanzar`, () => {
      const section = composedSection({ type, key: type, blocks: [] });
      expect(() =>
        render(<entry.component section={section} variant={entry.defaultVariant} mode="public" />),
      ).not.toThrow();
    });
  }
});
