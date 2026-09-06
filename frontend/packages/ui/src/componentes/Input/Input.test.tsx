import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Input } from "./Input.tsx";
import { Field } from "../Field/Field.tsx";

const user = userEvent.setup();

describe("Input", () => {
  it("alto de control de 46 px (objetivo >= 24 px)", () => {
    render(<Input aria-label="Correo" />);
    const alto = Number.parseFloat(getComputedStyle(screen.getByRole("textbox")).height);
    expect(alto).toBe(46);
    expect(alto).toBeGreaterThanOrEqual(24);
  });

  it("acepta texto y notifica onChange", async () => {
    const alCambiar = vi.fn();
    render(<Input aria-label="Correo" onChange={alCambiar} />);
    await user.type(screen.getByRole("textbox"), "hola");
    expect(alCambiar).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("textbox")).toHaveValue("hola");
  });

  it("anillo de foco al enfocar por teclado, ausente en reposo", async () => {
    render(<Input aria-label="Correo" />);
    const control = screen.getByRole("textbox");
    const reposo = getComputedStyle(control).boxShadow;
    expect(reposo).toContain("var(--ui-border)");
    expect(reposo).not.toContain("var(--ui-focus)");
    await user.tab();
    const enFoco = getComputedStyle(control).boxShadow;
    expect(enFoco).toContain("var(--ui-primary)");
    expect(enFoco).toContain("var(--ui-surface)");
    expect(enFoco).toContain("var(--ui-focus)");
  });

  it("invalido marca aria-invalid y pinta el borde de danger", () => {
    render(<Input aria-label="Correo" invalido />);
    const control = screen.getByRole("textbox");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(getComputedStyle(control).boxShadow).toContain("var(--ui-danger)");
  });

  it("deshabilitado no acepta foco ni texto", async () => {
    render(<Input aria-label="Correo" disabled />);
    const control = screen.getByRole("textbox");
    expect(control).toBeDisabled();
    await user.tab();
    expect(control).not.toHaveFocus();
  });

  it("dentro de Field, el error queda enlazado por aria-describedby", () => {
    render(
      <Field label="Correo electrónico" error="Revisa el correo: le falta el dominio.">
        <Input />
      </Field>,
    );
    const control = screen.getByLabelText("Correo electrónico");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(control.getAttribute("aria-describedby")!)).toHaveTextContent(
      "Revisa el correo",
    );
  });

  it("sin violaciones de axe", async () => {
    const { container } = render(
      <div>
        <Field label="Correo electrónico" hint="Ayuda">
          <Input type="email" />
        </Field>
        <Input aria-label="Solo lectura" readOnly defaultValue="mariana@correo.com" />
        <Input aria-label="Deshabilitado" disabled />
      </div>,
    );
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
