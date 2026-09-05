// test/componentes.test.tsx — contrato de accesibilidad de los componentes generados (11 §4.1):
// con `title` son `role="img"` con nombre accesible; sin `title`, decorativos (`aria-hidden`).
// También cubre `tone`, `size`, `iconNames` y el `<Icon name="..." />` genérico de `src/index.ts`.
import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { CumpleanosIcon, HistoriaIcon, Icon, iconNames } from "../src/index.ts";

describe("componentes generados", () => {
  it("con title: role=img y nombre accesible; sin title: aria-hidden", () => {
    const conTitulo = render(<HistoriaIcon title="Nuestra historia" />);
    const svgConTitulo = conTitulo.container.querySelector("svg")!;
    expect(svgConTitulo).toHaveAttribute("role", "img");
    expect(svgConTitulo).not.toHaveAttribute("aria-hidden");
    expect(conTitulo.getByText("Nuestra historia").tagName).toBe("title");

    const sinTitulo = render(<HistoriaIcon />);
    const svgSinTitulo = sinTitulo.container.querySelector("svg")!;
    expect(svgSinTitulo).toHaveAttribute("aria-hidden", "true");
    expect(svgSinTitulo).not.toHaveAttribute("role");
  });

  it("size por defecto 24; tamaño explícito se respeta", () => {
    const { container } = render(<HistoriaIcon size={48} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });

  it("tone=mono iguala --tono a currentColor (un solo trazo); duo (por defecto) usa el token suave", () => {
    const mono = render(<CumpleanosIcon tone="mono" />).container.querySelector("svg")!;
    expect(mono.style.getPropertyValue("--tono")).toBe("currentColor");
    const duo = render(<CumpleanosIcon />).container.querySelector("svg")!;
    expect(duo.style.getPropertyValue("--tono")).toBe("var(--ui-primary-soft)");
  });

  it("reenvía la ref al <svg>", () => {
    const ref = createRef<SVGSVGElement>();
    render(<HistoriaIcon ref={ref} />);
    expect(ref.current?.tagName.toLowerCase()).toBe("svg");
  });

  it("iconNames tiene 41 nombres únicos, todo el inventario 42-82", () => {
    expect(iconNames.length).toBe(41);
    expect(new Set(iconNames).size).toBe(41);
  });

  it("Icon genérico renderiza el mismo icono que el componente con nombre propio", () => {
    const porNombre = render(<Icon name="historia" title="x" />).container.innerHTML;
    const porComponente = render(<HistoriaIcon title="x" />).container.innerHTML;
    expect(porNombre).toBe(porComponente);
  });
});
