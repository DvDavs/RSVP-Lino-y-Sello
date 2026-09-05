// packages/sections/test/cover.test.tsx — 3-2b, CoverSection.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { CoverSection } from "../src/sections/CoverSection.tsx";
import { GallerySection } from "../src/sections/GallerySection.tsx";
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

/**
 * A1 del bloque 3-9 (objeción ALTA de `3-CV`, capturas `O-01a`, `O-01b`, `O-02a`) — LA PORTADA ERA
 * UN DEGRADADO GRIS VACÍO.
 *
 * jsdom no maqueta ni pinta, así que estas pruebas comprueban las TRES DECLARACIONES que el
 * navegador convertía en el defecto —mismo criterio que las dos pruebas de D1 de 3-3b de arriba—,
 * y la comprobación de píxeles vive en las capturas de
 * `evidencia/fase-3/calidad-visual-corregido/`:
 *
 *   1. el escenario de la variante `full` tiene la FORMA de la lámina, no la de la pantalla: sin
 *      esto, `object-fit: cover` sobre `min-height: 100svh` enseñaba en 1440×900 sólo la franja
 *      central de una lámina 5:7, que es justo la que el ilustrador deja vacía para el texto;
 *   2. el velo es un lavado CLARO del fondo de la paleta, no un 92 % de TINTA: el velo antiguo
 *      tapaba la rama inferior, lo único dibujado que entraba en el recorte;
 *   3. el texto va en `--inv-color-ink`, que es contra lo que el generador de arte MIDE la zona
 *      segura de la lámina (`templates/scripts/art/scenes.mjs`, zona "título", umbral 4,5:1).
 */
describe("CoverSection — A1 (3-9): la lámina se ve entera y el texto va sobre su panel vacío", () => {
  function partes() {
    const { container } = render(<CoverSection section={cover()} variant="full" mode="public" />);
    const stage = container.querySelector("section > div")! as HTMLElement;
    const hijos = Array.from(stage.children) as HTMLElement[];
    return {
      section: container.querySelector("section")! as HTMLElement,
      stage,
      velo: hijos.find((h) => h.children.length === 0)!,
      contenido: hijos[hijos.length - 1]!,
    };
  }

  it("el escenario toma la relación de aspecto de la lámina, y se acota a la pantalla", () => {
    const { stage } = partes();
    const cs = getComputedStyle(stage);
    // La forma de la papeleta, no la de la ventana. Antes: sin `aspect-ratio` y con `min-height:100svh`.
    expect(cs.aspectRatio).toBe("var(--inv-image-aspect-portrait)");
    // Y nunca más alta que la pantalla: el ancho se limita por la altura disponible.
    expect(cs.maxWidth).toContain("var(--inv-image-aspect-portrait)");
    expect(cs.gridTemplateRows).toBe("2fr auto 5fr");
  });

  it("la pantalla completa la mide la SECCIÓN, que hace de fondo con la paleta activa", () => {
    const { section } = partes();
    const cs = getComputedStyle(section);
    expect(cs.minHeight).toBe("100svh");
    expect(cs.alignContent).toBe("center");
    expect(cs.background).toContain("var(--inv-color-bg)");
  });

  it("el velo es un lavado CLARO del fondo, nunca tinta: no puede volver a tapar el dibujo", () => {
    const { velo } = partes();
    const fondo = getComputedStyle(velo).background;
    expect(fondo).toContain("var(--inv-color-bg)");
    expect(fondo).not.toContain("var(--inv-color-ink)");
  });

  it("el texto se pinta en la tinta de la paleta, que es contra lo que el arte mide su zona segura", () => {
    const { contenido } = partes();
    const cs = getComputedStyle(contenido);
    expect(cs.color).toBe("var(--inv-color-ink)");
    // Y en la fila del medio de las tres, que es la que cae dentro de esa zona.
    expect(cs.gridRow).toBe("2");
  });

  /**
   * A1 tiene una consecuencia de RENDIMIENTO, no sólo de composición: al ocupar la lámina la
   * primera pantalla entera, pasa a ser el elemento LCP. Medido [V] con `@lhci/cli`
   * (`throttlingMethod: devtools`, móvil, 5 corridas) sobre la invitación publicada: con el
   * `loading="lazy"` por defecto de `ImageBlock`, el navegador la dejaba para el final y el LCP
   * salía **4 304 ms** contra el tope de 2 500 de `contratos §8`. Con `prioritaria` (y la lámina
   * servida a 1 200 px en vez de 1 600, ver `templates/scripts/build-art.mjs`), **2 072 ms**.
   *
   * La prueba falla sin la prop [V]: `loading` vuelve a resolver a "lazy".
   */
  it("la lámina de la portada se carga con prioridad: es el elemento LCP de la invitación", () => {
    const { container } = render(<CoverSection section={cover()} variant="full" mode="public" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("eager");
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });

  it("una imagen de otra sección sigue siendo perezosa (la prioridad no es el valor por defecto)", () => {
    const { container } = render(<GallerySection section={realBodaClasicaSection("gallery")} variant="grid" mode="public" />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("fetchpriority")).toBeNull();
    }
  });
});
