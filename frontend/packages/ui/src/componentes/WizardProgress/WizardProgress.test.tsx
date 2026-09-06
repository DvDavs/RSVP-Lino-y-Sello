import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";
import { WizardProgress } from "./WizardProgress.tsx";

expect.extend(toHaveNoViolations);

const pasos = [
  { id: "evento", etiqueta: "Evento", estado: "hecho" as const, href: "/editor?paso=evento" },
  { id: "plantilla", etiqueta: "Plantilla", estado: "actual" as const },
  { id: "datos", etiqueta: "Datos", estado: "pendiente" as const },
  { id: "editor", etiqueta: "Editor", estado: "pendiente" as const },
];

describe("WizardProgress", () => {
  it('muestra el texto "Paso N de M" con el paso actual', () => {
    render(<WizardProgress pasos={pasos} />);
    expect(screen.getByText(/Paso 2 de 4/)).toBeInTheDocument();
  });

  it("el paso actual lleva aria-current=step y ninguno otro", () => {
    render(<WizardProgress pasos={pasos} />);
    const actuales = screen.getAllByText("Plantilla", { selector: '[aria-current="step"]' });
    expect(actuales).toHaveLength(1);
    expect(screen.getByText("Datos")).not.toHaveAttribute("aria-current");
  });

  it("los pasos hechos son enlaces; los demás no", () => {
    render(<WizardProgress pasos={pasos} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/editor?paso=evento");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("sin violaciones de a11y", async () => {
    const { container } = render(<WizardProgress pasos={pasos} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("un paso en error muestra el icono de alerta en vez del número", () => {
    const conError = [
      { id: "datos", etiqueta: "Datos", estado: "error" as const },
      { id: "editor", etiqueta: "Editor", estado: "pendiente" as const },
    ];
    const { container } = render(<WizardProgress pasos={conError} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
