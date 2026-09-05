// packages/sections/test/gallery.test.tsx — 3-2b, GallerySection.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { GallerySection } from "../src/sections/GallerySection.tsx";
import { composedSection, textBlock, realBodaClasicaSection } from "./fixtures.ts";
import { ComposedBlockSchema, ComposedGroupSchema } from "./schema-values.ts";

function photoItem(itemId: string, alt = "") {
  return {
    itemId,
    blocks: [
      ComposedBlockSchema.parse({
        id: "image",
        role: "galleryPhoto",
        type: "image",
        label: "Foto",
        provenance: "user",
        value: {
          kind: "image",
          url: `https://cdn.ejemplo.mx/assets/${itemId}.webp`,
          alt,
          focal: { x: 0.5, y: 0.5 },
        },
      }),
    ],
  };
}

function galleryPhotosGroup(overrides: Record<string, unknown> = {}) {
  return ComposedGroupSchema.parse({
    id: "gallery.photos",
    role: "galleryPhotos",
    type: "group",
    label: "Fotos",
    provenance: "user",
    items: [
      photoItem("01J8DEM00000000000000000G1"),
      photoItem("01J8DEM00000000000000000G2"),
      photoItem("01J8DEM00000000000000000G3"),
    ],
    ...overrides,
  });
}

function gallery(overrides: Record<string, unknown> = {}) {
  return composedSection({
    key: "gallery",
    type: "gallery",
    title: "Galería",
    blocks: [
      textBlock({ id: "gallery.title", role: "sectionTitle", value: { kind: "text", value: "Galería" } }),
      galleryPhotosGroup(),
    ],
    ...overrides,
  });
}

describe("GallerySection — variantes soportadas", () => {
  for (const variant of ["grid-6", "grid-9", "carousel", "masonry"]) {
    it(`pinta data-variant="${variant}" con imágenes con loading=lazy y sin lanzar`, () => {
      const { container } = render(<GallerySection section={gallery()} variant={variant} mode="public" />);
      expect(container.querySelector("section")!.getAttribute("data-variant")).toBe(variant);
      const imgs = container.querySelectorAll("img");
      expect(imgs.length).toBe(3);
      imgs.forEach((img) => expect(img.getAttribute("loading")).toBe("lazy"));
    });
  }

  it('"grid-6" y "masonry" tienen data-variant distinto (layouts de verdad distintos)', () => {
    const grid = render(<GallerySection section={gallery()} variant="grid-6" mode="public" />).container;
    const masonry = render(<GallerySection section={gallery()} variant="masonry" mode="public" />).container;
    expect(grid.querySelector("section")!.getAttribute("data-variant")).not.toBe(
      masonry.querySelector("section")!.getAttribute("data-variant"),
    );
  });

  it('"carousel" marca el contenedor de fotos como grupo enfocable con etiqueta es-MX', () => {
    const { container } = render(<GallerySection section={gallery()} variant="carousel" mode="public" />);
    const wrap = container.querySelector('[role="group"]')!;
    expect(wrap.getAttribute("tabindex")).toBe("0");
    expect(wrap.getAttribute("aria-label")).toBeTruthy();
  });
});

describe("GallerySection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it('data-variant refleja "grid-6" (defaultVariant)', () => {
    const { container } = render(<GallerySection section={gallery()} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("grid-6");
  });

  it("avisa por consola solo en canvas", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<GallerySection section={gallery()} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<GallerySection section={gallery()} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("GallerySection — value:null / grupo vacío no rompe ni pinta hueco", () => {
  it("grupo con items:[] no lanza y no pinta <ul>", () => {
    const section = gallery({ blocks: [galleryPhotosGroup({ items: [] })] });
    const { container } = render(<GallerySection section={section} variant="grid-6" mode="public" />);
    expect(() => container).not.toThrow();
    expect(container.querySelector("ul")).toBeNull();
  });

  it("sin galleryPhotos, la sección monta su <h2> igual", () => {
    const section = gallery({ blocks: [] });
    const { container } = render(<GallerySection section={section} variant="grid-6" mode="public" />);
    expect(container.querySelector("h2")!.textContent).toBe("Galería");
  });
});

describe("GallerySection — hashtag y hashtagList", () => {
  it("pinta el hashtag de negocio cuando está presente", () => {
    const section = gallery({
      blocks: [
        galleryPhotosGroup(),
        textBlock({
          id: "gallery.hashtag",
          role: "hashtag",
          provenance: "business",
          value: { kind: "text", value: "#CamilaYAntonio" },
        }),
      ],
    });
    const { container } = render(<GallerySection section={section} variant="grid-6" mode="public" />);
    expect(container.textContent).toContain("#CamilaYAntonio");
  });

  it("sin hashtag ni hashtagList, no pinta el pie social", () => {
    const { container } = render(<GallerySection section={gallery()} variant="grid-6" mode="public" />);
    expect(container.querySelector("footer")).toBeNull();
  });

  it("pinta hashtagList como grupo delegado (sin hashtag escalar)", () => {
    const hashtagListGroup = ComposedGroupSchema.parse({
      id: "gallery.hashtagList",
      role: "hashtagList",
      type: "group",
      label: "Redes",
      provenance: "user",
      items: [
        {
          itemId: "01J8DEM0000000000000000HT1",
          blocks: [
            ComposedBlockSchema.parse({
              id: "tag",
              role: "hashtag",
              type: "text",
              label: "Etiqueta",
              provenance: "user",
              value: { kind: "text", value: "#CamilaYAntonio" },
            }),
          ],
        },
      ],
    });
    const section = gallery({ blocks: [galleryPhotosGroup(), hashtagListGroup] });
    const { container } = render(<GallerySection section={section} variant="grid-6" mode="public" />);
    expect(container.querySelector("footer")).not.toBeNull();
    expect(container.textContent).toContain("#CamilaYAntonio");
  });
});

describe("GallerySection — R5: un rol que no contempla no se pinta", () => {
  it('un bloque con rol "rsvpNote" no aparece', () => {
    const strayBlock = ComposedBlockSchema.parse({
      id: "gallery.stray",
      role: "rsvpNote",
      type: "text",
      label: "Nota",
      provenance: "user",
      value: { kind: "text", value: "esto no debería pintarse" },
    });
    const section = gallery({ blocks: [galleryPhotosGroup(), strayBlock] });
    const { container } = render(<GallerySection section={section} variant="grid-6" mode="public" />);
    expect(container.textContent).not.toContain("esto no debería pintarse");
  });
});

describe("GallerySection — mode público vs canvas", () => {
  it("mode=public no lleva data-block-*", () => {
    const { container } = render(<GallerySection section={gallery()} variant="grid-6" mode="public" />);
    expect(container.querySelectorAll("[data-block-id]").length).toBe(0);
  });

  it("mode=canvas SÍ marca las fotos del grupo", () => {
    const { container } = render(
      <GallerySection section={gallery()} variant="grid-6" mode="canvas" onActivate={vi.fn()} />,
    );
    expect(container.querySelectorAll("[data-item-id]").length).toBe(3);
  });
});

describe("GallerySection — estructura semántica", () => {
  it("exactamente un <h2>, aria-labelledby correcto, fotos en <ul>/<li>", () => {
    const { container } = render(<GallerySection section={gallery()} variant="grid-6" mode="public" />);
    expect(container.querySelectorAll("h2").length).toBe(1);
    const heading = container.querySelector("h2")!;
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(container.querySelectorAll("li").length).toBe(3);
  });
});

describe("GallerySection — jest-axe con datos reales de boda-clasica@1.0.0", () => {
  for (const variant of ["grid-6", "grid-9", "carousel", "masonry"]) {
    it(`cero violaciones (variant=${variant})`, async () => {
      const section = realBodaClasicaSection("gallery");
      const { container } = render(<GallerySection section={section} variant={variant} mode="public" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }
});
