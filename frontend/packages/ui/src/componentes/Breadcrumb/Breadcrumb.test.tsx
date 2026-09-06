import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Breadcrumb } from "./Breadcrumb.tsx";

expect.extend(toHaveNoViolations);

const items = [
  { label: "Mis invitaciones", href: "/mis-invitaciones" },
  { label: "Boda de Mariana y Rodrigo", href: "/mis-invitaciones/1" },
  { label: "Plantilla" },
];

describe("Breadcrumb", () => {
  it("es <nav aria-label='Ruta'> con los tramos como enlaces salvo el último", () => {
    render(<Breadcrumb items={items} />);
    const nav = screen.getByRole("navigation", { name: "Ruta" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mis invitaciones" })).toHaveAttribute("href", "/mis-invitaciones");
    expect(screen.getByRole("link", { name: "Boda de Mariana y Rodrigo" })).toHaveAttribute("href", "/mis-invitaciones/1");
    expect(screen.queryByRole("link", { name: "Plantilla" })).not.toBeInTheDocument();
  });

  it("el último tramo lleva aria-current=page y no es enlace", () => {
    render(<Breadcrumb items={items} />);
    const actual = screen.getByText("Plantilla");
    expect(actual).toHaveAttribute("aria-current", "page");
    expect(actual.tagName).toBe("SPAN");
  });

  it("los separadores «/» son decorativos", () => {
    const { container } = render(<Breadcrumb items={items} />);
    const separadores = container.querySelectorAll('[aria-hidden="true"]');
    expect(separadores).toHaveLength(items.length - 1);
    for (const separador of separadores) expect(separador).toHaveTextContent("/");
  });

  it("sin violaciones de a11y", async () => {
    const { container } = render(<Breadcrumb items={items} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
