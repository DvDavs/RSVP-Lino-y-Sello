// test/componentes.test.tsx (3C-3B, adaptado a la convención `Icono<Nombre>` de 3C-3A al integrar) — contrato de accesibilidad de los componentes generados (11 §4.1):
// con `title` son `role="img"` con nombre accesible; sin `title`, decorativos (`aria-hidden`).
// También cubre `tone`, `size`, `iconNames` y el `<Icon name="..." />` genérico de `src/index.ts`.
import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { IconoCumpleanos, IconoHistoria, Icon, iconNames } from "../src/index.ts";

describe("componentes generados", () => {
  it("con title: role=img y nombre accesible; sin title: aria-hidden", () => {
    const conTitulo = render(<IconoHistoria title="Nuestra historia" />);
    const svgConTitulo = conTitulo.container.querySelector("svg")!;
    expect(svgConTitulo).toHaveAttribute("role", "img");
    expect(svgConTitulo).not.toHaveAttribute("aria-hidden");
    expect(conTitulo.getByText("Nuestra historia").tagName).toBe("title");

    const sinTitulo = render(<IconoHistoria />);
    const svgSinTitulo = sinTitulo.container.querySelector("svg")!;
    expect(svgSinTitulo).toHaveAttribute("aria-hidden", "true");
    expect(svgSinTitulo).not.toHaveAttribute("role");
  });

  it("size por defecto 24; tamaño explícito se respeta", () => {
    const { container } = render(<IconoHistoria size={48} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });

  it("tone=mono iguala --tono a currentColor (un solo trazo); duo (por defecto) usa el token suave", () => {
    const mono = render(<IconoCumpleanos tone="mono" />).container.querySelector("svg")!;
    expect(mono.style.getPropertyValue("--tono")).toBe("currentColor");
    const duo = render(<IconoCumpleanos />).container.querySelector("svg")!;
    expect(duo.style.getPropertyValue("--tono")).toBe("var(--ui-primary-soft)");
  });

  it("reenvía la ref al <svg>", () => {
    const ref = createRef<SVGSVGElement>();
    render(<IconoHistoria ref={ref} />);
    expect(ref.current?.tagName.toLowerCase()).toBe("svg");
  });

  it("iconNames tiene 82 nombres únicos, el inventario completo de 11 §4.2", () => {
    expect(iconNames.length).toBe(82);
    expect(new Set(iconNames).size).toBe(82);
  });

  it("Icon genérico renderiza el mismo icono que el componente con nombre propio", () => {
    const porNombre = render(<Icon name="historia" title="x" />).container.innerHTML;
    const porComponente = render(<IconoHistoria title="x" />).container.innerHTML;
    expect(porNombre).toBe(porComponente);
  });
});
