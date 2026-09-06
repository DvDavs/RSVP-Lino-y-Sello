import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Stepper } from "./Stepper.tsx";

expect.extend(toHaveNoViolations);

function StepperControlado({ min = 0, max = 10 }: { readonly min?: number; readonly max?: number }) {
  const [valor, setValor] = useState(2);
  return <Stepper value={valor} onChange={setValor} min={min} max={max} label="lugares para la boda" />;
}

describe("Stepper (numérico)", () => {
  it("es un grupo nombrado con dos botones que nombran el campo, nunca mudos", () => {
    render(<StepperControlado />);
    expect(screen.getByRole("group", { name: "lugares para la boda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restar: lugares para la boda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sumar: lugares para la boda" })).toBeInTheDocument();
  });

  it("los botones cumplen el objetivo táctil ≥ 44 px", () => {
    render(<StepperControlado />);
    for (const boton of screen.getAllByRole("button")) {
      expect(boton.className).toMatch(/h-11/);
      expect(boton.className).toMatch(/w-11/);
    }
  });

  it("sumar y restar cambian el valor mostrado", async () => {
    const usuario = userEvent.setup();
    render(<StepperControlado />);
    expect(screen.getByText("2")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Sumar: lugares para la boda" }));
    expect(screen.getByText("3")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Restar: lugares para la boda" }));
    await usuario.click(screen.getByRole("button", { name: "Restar: lugares para la boda" }));
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("se deshabilita al llegar al mínimo o al máximo, sin bajar/subir de ahí", async () => {
    const usuario = userEvent.setup();
    render(<Stepper value={0} onChange={() => {}} min={0} max={2} label="acompañantes" />);
    expect(screen.getByRole("button", { name: "Restar: acompañantes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sumar: acompañantes" })).toBeEnabled();
    await usuario.click(screen.getByRole("button", { name: "Restar: acompañantes" }));
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("sin violaciones de a11y", async () => {
    const { container } = render(<StepperControlado />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
