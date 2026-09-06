import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Switch } from "./Switch.tsx";

const user = userEvent.setup();

describe("Switch", () => {
  it("rol switch de 48 x 28 (objetivo >= 24 px de alto)", () => {
    render(<Switch aria-label="Mostrar «Nuestra historia»" />);
    const interruptor = screen.getByRole("switch");
    expect(interruptor).toHaveAttribute("aria-checked", "false");
    expect(Number.parseFloat(getComputedStyle(interruptor).width)).toBe(48);
    const alto = Number.parseFloat(getComputedStyle(interruptor).height);
    expect(alto).toBe(28);
    expect(alto).toBeGreaterThanOrEqual(24);
  });

  it("con label, el clic en el texto lo activa", async () => {
    const alCambiar = vi.fn();
    render(<Switch label="Mostrar «Nuestra historia»" onCheckedChange={alCambiar} />);
    await user.click(screen.getByText("Mostrar «Nuestra historia»"));
    expect(alCambiar).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("Espacio activa y desactiva tras llegar por teclado", async () => {
    render(<Switch aria-label="Aceptar" />);
    await user.tab();
    const interruptor = screen.getByRole("switch");
    expect(interruptor).toHaveFocus();
    await user.keyboard(" ");
    expect(interruptor).toHaveAttribute("aria-checked", "true");
    await user.keyboard(" ");
    expect(interruptor).toHaveAttribute("aria-checked", "false");
  });

  it("anillo de foco medible", async () => {
    render(<Switch aria-label="Aceptar" />);
    const interruptor = screen.getByRole("switch");
    expect(getComputedStyle(interruptor).boxShadow).toBe("");
    await user.tab();
    expect(getComputedStyle(interruptor).boxShadow).toContain("var(--ui-focus)");
  });

  it("deshabilitado no responde", async () => {
    const alCambiar = vi.fn();
    render(<Switch aria-label="Aceptar" disabled onCheckedChange={alCambiar} />);
    const interruptor = screen.getByRole("switch");
    expect(interruptor).toBeDisabled();
    await user.click(interruptor);
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("sin violaciones de axe", async () => {
    const { container } = render(
      <div>
        <Switch label="Mostrar «Nuestra historia»" />
        <Switch label="Encendido" defaultChecked />
        <Switch aria-label="Deshabilitado" disabled />
      </div>,
    );
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
