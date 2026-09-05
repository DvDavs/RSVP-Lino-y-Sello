// Image.test.tsx — `11 §3.4` regla 4 («toda foto con máscara o radio ≥ 24 px») y `§3.3`
// (placeholder del sistema). Lo que aquí se comprueba es que NO hay forma de dibujar una foto sin
// máscara ni de perder el texto alternativo por el camino.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Image } from "./Image.tsx";
import { MASCARAS, definirMascara, type Mascara } from "./mascaras.ts";

afterEach(cleanup);

const FOTO = "https://ejemplo.test/boda.jpg";

function recorte(container: HTMLElement): HTMLElement {
  return container.querySelector(".ui-imagen__recorte") as HTMLElement;
}

/** jsdom serializa `url(#x)` como `url("#x")`; comparamos sin las comillas que añade. */
function clipPathDe(container: HTMLElement): string {
  return recorte(container).style.clipPath.replace(/["']/g, "");
}

describe("Image — máscara siempre aplicada", () => {
  it.each(MASCARAS)("mask=%s aplica un clip-path", (mask) => {
    const { container } = render(<Image mask={mask} src={FOTO} alt="Mariana y Rodrigo en el jardín" />);
    expect(clipPathDe(container)).not.toBe("");
  });

  it("`radius-lg` recorta con `inset(… round …)` y nunca por debajo de 24 px", () => {
    const { container } = render(<Image mask="radius-lg" radius={8} src={FOTO} alt="foto" />);
    expect(clipPathDe(container)).toBe("inset(0 round 24px)");
    cleanup();
    const { container: grande } = render(<Image mask="radius-lg" radius={36} src={FOTO} alt="foto" />);
    expect(recorte(grande).style.clipPath.replace(/["']/g, "")).toBe("inset(0 round 36px)");
  });

  it.each(["blob", "arch", "seal", "rotated"] as const)(
    "mask=%s emite un <clipPath> normalizado a la caja y lo referencia",
    (mask) => {
      const { container } = render(<Image mask={mask} src={FOTO} alt="foto" />);
      const clip = container.querySelector("clipPath") as SVGClipPathElement;
      expect(clip.getAttribute("clipPathUnits")).toBe("objectBoundingBox");
      const path = clip.querySelector("path") as SVGPathElement;
      expect(path.getAttribute("transform")).toContain("scale(0.01)");
      expect(path.getAttribute("d")).toMatch(/^M/);
      expect(clipPathDe(container)).toBe(`url(#${clip.id})`);
    },
  );

  it("el id de la máscara es determinista: mismo dibujo, mismo id; distinto dibujo, distinto id", () => {
    const { container: a } = render(<Image mask="blob" seed={31} src={FOTO} alt="foto" />);
    const idA = a.querySelector("clipPath")?.id;
    cleanup();
    const { container: b } = render(<Image mask="blob" seed={31} src={FOTO} alt="foto" />);
    expect(b.querySelector("clipPath")?.id).toBe(idA);
    cleanup();
    const { container: c } = render(<Image mask="blob" seed={32} src={FOTO} alt="foto" />);
    expect(c.querySelector("clipPath")?.id).not.toBe(idA);
  });

  it("se puede forzar un id propio cuando el consumidor necesita unicidad estricta", () => {
    const { container } = render(<Image mask="seal" id="mi-mascara" src={FOTO} alt="foto" />);
    expect(container.querySelector("clipPath")?.id).toBe("mi-mascara");
    expect(clipPathDe(container)).toBe("url(#mi-mascara)");
  });

  it("el <svg> de definiciones no ocupa espacio ni se anuncia", () => {
    const { container } = render(<Image mask="blob" src={FOTO} alt="foto" />);
    const defs = container.querySelector(".ui-imagen__defs") as SVGElement;
    expect(defs.getAttribute("aria-hidden")).toBe("true");
    expect(defs.getAttribute("focusable")).toBe("false");
  });

  it("la proporción se declara en la caja, no en la foto", () => {
    const { container } = render(<Image ratio="4 / 5" src={FOTO} alt="foto" />);
    const caja = container.firstElementChild as HTMLElement;
    expect(caja.style.aspectRatio).toBe("4 / 5");
    expect(caja.dataset.mascara).toBe("radius-lg");
  });
});

describe("Image — la fotografía sigue siendo accesible", () => {
  it("con `src` emite un <img> con su alt", () => {
    render(<Image src={FOTO} alt="Mariana y Rodrigo bajo la jacaranda" mask="blob" seed={5} />);
    const img = screen.getByAltText("Mariana y Rodrigo bajo la jacaranda");
    expect(img.tagName.toLowerCase()).toBe("img");
    expect(img.getAttribute("src")).toBe(FOTO);
  });

  it("acepta un hijo ya construido (next/image) y lo recorta igual", () => {
    const { container } = render(
      <Image mask="arch" alt="ignorado porque hay hijo">
        <img src={FOTO} alt="Quinceañera bailando el vals" className="ui-imagen__foto" />
      </Image>,
    );
    expect(screen.getByAltText("Quinceañera bailando el vals")).toBeInTheDocument();
    expect(screen.queryByAltText("ignorado porque hay hijo")).toBeNull();
    expect(clipPathDe(container)).toMatch(/^url\(#/);
  });

  it("una foto decorativa (alt vacío) no se anuncia", () => {
    const { container } = render(<Image src={FOTO} alt="" />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("alt")).toBe("");
  });
});

describe("Image — sin foto, placeholder del sistema (§3.3)", () => {
  it("sin `src` ni hijos pinta el placeholder con el alt como descripción", () => {
    render(<Image alt="Pareja riendo con confeti de papel picado" imageId="landing-hero" mask="seal" />);
    const marco = screen.getByRole("img", { name: "Pareja riendo con confeti de papel picado" });
    expect(marco.getAttribute("data-imagen-pendiente")).toBe("landing-hero");
    expect(marco.querySelector("linearGradient")).not.toBeNull();
  });

  it("el placeholder también va recortado por la máscara", () => {
    const { container } = render(<Image alt="foto pendiente" mask="blob" seed={9} />);
    expect(clipPathDe(container)).toMatch(/^url\(#/);
    expect(container.querySelector(".ui-placeholder")).not.toBeNull();
  });

  it("con alt vacío el placeholder queda decorativo", () => {
    const { container } = render(<Image alt="" />);
    expect(container.querySelector(".ui-placeholder")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("no escribe ni un color literal", () => {
    const { container } = render(<Image alt="foto pendiente" mask="arch" tones={["accent-soft", "primary-soft"]} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(container.innerHTML).not.toMatch(/rgba?\(/);
  });
});

describe("definirMascara()", () => {
  it("cubre exactamente las cinco máscaras de 11 §3.1", () => {
    expect(MASCARAS).toEqual(["radius-lg", "blob", "arch", "seal", "rotated"]);
  });

  it("solo `radius-lg` se resuelve sin <defs>", () => {
    for (const mask of MASCARAS) {
      const def = definirMascara(mask as Mascara, "x");
      if (mask === "radius-lg") expect(def.path).toBeUndefined();
      else expect(def.path?.d).toMatch(/^M/);
    }
  });

  it("la máscara `rotated` compone el giro con la normalización", () => {
    expect(definirMascara("rotated", "x", { rotate: 12 }).path?.transform).toBe("scale(0.01) rotate(12 50 50)");
  });
});
