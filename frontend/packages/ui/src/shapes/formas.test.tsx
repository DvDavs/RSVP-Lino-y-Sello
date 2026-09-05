// formas.test.tsx — contrato COMÚN de la biblioteca (`11 §3.1`, `10 §1.3`):
//   1. cada forma emite un `<svg>` con `viewBox` (escala sin recalcular geometría);
//   2. ningún color literal: solo `var(--ui-*)`, `currentColor`, `none` o `url(#…)`;
//   3. decorativa por defecto (`aria-hidden`), anunciable solo si se declara y se nombra;
//   4. `breathe`/`drift` solo añaden clase: el interruptor es CSS, nunca `style`.
import type { JSX } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Blob } from "./Blob.tsx";
import { ColorShadow } from "./ColorShadow.tsx";
import { Composition } from "./Composition.tsx";
import { Pill } from "./Pill.tsx";
import { Placeholder } from "./Placeholder.tsx";
import { Rays } from "./Rays.tsx";
import { RotatedSquare } from "./RotatedSquare.tsx";
import { Seal } from "./Seal.tsx";
import { Stripes } from "./Stripes.tsx";
import { Triangle } from "./Triangle.tsx";
import { WaveDivider } from "./WaveDivider.tsx";
import { CLASE_DERIVA, CLASE_FORMA, CLASE_RESPIRA } from "./base.ts";

afterEach(cleanup);

/** Las formas SVG decorativas del catálogo, con el nombre con el que se documentan. */
const FORMAS_SVG: readonly (readonly [string, () => JSX.Element])[] = [
  ["Rays", () => <Rays density={12} radius={160} tone="primary-soft" backdrop="surface-alt" />],
  ["Stripes", () => <Stripes angle={-24} gap={18} width={9} tone="support-2-soft" />],
  ["WaveDivider", () => <WaveDivider profile="doble" layers={2} from="primary-soft" to="surface" />],
  ["Blob", () => <Blob seed={7} points={7} amplitude={0.22} tone="support-2-soft" />],
  ["Triangle", () => <Triangle tone="accent" rotate={-8} radius={12} />],
  ["RotatedSquare", () => <RotatedSquare tone="primary-bright" rotate={12} radius="md" />],
  ["Seal", () => <Seal points={12} amplitude={4} tone="primary-soft" />],
];

/** Colores admitidos en un atributo `fill`/`stroke`/`stop-color` de la biblioteca. */
const COLOR_PERMITIDO = /^(var\(--ui-[a-z0-9-]+\)|url\(#[\w-]+\)|currentColor|none)$/;

describe("contrato común de las formas SVG", () => {
  it.each(FORMAS_SVG)("%s emite un <svg> con viewBox", (_nombre, montar) => {
    const { container } = render(montar());
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toMatch(/^-?\d+(\.\d+)? -?\d+(\.\d+)? \d+ \d+$/);
    expect(svg?.classList.contains(CLASE_FORMA)).toBe(true);
  });

  it.each(FORMAS_SVG)("%s no escribe ni un color literal", (_nombre, montar) => {
    const { container } = render(montar());
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(container.innerHTML).not.toMatch(/rgba?\(/);
    for (const nodo of container.querySelectorAll<SVGElement>("[fill], [stroke], [stop-color]")) {
      for (const atributo of ["fill", "stroke", "stop-color"]) {
        const valor = nodo.getAttribute(atributo);
        if (valor !== null) expect(valor, `${atributo}="${valor}"`).toMatch(COLOR_PERMITIDO);
      }
    }
  });

  it.each(FORMAS_SVG)("%s es decorativa por defecto", (_nombre, montar) => {
    const { container } = render(montar());
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("role")).toBeNull();
    expect(svg?.querySelector("title")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it.each(FORMAS_SVG)("%s no lleva estilos de animación en línea", (_nombre, montar) => {
    const { container } = render(montar());
    expect(container.innerHTML).not.toMatch(/animation/i);
    expect(container.innerHTML).not.toMatch(/@keyframes/);
  });
});

describe("accesibilidad declarada", () => {
  it("decorative={false} exige título y publica la forma como imagen con nombre", () => {
    render(<Seal decorative={false} title="Sello de invitación publicada" tone="primary-soft" />);
    const forma = screen.getByRole("img", { name: "Sello de invitación publicada" });
    expect(forma.tagName.toLowerCase()).toBe("svg");
    expect(forma.querySelector("title")?.textContent).toBe("Sello de invitación publicada");
    expect(forma.getAttribute("aria-hidden")).toBeNull();
  });

  it("todas las formas admiten decorative={false} con título", () => {
    const { container } = render(
      <>
        <Rays decorative={false} title="rayos" />
        <Stripes decorative={false} title="rayas" />
        <WaveDivider decorative={false} title="onda" />
        <Blob decorative={false} title="blob" />
        <Triangle decorative={false} title="triangulo" />
        <RotatedSquare decorative={false} title="cuadrado" />
      </>,
    );
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(6);
    expect(container.querySelectorAll("svg > title")).toHaveLength(6);
  });
});

describe("movimiento: solo clases, apagado en CSS", () => {
  it("breathe y drift añaden su clase y nada más", () => {
    const { container } = render(<Blob seed={3} breathe drift />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains(CLASE_RESPIRA)).toBe(true);
    expect(svg?.classList.contains(CLASE_DERIVA)).toBe(true);
    expect(svg?.getAttribute("style")).toBeNull();
  });

  it("sin las props no hay clase de movimiento", () => {
    const { container } = render(<Blob seed={3} />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains(CLASE_RESPIRA)).toBe(false);
    expect(svg?.classList.contains(CLASE_DERIVA)).toBe(false);
  });
});

describe("parámetros que llegan al dibujo", () => {
  it("Rays emite `density` cuñas y desplaza el origen", () => {
    const { container } = render(<Rays density={8} radius={120} origin="80% 30%" />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")?.match(/M0 0/g)).toHaveLength(8);
    expect(container.querySelector("g")?.getAttribute("transform")).toBe("translate(60 -40)");
  });

  it("Rays sin backdrop no pinta fondo; con backdrop sí", () => {
    const { container: sin } = render(<Rays />);
    expect(sin.querySelectorAll("rect")).toHaveLength(0);
    cleanup();
    const { container: con } = render(<Rays backdrop="surface-alt" />);
    expect(con.querySelector("rect")?.getAttribute("fill")).toBe("var(--ui-surface-alt)");
  });

  it("Stripes emite un <pattern> con el paso, el grosor y el ángulo pedidos", () => {
    const { container } = render(<Stripes angle={45} gap={20} width={7} tone="accent-soft" />);
    const patron = container.querySelector("pattern");
    expect(patron?.getAttribute("width")).toBe("20");
    expect(patron?.getAttribute("patternTransform")).toBe("rotate(45)");
    expect(patron?.querySelector("rect")?.getAttribute("width")).toBe("7");
    expect(container.querySelectorAll("rect")[1]?.getAttribute("fill")).toBe(`url(#${patron?.id})`);
  });

  it("el id del patrón es estable entre renders con los mismos parámetros y cambia con ellos", () => {
    const { container: a } = render(<Stripes angle={-24} gap={18} width={9} />);
    const idA = a.querySelector("pattern")?.id;
    cleanup();
    const { container: b } = render(<Stripes angle={-24} gap={18} width={9} />);
    expect(b.querySelector("pattern")?.id).toBe(idA);
    cleanup();
    const { container: c } = render(<Stripes angle={90} gap={18} width={9} />);
    expect(c.querySelector("pattern")?.id).not.toBe(idA);
  });

  it("WaveDivider: una capa pinta un path, dos capas pintan dos", () => {
    const { container: una } = render(<WaveDivider profile="suave" layers={1} />);
    expect(una.querySelectorAll("path")).toHaveLength(1);
    cleanup();
    const { container: dos } = render(<WaveDivider profile="suave" layers={2} tones={["support-1-soft"]} />);
    const paths = dos.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute("fill")).toBe("var(--ui-support-1-soft)");
  });

  it("WaveDivider `doble` implica dos capas y `flip` voltea la onda", () => {
    const { container } = render(<WaveDivider profile="doble" flip height={72} />);
    expect(container.querySelectorAll("path")).toHaveLength(2);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.style.transform).toBe("scaleY(-1)");
    expect(svg.style.height).toBe("72px");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
  });

  it("RotatedSquare inscribe el lado para no salirse del bloque", () => {
    const { container } = render(<RotatedSquare rotate={45} />);
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    const numeros = d
      .replace(/[MLQZ]/g, " ")
      .trim()
      .split(/\s+/)
      .map(Number);
    expect(Math.min(...numeros)).toBeGreaterThanOrEqual(14);
    expect(Math.max(...numeros)).toBeLessThanOrEqual(86);
    expect(container.querySelector("path")?.getAttribute("transform")).toBe("rotate(45 50 50)");
  });
});

describe("Pill — la única forma con texto", () => {
  it("se anuncia (no es decorativa) y usa la pareja verificada del tono", () => {
    render(
      <Pill tone="support-2" dot>
        128 confirmados
      </Pill>,
    );
    const pildora = screen.getByText("128 confirmados");
    expect(pildora.getAttribute("aria-hidden")).toBeNull();
    expect(pildora.style.background).toBe("var(--ui-support-2-soft)");
    expect(pildora.style.color).toBe("var(--ui-support-2-deep)");
    expect(pildora.dataset.tono).toBe("support-2");
  });

  it("el punto de estado es decorativo", () => {
    const { container } = render(<Pill dot>Publicada</Pill>);
    const punto = container.querySelector(".ui-pildora__punto");
    expect(punto?.getAttribute("aria-hidden")).toBe("true");
  });

  it("los cuatro tonos usan una pareja `-soft` / texto oscuro, sin hex", () => {
    const { container } = render(
      <>
        <Pill tone="primary">a</Pill>
        <Pill tone="support-1">b</Pill>
        <Pill tone="support-2">c</Pill>
        <Pill tone="accent">d</Pill>
      </>,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const p of container.querySelectorAll<HTMLElement>(".ui-pildora")) {
      expect(p.style.background).toMatch(/^var\(--ui-[a-z0-9-]+-soft\)$/);
      expect(p.style.color).toMatch(/^var\(--ui-(on-)?[a-z0-9-]+(-deep|-soft)\)$/);
    }
  });
});

describe("ColorShadow — una sombra de color por vista (§3.4.8)", () => {
  it("emite la sombra sólida desplazada y el borde de tinta, sin sombra difusa", () => {
    const { container } = render(
      <ColorShadow tone="support-2" offset={{ x: 8, y: 8 }}>
        <p>Tarjeta destacada</p>
      </ColorShadow>,
    );
    const caja = container.firstElementChild as HTMLElement;
    expect(caja.style.boxShadow).toBe("8px 8px 0 0 var(--ui-support-2)");
    expect(caja.style.boxShadow).not.toContain("blur");
    expect(caja.style.border).toBe("2px solid var(--ui-ink)");
    expect(caja.style.borderRadius).toBe("var(--ui-radius-lg)");
    expect(caja.dataset.tono).toBe("support-2");
  });

  it("`border={false}` quita el borde y `as` cambia el elemento", () => {
    const { container } = render(
      <ColorShadow as="article" border={false} radius="md">
        <p>x</p>
      </ColorShadow>,
    );
    const caja = container.firstElementChild as HTMLElement;
    expect(caja.tagName.toLowerCase()).toBe("article");
    expect(caja.style.border).toBe("");
    expect(caja.style.borderRadius).toBe("var(--ui-radius-md)");
  });
});

describe("Composition — las reglas de §3.4 como utilidad", () => {
  it("la forma queda detrás y fuera del árbol accesible; el contenido, delante", () => {
    render(
      <Composition shape={<Rays density={12} />} place="arriba-derecha" size="70%">
        <h2>Mariana y Rodrigo</h2>
      </Composition>,
    );
    const titulo = screen.getByRole("heading", { name: "Mariana y Rodrigo" });
    const contenido = titulo.parentElement as HTMLElement;
    expect(contenido.className).toContain("ui-composicion__contenido");
    const bloque = contenido.parentElement as HTMLElement;
    const capa = bloque.querySelector(".ui-composicion__forma") as HTMLElement;
    expect(capa.getAttribute("aria-hidden")).toBe("true");
    expect(capa.className).toContain("ui-composicion__forma--arriba-derecha");
    expect(capa.style.getPropertyValue("--ui-capa-tam")).toBe("70%");
    // La forma va ANTES del contenido en el DOM: el orden de pintado no depende del z-index solo.
    expect(bloque.firstElementChild).toBe(capa);
  });

  it("la segunda forma lleva la clase que la limita al 30 % del bloque", () => {
    const { container } = render(
      <Composition
        shape={<Blob seed={2} />}
        secondaryShape={{ shape: <Seal points={12} />, place: "abajo-izquierda", size: "40%" }}
      >
        <p>contenido</p>
      </Composition>,
    );
    const capas = container.querySelectorAll(".ui-composicion__forma");
    expect(capas).toHaveLength(2);
    expect(capas[1]?.className).toContain("ui-composicion__forma--secundaria");
    expect(capas[1]?.className).toContain("ui-composicion__forma--abajo-izquierda");
  });

  it("la capa es cuadrada salvo que se pida un alto explícito", () => {
    const { container: cuadrada } = render(
      <Composition shape={<Blob seed={1} />} size="320px">
        <p>x</p>
      </Composition>,
    );
    const sinAlto = cuadrada.querySelector(".ui-composicion__forma") as HTMLElement;
    expect(sinAlto.style.getPropertyValue("--ui-capa-tam")).toBe("320px");
    expect(sinAlto.style.getPropertyValue("--ui-capa-alto")).toBe("auto");
    cleanup();
    const { container: apaisada } = render(
      <Composition shape={<Blob seed={1} />} size="70%" height="180px">
        <p>x</p>
      </Composition>,
    );
    const conAlto = apaisada.querySelector(".ui-composicion__forma") as HTMLElement;
    expect(conAlto.style.getPropertyValue("--ui-capa-alto")).toBe("180px");
  });

  it("el desplazamiento fino viaja como variables, no como colores", () => {
    const { container } = render(
      <Composition shape={<Blob seed={1} />} offset={{ x: "-12%", y: "8px" }}>
        <p>x</p>
      </Composition>,
    );
    const capa = container.querySelector(".ui-composicion__forma") as HTMLElement;
    expect(capa.style.getPropertyValue("--ui-capa-dx")).toBe("-12%");
    expect(capa.style.getPropertyValue("--ui-capa-dy")).toBe("8px");
  });
});

describe("Placeholder — imagen pendiente del sistema (§3.3)", () => {
  it("expone su `label` como nombre accesible y su id para imagenes-pendientes.md", () => {
    render(<Placeholder imageId="landing-hero" label="Pareja riendo con papel picado al fondo" />);
    const marco = screen.getByRole("img", { name: "Pareja riendo con papel picado al fondo" });
    expect(marco.getAttribute("data-imagen-pendiente")).toBe("landing-hero");
    expect(marco.querySelector("title")?.textContent).toBe("Pareja riendo con papel picado al fondo");
  });

  it("pinta el degradado de dos tonos `-soft` y el icono de dos tonos, sin un solo hex", () => {
    const { container } = render(<Placeholder label="foto" tones={["primary-soft", "support-2-soft"]} />);
    const paradas = container.querySelectorAll("stop");
    expect(paradas[0]?.getAttribute("stop-color")).toBe("var(--ui-primary-soft)");
    expect(paradas[1]?.getAttribute("stop-color")).toBe("var(--ui-support-2-soft)");
    expect(container.querySelector("g")?.getAttribute("stroke")).toBe("var(--ui-primary)");
    expect(container.querySelector("g")?.getAttribute("stroke-width")).toBe("1.75");
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("`decorative` lo saca del árbol accesible", () => {
    const { container } = render(<Placeholder label="foto" decorative />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });
});
