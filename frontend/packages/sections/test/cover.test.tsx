// packages/sections/test/cover.test.tsx — 3-2b, CoverSection.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { CoverSection } from "../src/sections/CoverSection.tsx";
import { composedSection, imageBlock, textBlock, dateBlock, realBodaClasicaSection } from "./fixtures.ts";
import { ComposedBlockSchema } from "./schema-values.ts";

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

/**
 * D1 del bloque 3-3b — la PORTADA es la primera pantalla que ve un invitado, y salía rota.
 *
 * Estas dos pruebas fallan sin las declaraciones de `CoverSection.module.css` que las acompañan
 * (verificado [V] revirtiéndolas: `font-family` resolvía a `var(--inv-font-body)` y `.scrim`
 * resolvía a `position: static`). No comprueban píxeles —jsdom no maqueta ni pinta—, comprueban
 * las DOS causas exactas que el navegador convierte en el defecto, medidas con `getComputedStyle`
 * sobre el CSS Module real (`vitest.config.ts` declara `css: true`, así que la hoja se carga de
 * verdad y cascada de por medio). La comprobación de píxeles vive en la captura de
 * `evidencia/fase-3/correcciones/portada-corregida.png`.
 */
describe("CoverSection — D1 (3-3b): la portada se lee y usa la tipografía de titular", () => {
  it("el nombre de portada hereda la familia de TITULAR, no la de cuerpo del <span> de TextBlock", () => {
    const { container } = render(<CoverSection section={cover()} variant="full" mode="public" />);
    // El `<p>` del hueco declara la familia de titular…
    const heroName = container.querySelector("p + p")!;
    expect(getComputedStyle(heroName).fontFamily).toBe("var(--inv-font-heading)");

    // …y el nodo que TextBlock pinta dentro tiene que resolver a lo mismo. Sin `font-family:
    // inherit`, `blocks.module.css .text` gana en el propio elemento y esto da
    // "var(--inv-font-body)": el nombre de los novios sale en palo seco.
    const textoReal = heroName.querySelector("span")!;
    expect(textoReal.textContent).toBe("Ana & Luis");
    expect(getComputedStyle(textoReal).fontFamily).toBe("var(--inv-font-heading)");
  });

  it("el velo se pinta por ENCIMA de la foto: está posicionado y va después de la imagen en el DOM", () => {
    const { container } = render(<CoverSection section={cover()} variant="full" mode="public" />);
    const stage = container.querySelector("section > div")!;
    const hijos = Array.from(stage.children) as HTMLElement[];

    const marco = container.querySelector("img")!.closest("span")!;
    const velo = hijos.find((h) => h.children.length === 0)!;
    const contenido = hijos[hijos.length - 1]!;

    // (1) El marco de `ImageBlock` está POSICIONADO: es lo que lo empuja a la fase de pintado
    // tardía. `relative` es lo que declara `blocks/ImageBlock.module.css:3`; en la variante "full"
    // pasa a `absolute` por D1b (que la foto no estire la fila). Cualquiera de los dos sirve para
    // esta prueba: lo que importa es que NO sea `static`, porque entonces la foto pintaría antes
    // que todo lo demás y no habría nada que ordenar.
    expect(["relative", "absolute"]).toContain(getComputedStyle(marco).position);

    // (2) Velo y contenido tienen que estar en ESA MISMA fase, o la foto los tapa a los dos.
    expect(getComputedStyle(velo).position).toBe("relative");
    expect(getComputedStyle(contenido).position).toBe("relative");

    // (3) Dentro de la fase manda el orden del documento: foto → velo → texto.
    const orden = hijos.map((h) => (h.contains(marco) ? "foto" : h === velo ? "velo" : "contenido"));
    expect(orden).toEqual(["foto", "velo", "contenido"]);
  });

  /**
   * D1b: la foto no puede decidir cuánto mide la portada. Medido [V] a 1440×900 sobre la
   * invitación publicada antes del arreglo: con el marco EN FLUJO, su relación intrínseca (retrato
   * 5:7) estiraba la fila a 2 016 px y el texto quedaba en y = 1 730 — fuera de una ventana de 900.
   * Sacado del flujo, la altura la fija el `min-height: 100svh` del `.stage` y la foto cubre.
   */
  it("en la variante full la foto sale del flujo: no puede estirar la primera pantalla", () => {
    const { container } = render(<CoverSection section={cover()} variant="full" mode="public" />);
    const marco = container.querySelector("img")!.closest("span")!;
    expect(getComputedStyle(marco).position).toBe("absolute");

    // Y el hueco que la contiene recorta, porque el recorte deja de hacerlo el marco.
    const hueco = marco.parentElement!;
    expect(getComputedStyle(hueco).overflow).toBe("hidden");
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
