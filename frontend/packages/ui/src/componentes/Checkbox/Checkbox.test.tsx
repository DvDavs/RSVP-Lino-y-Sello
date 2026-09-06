import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Checkbox } from "./Checkbox.tsx";

const user = userEvent.setup();

describe("Checkbox", () => {
  it("rol checkbox de 26 px (objetivo >= 24 px) sin marcar por defecto", () => {
    render(<Checkbox aria-label="Mostrar «Nuestra historia»" />);
    const casilla = screen.getByRole("checkbox", { name: "Mostrar «Nuestra historia»" });
    expect(casilla).toHaveAttribute("aria-checked", "false");
    const ancho = Number.parseFloat(getComputedStyle(casilla).width);
    const alto = Number.parseFloat(getComputedStyle(casilla).height);
    expect(ancho).toBe(26);
    expect(alto).toBe(26);
    expect(alto).toBeGreaterThanOrEqual(24);
  });

  it("con label, la fila mide al menos 44 px y el clic en el texto marca la casilla", async () => {
    const alCambiar = vi.fn();
    render(<Checkbox label="Mostrar «Nuestra historia»" onCheckedChange={alCambiar} />);
    const etiqueta = screen.getByText("Mostrar «Nuestra historia»");
    const fila = etiqueta.closest("label")!;
    expect(Number.parseFloat(getComputedStyle(fila).minHeight)).toBeGreaterThanOrEqual(44);
    await user.click(etiqueta);
    expect(alCambiar).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });

  it("Espacio marca y desmarca tras llegar por teclado", async () => {
    render(<Checkbox aria-label="Aceptar" />);
    await user.tab();
    const casilla = screen.getByRole("checkbox");
    expect(casilla).toHaveFocus();
    await user.keyboard(" ");
    expect(casilla).toHaveAttribute("aria-checked", "true");
    await user.keyboard(" ");
    expect(casilla).toHaveAttribute("aria-checked", "false");
  });

  it("anillo de foco medible", async () => {
    render(<Checkbox aria-label="Aceptar" />);
    const casilla = screen.getByRole("checkbox");
    expect(getComputedStyle(casilla).boxShadow).toContain("var(--ui-border)");
    await user.tab();
    const sombra = getComputedStyle(casilla).boxShadow;
    expect(sombra).toContain("var(--ui-focus)");
  });

  it("deshabilitada no responde a clic ni teclado", async () => {
    const alCambiar = vi.fn();
    render(<Checkbox aria-label="Aceptar" disabled onCheckedChange={alCambiar} />);
    const casilla = screen.getByRole("checkbox");
    expect(casilla).toBeDisabled();
    await user.click(casilla);
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("sin violaciones de axe", async () => {
    const { container } = render(
      <div>
        <Checkbox label="Mostrar «Nuestra historia»" />
        <Checkbox label="Con nota" defaultChecked meta="2 lugares" />
        <Checkbox aria-label="Solo casilla" />
        <Checkbox aria-label="Deshabilitada" disabled />
      </div>,
    );
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
