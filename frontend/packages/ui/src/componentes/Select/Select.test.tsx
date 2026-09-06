import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Select } from "./Select.tsx";

const user = userEvent.setup();

const OPCIONES = [
  { value: "boda", label: "Boda" },
  { value: "xv", label: "XV años" },
  { value: "bautizo", label: "Bautizo" },
  { value: "comunion", label: "Primera comunión" },
  { value: "corporativo", label: "Corporativo", disabled: true, motivo: "Requiere el plan 2" },
] as const;

describe("Select", () => {
  it("el disparador es un combobox de 44 px con el placeholder cuando no hay valor", () => {
    render(<Select aria-label="Tipo de evento" opciones={[...OPCIONES]} placeholder="Elige un tipo" />);
    const disparador = screen.getByRole("combobox", { name: "Tipo de evento" });
    expect(disparador).toHaveTextContent("Elige un tipo");
    expect(Number.parseFloat(getComputedStyle(disparador).height)).toBe(44);
  });

  it("abre con el teclado (Enter), navega con flechas y selecciona con Enter", async () => {
    const alCambiar = vi.fn();
    render(<Select aria-label="Tipo de evento" opciones={[...OPCIONES]} onValueChange={alCambiar} />);
    const disparador = screen.getByRole("combobox", { name: "Tipo de evento" });
    disparador.focus();
    await user.keyboard("{Enter}");
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(5);
    // Sin valor previo, Radix ya resalta la primera opción al abrir; una flecha más pasa a la
    // segunda ("XV años").
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(alCambiar).toHaveBeenCalledWith("xv");
  });

  it("Esc cierra el panel sin seleccionar", async () => {
    render(<Select aria-label="Tipo de evento" opciones={[...OPCIONES]} />);
    const disparador = screen.getByRole("combobox", { name: "Tipo de evento" });
    disparador.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(disparador).toHaveFocus();
  });

  it("una opción deshabilitada muestra su motivo y no se puede elegir", async () => {
    render(<Select aria-label="Tipo de evento" opciones={[...OPCIONES]} />);
    const disparador = screen.getByRole("combobox", { name: "Tipo de evento" });
    disparador.focus();
    await user.keyboard("{Enter}");
    const listbox = await screen.findByRole("listbox");
    const opcionCorporativo = within(listbox).getByRole("option", { name: /Corporativo/ });
    expect(opcionCorporativo).toHaveAttribute("aria-disabled", "true");
    expect(within(opcionCorporativo).getByText("Requiere el plan 2")).toBeInTheDocument();
  });

  it("anillo de foco medible en el disparador", async () => {
    render(<Select aria-label="Tipo de evento" opciones={[...OPCIONES]} />);
    const disparador = screen.getByRole("combobox", { name: "Tipo de evento" });
    await user.tab();
    expect(getComputedStyle(disparador).boxShadow).toContain("var(--ui-focus)");
  });

  it("deshabilitado no abre el panel", async () => {
    render(<Select aria-label="Tipo de evento" opciones={[...OPCIONES]} disabled />);
    const disparador = screen.getByRole("combobox", { name: "Tipo de evento" });
    expect(disparador).toBeDisabled();
    await user.click(disparador);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("sin violaciones de axe con el panel abierto", async () => {
    const { container } = render(<Select aria-label="Tipo de evento" opciones={[...OPCIONES]} defaultOpen />);
    await screen.findByRole("listbox");
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
