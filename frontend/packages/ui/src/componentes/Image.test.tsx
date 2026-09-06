// packages/ui/src/componentes/Image.test.tsx — cubre `11 §5` fila «Image»: pendiente (sin src),
// cargando → cargada y cargando → rota (`onLoad`/`onError`, simulados: jsdom no decodifica
// imágenes), `alt` obligatorio salvo `decorative`, y que una `src` nueva reinicia el estado.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Image } from "./Image.tsx";
import { FOTO_DEMO } from "./demo-foto.ts";

// Ver la misma nota en `EmptyState.test.tsx`: sin `globals: true`, la limpieza entre pruebas no es
// automática y `screen` (busca en todo `document.body`) vería nodos de la prueba anterior.
afterEach(cleanup);

describe("Image (componente de producto)", () => {
  it("sin `src`: pendiente — el placeholder del sistema con el `alt` como nombre accesible", () => {
    render(<Image mask="radius-lg" alt="Pareja riendo en su boda" />);
    expect(screen.getByRole("img", { name: "Pareja riendo en su boda" })).toBeInTheDocument();
  });

  it("con `src`: arranca en \"cargando\" (skeleton visible, ocupado) y pasa a \"cargada\" con `onLoad`", () => {
    const { container } = render(<Image mask="radius-lg" src={FOTO_DEMO} alt="Pareja riendo en su boda" />);
    const foto = screen.getByAltText("Pareja riendo en su boda") as HTMLImageElement;
    expect(foto).toHaveAttribute("data-estado", "cargando");
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    fireEvent.load(foto);

    expect(foto).toHaveAttribute("data-estado", "cargada");
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("`onError` cambia a \"rota\": placeholder del sistema con el mismo `alt`, no la imagen del navegador", () => {
    render(<Image mask="radius-lg" src="/no-existe.jpg" alt="Pareja riendo en su boda" />);
    const foto = screen.getByAltText("Pareja riendo en su boda");
    fireEvent.error(foto);
    expect(screen.queryByAltText("Pareja riendo en su boda")).toBeNull();
    expect(screen.getByRole("img", { name: "Pareja riendo en su boda" })).toBeInTheDocument();
  });

  it("`decorative`: alt vacío y placeholder fuera del árbol accesible si además está \"rota\"", () => {
    render(<Image mask="seal" src="/no-existe.jpg" decorative />);
    const marco = document.querySelector(".ui-imagen") as HTMLElement;
    const foto = marco.querySelector("img") as HTMLImageElement;
    expect(foto).toHaveAttribute("alt", "");
    fireEvent.error(foto);
    expect(marco.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("`congelarEnEstado` fija el estado y no lo mueve `onLoad`/`onError` (solo para la galería)", () => {
    render(<Image mask="radius-lg" src={FOTO_DEMO} alt="Pareja" congelarEnEstado="cargando" />);
    const foto = screen.getByAltText("Pareja");
    fireEvent.load(foto);
    expect(foto).toHaveAttribute("data-estado", "cargando");
  });

  it("una `src` nueva reinicia a \"cargando\" aunque la anterior ya estuviera cargada", () => {
    const { rerender } = render(<Image mask="radius-lg" src={FOTO_DEMO} alt="Foto uno" />);
    fireEvent.load(screen.getByAltText("Foto uno"));
    expect(screen.getByAltText("Foto uno")).toHaveAttribute("data-estado", "cargada");

    rerender(<Image mask="radius-lg" src={`${FOTO_DEMO}#dos`} alt="Foto dos" />);
    expect(screen.getByAltText("Foto dos")).toHaveAttribute("data-estado", "cargando");
  });

  it("sin un solo hex: todo color sale de --ui-*", () => {
    const { container } = render(<Image mask="radius-lg" alt="Foto pendiente" />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
