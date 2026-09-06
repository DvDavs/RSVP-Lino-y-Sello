import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Button } from "./Button.tsx";

const user = userEvent.setup();

describe("Button", () => {
  it("tiene rol de botón y nombre accesible por texto", () => {
    render(<Button>Publicar</Button>);
    expect(screen.getByRole("button", { name: "Publicar" })).toBeInTheDocument();
  });

  it("un botón de icono se anuncia por aria-label", () => {
    render(
      <Button variant="icono" aria-label="Cerrar">
        <svg aria-hidden />
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it.each(["sm", "md", "lg"] as const)("tamaño %s cumple el objetivo mínimo (>= 24 px) y su alto declarado", (tamano) => {
    const alturas = { sm: 36, md: 44, lg: 52 };
    render(<Button size={tamano}>Guardar</Button>);
    const boton = screen.getByRole("button");
    const alto = Number.parseFloat(getComputedStyle(boton).height);
    expect(alto).toBe(alturas[tamano]);
    expect(alto).toBeGreaterThanOrEqual(24);
  });

  it("responde a click con el puntero", async () => {
    const alHacerClic = vi.fn();
    render(<Button onClick={alHacerClic}>Guardar</Button>);
    await user.click(screen.getByRole("button"));
    expect(alHacerClic).toHaveBeenCalledTimes(1);
  });

  it("responde a Enter y a Espacio tras llegar por teclado", async () => {
    const alHacerClic = vi.fn();
    render(<Button onClick={alHacerClic}>Guardar</Button>);
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(alHacerClic).toHaveBeenCalledTimes(2);
  });

  it("muestra el anillo de foco (halo de superficie + foco) al recibir el foco por teclado", async () => {
    render(<Button>Guardar</Button>);
    const boton = screen.getByRole("button");
    expect(getComputedStyle(boton).boxShadow).toBe("");
    await user.tab();
    const sombra = getComputedStyle(boton).boxShadow;
    expect(sombra).toContain("var(--ui-surface)");
    expect(sombra).toContain("var(--ui-focus)");
    await user.tab();
    expect(getComputedStyle(boton).boxShadow).toBe("");
  });

  it("la variante secundaria conserva su borde propio y le suma el anillo al enfocar", async () => {
    render(<Button variant="secundario">Ver como invitado</Button>);
    const boton = screen.getByRole("button");
    expect(getComputedStyle(boton).boxShadow).toContain("var(--ui-primary)");
    await user.tab();
    const sombra = getComputedStyle(boton).boxShadow;
    expect(sombra).toContain("var(--ui-primary)");
    expect(sombra).toContain("var(--ui-focus)");
  });

  it("cargando: aria-busy, texto visible y deshabilitado", () => {
    render(
      <Button loading loadingText="Publicando…">
        Publicar
      </Button>,
    );
    const boton = screen.getByRole("button");
    expect(boton).toHaveAttribute("aria-busy", "true");
    expect(boton).toBeDisabled();
    expect(boton).toHaveTextContent("Publicando…");
  });

  it("deshabilitado no dispara el click", async () => {
    const alHacerClic = vi.fn();
    render(
      <Button disabled onClick={alHacerClic}>
        Publicar
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(alHacerClic).not.toHaveBeenCalled();
  });

  it("asChild renderiza el hijo (un enlace) con el aspecto del botón, sin envolver en <button>", () => {
    render(
      <Button asChild>
        <a href="/editor">Empezar</a>
      </Button>,
    );
    const enlace = screen.getByRole("link", { name: "Empezar" });
    expect(enlace).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sin violaciones de axe en sus variantes", async () => {
    const { container } = render(
      <div>
        <Button>Primario</Button>
        <Button variant="secundario">Secundario</Button>
        <Button variant="terciario">Terciario</Button>
        <Button variant="peligro">Despublicar</Button>
        <Button variant="acento">Mejorar plan</Button>
        <Button variant="icono" aria-label="Cerrar">
          <svg aria-hidden />
        </Button>
        <Button loading>Publicando</Button>
        <Button disabled>Deshabilitado</Button>
      </div>,
    );
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
