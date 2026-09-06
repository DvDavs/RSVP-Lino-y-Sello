import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Chip } from "./Chip.tsx";

const user = userEvent.setup();

function ChipSeleccionable() {
  const [seleccionado, setSeleccionado] = useState(false);
  return (
    <Chip seleccionado={seleccionado} onClick={() => setSeleccionado((v) => !v)}>
      Jardín
    </Chip>
  );
}

describe("Chip", () => {
  it("alto de 34 px (objetivo >= 24 px)", () => {
    render(<Chip>Jardín</Chip>);
    const alto = Number.parseFloat(getComputedStyle(screen.getByRole("button", { name: "Jardín" })).height);
    expect(alto).toBe(34);
    expect(alto).toBeGreaterThanOrEqual(24);
  });

  it("seleccionable: aria-pressed alterna con el clic", async () => {
    render(<ChipSeleccionable />);
    const chip = screen.getByRole("button", { name: "Jardín" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("sin seleccionado no lleva aria-pressed (acción simple)", () => {
    render(<Chip onClick={vi.fn()}>Compartir</Chip>);
    expect(screen.getByRole("button", { name: "Compartir" })).not.toHaveAttribute("aria-pressed");
  });

  it("cerrable: el botón de cierre tiene su propio nombre accesible y dispara onCerrar", async () => {
    const alCerrar = vi.fn();
    render(
      <Chip onCerrar={alCerrar} labelCerrar="Quitar Jardín">
        Jardín
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Jardín" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar Jardín" }));
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it("anillo de foco medible en el chip principal", async () => {
    render(<Chip>Jardín</Chip>);
    await user.tab();
    expect(getComputedStyle(screen.getByRole("button", { name: "Jardín" })).boxShadow).toContain("var(--ui-focus)");
  });

  it("deshabilitado no dispara clic", async () => {
    const alHacerClic = vi.fn();
    render(
      <Chip disabled onClick={alHacerClic}>
        Jardín
      </Chip>,
    );
    await user.click(screen.getByRole("button", { name: "Jardín" }));
    expect(alHacerClic).not.toHaveBeenCalled();
  });

  it("sin violaciones de axe", async () => {
    const { container } = render(
      <div>
        <Chip>Jardín</Chip>
        <Chip seleccionado>Jardín</Chip>
        <Chip tono="exito">128 confirmados</Chip>
        <Chip tono="peligro">Falta el lugar</Chip>
        <Chip onCerrar={vi.fn()} labelCerrar="Quitar Jardín">
          Jardín
        </Chip>
        <Chip disabled>Jardín</Chip>
      </div>,
    );
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
