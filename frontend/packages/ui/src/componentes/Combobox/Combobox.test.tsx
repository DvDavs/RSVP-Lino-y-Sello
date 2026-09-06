import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Combobox } from "./Combobox.tsx";

const user = userEvent.setup();

const OPCIONES = [
  { value: "boda", label: "Boda" },
  { value: "xv", label: "XV años" },
  { value: "bautizo", label: "Bautizo" },
  { value: "comunion", label: "Primera comunión" },
  { value: "corporativo", label: "Corporativo", disabled: true },
  { value: "graduacion", label: "Graduación" },
];

describe("Combobox", () => {
  it("es un combobox cerrado que abre el panel al enfocar", async () => {
    render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} placeholder="Buscar…" />);
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    expect(campo).toHaveAttribute("aria-expanded", "false");
    await user.click(campo);
    expect(campo).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(listbox.querySelectorAll('[role="option"]')).toHaveLength(OPCIONES.length);
  });

  it("escribir filtra las opciones y anuncia sin resultados si no hay ninguna", async () => {
    render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} />);
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    await user.type(campo, "bo");
    expect(screen.getByRole("option", { name: "Boda" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "XV años" })).not.toBeInTheDocument();
    await user.clear(campo);
    await user.type(campo, "zzz");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText("Sin resultados para «zzz».")).toBeInTheDocument();
  });

  it("las flechas mueven aria-activedescendant y Enter selecciona", async () => {
    const alCambiar = vi.fn();
    render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} onValueChange={alCambiar} />);
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    await user.click(campo);
    await user.keyboard("{ArrowDown}");
    const primeraOpcion = screen.getByRole("option", { name: "Boda" });
    expect(campo).toHaveAttribute("aria-activedescendant", primeraOpcion.id);
    await user.keyboard("{ArrowDown}");
    const segundaOpcion = screen.getByRole("option", { name: "XV años" });
    expect(campo).toHaveAttribute("aria-activedescendant", segundaOpcion.id);
    await user.keyboard("{Enter}");
    expect(alCambiar).toHaveBeenCalledWith("xv");
    expect(campo).toHaveValue("XV años");
    expect(campo).toHaveAttribute("aria-expanded", "false");
  });

  it("Fin y las flechas hacia arriba también mueven el resaltado", async () => {
    render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} />);
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    await user.click(campo);
    await user.keyboard("{End}");
    const ultima = screen.getByRole("option", { name: "Graduación" });
    expect(campo).toHaveAttribute("aria-activedescendant", ultima.id);
    await user.keyboard("{ArrowUp}");
    const penultima = screen.getByRole("option", { name: "Corporativo" });
    expect(campo).toHaveAttribute("aria-activedescendant", penultima.id);
    await user.keyboard("{Home}");
    const primera = screen.getByRole("option", { name: "Boda" });
    expect(campo).toHaveAttribute("aria-activedescendant", primera.id);
  });

  it("perder el foco (tab afuera) cierra el panel y revierte el texto sin escoger", async () => {
    render(
      <div>
        <Combobox aria-label="Tipo de evento" opciones={OPCIONES} defaultValue="boda" />
        <button type="button">Otro control</button>
      </div>,
    );
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    await user.click(campo);
    await user.type(campo, "graduacion");
    await user.tab();
    expect(campo).toHaveAttribute("aria-expanded", "false");
    expect(campo).toHaveValue("Boda");
  });

  it("Escape cierra y revierte el texto sin escoger", async () => {
    render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} defaultValue="boda" />);
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    expect(campo).toHaveValue("Boda");
    await user.click(campo);
    await user.type(campo, "graduacion");
    await user.keyboard("{Escape}");
    expect(campo).toHaveAttribute("aria-expanded", "false");
    expect(campo).toHaveValue("Boda");
  });

  it("una opción deshabilitada no se puede elegir con el ratón", async () => {
    const alCambiar = vi.fn();
    render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} onValueChange={alCambiar} />);
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    await user.click(campo);
    const corporativo = screen.getByRole("option", { name: "Corporativo" });
    expect(corporativo).toHaveAttribute("aria-disabled", "true");
    await user.click(corporativo);
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("clic en una opción selecciona pese al blur del campo", async () => {
    const alCambiar = vi.fn();
    render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} onValueChange={alCambiar} />);
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    await user.click(campo);
    await user.click(screen.getByRole("option", { name: "Graduación" }));
    expect(alCambiar).toHaveBeenCalledWith("graduacion");
    expect(campo).toHaveValue("Graduación");
  });

  it("anillo de foco medible en el control", async () => {
    render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} />);
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    const control = campo.parentElement!;
    expect(Number.parseFloat(getComputedStyle(control).height)).toBe(46);
    expect(getComputedStyle(control).boxShadow).not.toContain("var(--ui-focus)");
    await user.click(campo);
    expect(getComputedStyle(control).boxShadow).toContain("var(--ui-focus)");
  });

  it("deshabilitado no abre el panel", async () => {
    render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} disabled />);
    const campo = screen.getByRole("combobox", { name: "Tipo de evento" });
    expect(campo).toBeDisabled();
  });

  it("sin violaciones de axe con el panel abierto", async () => {
    const { container } = render(<Combobox aria-label="Tipo de evento" opciones={OPCIONES} />);
    await user.click(screen.getByRole("combobox"));
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
