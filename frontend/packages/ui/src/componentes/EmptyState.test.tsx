// packages/ui/src/componentes/EmptyState.test.tsx — cubre `11 §5` fila «EmptyState»: ilustración +
// título + frase + una acción (por enlace o por botón), y el caso sin acción.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState.tsx";

// Sin `globals: true` en `vitest.config.ts`, `@testing-library/react` no registra la limpieza sola:
// sin esto, dos pruebas que usan `screen` (busca en todo `document.body`) verían los nodos de la
// prueba anterior y `getByRole` fallaría por "elemento múltiple encontrado".
afterEach(cleanup);

describe("EmptyState", () => {
  it("pinta la ilustración, el título como encabezado y la frase", () => {
    render(
      <EmptyState
        ilustracion="sin-invitaciones"
        titulo="Todavía no tienes invitaciones"
        texto="Elige un tipo de evento para empezar."
      />,
    );
    const region = screen.getByRole("region", { name: "Todavía no tienes invitaciones" });
    expect(region.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("heading", { name: "Todavía no tienes invitaciones" })).toBeInTheDocument();
    expect(screen.getByText("Elige un tipo de evento para empezar.")).toBeInTheDocument();
  });

  it("`accion.href` se pinta como enlace navegable", () => {
    render(
      <EmptyState
        ilustracion="sin-fotos"
        titulo="Todavía no hay fotos"
        texto="Agrega tus primeras fotos."
        accion={{ etiqueta: "Agregar fotos", href: "/editor/panel-fotos" }}
      />,
    );
    const enlace = screen.getByRole("link", { name: "Agregar fotos" });
    expect(enlace).toHaveAttribute("href", "/editor/panel-fotos");
  });

  it("`accion.onSelect` sin `href` se pinta como botón y dispara el manejador", async () => {
    const alSeleccionar = vi.fn();
    render(
      <EmptyState
        ilustracion="error-generico"
        titulo="Algo salió mal"
        texto="Inténtalo de nuevo."
        accion={{ etiqueta: "Reintentar", onSelect: alSeleccionar }}
      />,
    );
    const boton = screen.getByRole("button", { name: "Reintentar" });
    boton.click();
    expect(alSeleccionar).toHaveBeenCalledTimes(1);
  });

  it("sin `accion` no pinta ningún botón ni enlace", () => {
    render(<EmptyState ilustracion="sin-invitaciones" titulo="Nadie ha confirmado todavía" texto="Comparte el enlace." />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("el título es distinto por instancia (el id no colisiona entre dos estados vacíos)", () => {
    const { container } = render(
      <>
        <EmptyState ilustracion="sin-invitaciones" titulo="Uno" texto="a" />
        <EmptyState ilustracion="sin-fotos" titulo="Dos" texto="b" />
      </>,
    );
    const ids = [...container.querySelectorAll("h2")].map((h) => h.id);
    expect(new Set(ids).size).toBe(2);
  });
});
