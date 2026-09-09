// lib/panel/Marcador.test.tsx — lo que un marcador NO puede hacer nunca: mentir.
//
// `jest-axe` no está en las dependencias de `apps/web` (la auditoría de accesibilidad del producto
// es Playwright + `@axe-core/playwright`, `e2e/a11y-producto.spec.ts`), así que aquí se comprueba lo
// que sí se puede comprobar en jsdom: la estructura que hace que esa auditoría pase — un solo `h1`,
// y `main` solo donde el layout no pone ya el suyo.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Marcador } from "./Marcador.tsx";
import { es_MX } from "../i18n.ts";

describe("marcador de sección en construcción", () => {
  it("dice que está en construcción y enseña el título como único `h1`", () => {
    render(<Marcador titulo="Invitados" texto={es_MX.panel.secciones.invitados.texto} />);
    expect(screen.getByText(es_MX.panel.marcador.enConstruccion)).toBeDefined();
    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0].textContent).toBe("Invitados");
  });

  it("sin acción no pinta ni un enlace: un marcador no tiene botones muertos", () => {
    const { container } = render(<Marcador titulo="Administración" texto={es_MX.panel.secciones.admin.texto} />);
    expect(within(container).queryAllByRole("link")).toHaveLength(0);
  });

  it("con acción, el enlace apunta a la ruta real que se le pasa", () => {
    render(
      <Marcador
        titulo="Invitados"
        texto={es_MX.panel.secciones.invitados.texto}
        accion={{ href: "/editor/42", etiqueta: es_MX.panel.marcador.volverAlEditor }}
      />,
    );
    const enlace = screen.getByRole("link", { name: es_MX.panel.marcador.volverAlEditor });
    expect(enlace.getAttribute("href")).toBe("/editor/42");
  });

  it("por defecto es el landmark `main`, y en el grupo `(sitio)` se baja a `div`", () => {
    const { container: conMain } = render(<Marcador titulo="Contacto" texto="Texto de ejemplo." />);
    expect(conMain.querySelector("main")).not.toBeNull();

    const { container: sinMain } = render(
      <Marcador titulo="Contacto" texto="Texto de ejemplo." contenedor="div" />,
    );
    expect(sinMain.querySelector("main")).toBeNull();
  });
});
