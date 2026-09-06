import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Card } from "./Card.tsx";

expect.extend(toHaveNoViolations);

describe("Card", () => {
  it("se monta como <article> por defecto, con contenido", () => {
    render(<Card>Contenido</Card>);
    expect(screen.getByText("Contenido").closest("article")).not.toBeNull();
  });

  it("admite `as` para cambiar el elemento raíz", () => {
    render(<Card as="section">Contenido</Card>);
    expect(screen.getByText("Contenido").closest("section")).not.toBeNull();
    expect(screen.queryByText("Contenido")?.closest("article")).toBeNull();
  });

  it.each(["plana", "elevada", "tinta"] as const)("variante %s no introduce violaciones de a11y", async (variant) => {
    const { container } = render(<Card variant={variant}>Texto de la tarjeta</Card>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("variante `color` envuelve el contenido en ColorShadow (una sombra sólida, sin difuminar)", () => {
    const { container } = render(<Card variant="color">Destacada</Card>);
    const envoltorio = container.querySelector("[data-tono]");
    expect(envoltorio).not.toBeNull();
    expect(envoltorio?.getAttribute("data-tono")).toBe("support-2");
    expect(screen.getByText("Destacada").closest("article")?.className).not.toMatch(/shadow-ui-2/);
  });

  it("variante `tinta` acepta un tono de apoyo distinto", () => {
    render(
      <Card variant="tinta" tone="support-1">
        Aviso
      </Card>,
    );
    const tarjeta = screen.getByText("Aviso").closest("article");
    expect(tarjeta?.className).toMatch(/support-1-soft/);
    expect(tarjeta?.className).toMatch(/support-1-deep/);
  });

  it("nunca añade una transición de elevación en hover (11 §6.2 regla 3: la rejilla no salta)", () => {
    render(<Card variant="elevada">Fila de rejilla</Card>);
    const tarjeta = screen.getByText("Fila de rejilla").closest("article");
    expect(tarjeta?.className).not.toMatch(/hover:-translate-y|hover:translate-y/);
  });
});
