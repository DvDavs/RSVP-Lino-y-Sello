import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip.tsx";

expect.extend(toHaveNoViolations);

describe("Tooltip", () => {
  it("aparece con el foco de teclado (sin esperar el retardo del ratón) y es role=tooltip", async () => {
    const usuario = userEvent.setup();
    render(
      <Tooltip content="Deshacer (Ctrl+Z)">
        <button type="button">Deshacer</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await usuario.tab();
    expect(screen.getByRole("button", { name: "Deshacer" })).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Deshacer (Ctrl+Z)");
  });

  it("el disparador queda descrito por el tooltip (aria-describedby)", async () => {
    const usuario = userEvent.setup();
    render(
      <Tooltip content="Guardar (Ctrl+S)">
        <button type="button">Guardar</button>
      </Tooltip>,
    );
    await usuario.tab();
    const tooltip = await screen.findByRole("tooltip");
    const boton = screen.getByRole("button", { name: "Guardar" });
    expect(boton.getAttribute("aria-describedby")).toBe(tooltip.id);
  });

  it("se cierra al perder el foco y no deja violaciones de a11y mientras está abierto", async () => {
    const usuario = userEvent.setup();
    const { container } = render(
      <div>
        <Tooltip content="Deshacer (Ctrl+Z)">
          <button type="button">Deshacer</button>
        </Tooltip>
        <button type="button">Otro control</button>
      </div>,
    );
    await usuario.tab();
    await screen.findByRole("tooltip");
    expect(await axe(container)).toHaveNoViolations();

    await usuario.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
