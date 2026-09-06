import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Textarea } from "./Textarea.tsx";

const user = userEvent.setup();

describe("Textarea", () => {
  it("alto mínimo de 96 px", () => {
    render(<Textarea aria-label="Mensaje" />);
    const alto = Number.parseFloat(getComputedStyle(screen.getByRole("textbox")).minHeight);
    expect(alto).toBe(96);
  });

  it("sin límite, no muestra contador", () => {
    render(<Textarea aria-label="Mensaje" />);
    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument();
  });

  it("con límite, el contador aparece solo al 80 %", async () => {
    render(<Textarea aria-label="Mensaje" limite={10} />);
    const control = screen.getByRole("textbox");
    expect(screen.queryByText("0/10")).not.toBeInTheDocument();
    await user.type(control, "12345");
    expect(screen.queryByText("5/10")).not.toBeInTheDocument();
    await user.type(control, "123");
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(control).toHaveAttribute("aria-describedby");
  });

  it("respeta maxLength del límite", async () => {
    render(<Textarea aria-label="Mensaje" limite={5} />);
    const control = screen.getByRole("textbox");
    expect(control).toHaveAttribute("maxlength", "5");
  });

  it("anillo de foco medible", async () => {
    render(<Textarea aria-label="Mensaje" />);
    const control = screen.getByRole("textbox");
    await user.tab();
    expect(getComputedStyle(control).boxShadow).toContain("var(--ui-focus)");
  });

  it("invalido marca aria-invalid", () => {
    render(<Textarea aria-label="Mensaje" invalido />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("sin violaciones de axe", async () => {
    const { container } = render(
      <div>
        <Textarea aria-label="Mensaje" limite={280} defaultValue={"a".repeat(250)} />
        <Textarea aria-label="Deshabilitado" disabled />
      </div>,
    );
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
