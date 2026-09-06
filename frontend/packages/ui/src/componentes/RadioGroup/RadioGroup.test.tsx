import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { RadioGroup } from "./RadioGroup.tsx";

const user = userEvent.setup();

const OPCIONES = [
  { value: "si", label: "Sí, ahí estaré", meta: "2 lugares" },
  { value: "no", label: "No podré acompañarlos" },
] as const;

describe("RadioGroup", () => {
  it("expone role=radiogroup y un radio por opción, cada uno de 26 px", () => {
    render(<RadioGroup aria-label="Confirmación" opciones={[...OPCIONES]} />);
    expect(screen.getByRole("radiogroup", { name: "Confirmación" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(Number.parseFloat(getComputedStyle(radio).width)).toBe(26);
      expect(Number.parseFloat(getComputedStyle(radio).height)).toBe(26);
    }
  });

  it("cada fila mide al menos 44 px y el clic en el texto selecciona el radio", async () => {
    render(<RadioGroup aria-label="Confirmación" opciones={[...OPCIONES]} />);
    const texto = screen.getByText("Sí, ahí estaré");
    const fila = texto.closest("label")!;
    expect(Number.parseFloat(getComputedStyle(fila).minHeight)).toBeGreaterThanOrEqual(44);
    await user.click(texto);
    expect(screen.getByRole("radio", { name: /Sí, ahí estaré/ })).toHaveAttribute("aria-checked", "true");
  });

  it("las flechas mueven el foco a la siguiente opción (roving tabindex)", async () => {
    render(<RadioGroup aria-label="Confirmación" opciones={[...OPCIONES]} />);
    await user.tab();
    expect(screen.getByRole("radio", { name: /Sí, ahí estaré/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "No podré acompañarlos" })).toHaveFocus();
  });

  it("Espacio selecciona la opción enfocada", async () => {
    const alCambiar = vi.fn();
    render(<RadioGroup aria-label="Confirmación" opciones={[...OPCIONES]} onValueChange={alCambiar} />);
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("radio", { name: /Sí, ahí estaré/ })).toHaveAttribute("aria-checked", "true");
    expect(alCambiar).toHaveBeenCalledWith("si");
  });

  it("el radio marcado pinta su borde con primary, el resto con border", async () => {
    render(<RadioGroup aria-label="Confirmación" opciones={[...OPCIONES]} defaultValue="si" />);
    const marcado = screen.getByRole("radio", { name: /Sí, ahí estaré/ });
    const sinMarcar = screen.getByRole("radio", { name: "No podré acompañarlos" });
    expect(getComputedStyle(marcado).boxShadow).toContain("var(--ui-primary)");
    expect(getComputedStyle(sinMarcar).boxShadow).toContain("var(--ui-border)");
  });

  it("anillo de foco medible en la opción enfocada", async () => {
    render(<RadioGroup aria-label="Confirmación" opciones={[...OPCIONES]} />);
    await user.tab();
    const sombra = getComputedStyle(screen.getByRole("radio", { name: /Sí, ahí estaré/ })).boxShadow;
    expect(sombra).toContain("var(--ui-focus)");
  });

  it("deshabilitado a nivel de grupo, ningún radio responde", async () => {
    const alCambiar = vi.fn();
    render(<RadioGroup aria-label="Confirmación" opciones={[...OPCIONES]} disabled onValueChange={alCambiar} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });

  it("sin violaciones de axe", async () => {
    const { container } = render(<RadioGroup aria-label="Confirmación" opciones={[...OPCIONES]} defaultValue="si" />);
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
