// packages/ui/test/ilustraciones.test.tsx — cubre `<Ilustracion nombre="..." />` (11 §4.3): las
// tres decorativas (`aria-hidden`), el tamaño por defecto 160 y el `size` explícito, y que cada
// nombre resuelve al dibujo correcto (una pieza propia por ilustración, sin duplicar el mismo SVG).
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorGenerico, Ilustracion, SinFotos, SinInvitaciones } from "../src/ilustraciones/index.ts";
import type { NombreIlustracion } from "../src/ilustraciones/index.ts";

const NOMBRES: readonly NombreIlustracion[] = ["sin-invitaciones", "sin-fotos", "error-generico"];

describe("Ilustracion", () => {
  it.each(NOMBRES)("nombre=%s: es puramente decorativa (aria-hidden) y usa la retícula de 160", (nombre) => {
    const { container } = render(<Ilustracion nombre={nombre} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 160 160");
    expect(svg).toHaveAttribute("width", "160");
    expect(svg).toHaveAttribute("height", "160");
  });

  it("respeta `size`", () => {
    const { container } = render(<Ilustracion nombre="sin-invitaciones" size={120} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "120");
    expect(svg).toHaveAttribute("height", "120");
  });

  it("cada nombre resuelve al componente correspondiente (no las tres al mismo dibujo)", () => {
    const salidas = NOMBRES.map((nombre) => render(<Ilustracion nombre={nombre} />).container.innerHTML);
    expect(new Set(salidas).size).toBe(NOMBRES.length);
  });

  it("los tres componentes con nombre propio siguen la misma gramática (trazo 4-4,5, sobre sello primary-soft)", () => {
    for (const Componente of [SinInvitaciones, SinFotos, ErrorGenerico]) {
      const { container } = render(<Componente />);
      const svg = container.querySelector("svg")!;
      expect(svg.innerHTML).toContain("var(--ui-primary-soft)");
      const anchos = [...svg.querySelectorAll("[stroke-width]")].map((el) => el.getAttribute("stroke-width"));
      for (const ancho of anchos) expect(["4", "4.5"]).toContain(ancho);
    }
  });
});
