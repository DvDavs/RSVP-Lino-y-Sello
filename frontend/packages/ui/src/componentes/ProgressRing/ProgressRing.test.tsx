import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";
import { ProgressRing } from "./ProgressRing.tsx";

expect.extend(toHaveNoViolations);

describe("ProgressRing", () => {
  it("es role=progressbar con aria-valuenow/valuetext y el número SIEMPRE visible como texto", () => {
    render(<ProgressRing value={60} label="Progreso de tu invitación" />);
    const anillo = screen.getByRole("progressbar", { name: "Progreso de tu invitación" });
    expect(anillo).toHaveAttribute("aria-valuenow", "60");
    expect(anillo).toHaveAttribute("aria-valuetext", "60 %");
    expect(screen.getByText("60 %")).toBeInTheDocument();
  });

  it("al completarse (100 %), sigue reportando el valor mientras muestra el acabado", () => {
    render(<ProgressRing value={100} label="Progreso de tu invitación" />);
    const anillo = screen.getByRole("progressbar");
    expect(anillo).toHaveAttribute("aria-valuenow", "100");
    expect(anillo).toHaveAttribute("aria-valuetext", "100 %");
  });

  it("indeterminado: sin aria-valuenow, pero con aria-valuetext y texto «Cargando…»", () => {
    render(<ProgressRing indeterminate label="Publicando tu invitación" />);
    const anillo = screen.getByRole("progressbar", { name: "Publicando tu invitación" });
    expect(anillo).not.toHaveAttribute("aria-valuenow");
    expect(anillo).toHaveAttribute("aria-valuetext", "Cargando…");
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  it("no deja violaciones de a11y en ninguno de sus tres estados", async () => {
    for (const props of [{ value: 60 }, { value: 100 }, { indeterminate: true }] as const) {
      const { container, unmount } = render(<ProgressRing {...props} label="Progreso" />);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
});
