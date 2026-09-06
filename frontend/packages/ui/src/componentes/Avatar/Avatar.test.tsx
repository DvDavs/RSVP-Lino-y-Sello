import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar.tsx";

expect.extend(toHaveNoViolations);

describe("Avatar", () => {
  it("sin foto, muestra las iniciales de inmediato (sin esperar un temporizador)", () => {
    render(<Avatar nombre="Mariana Rodríguez" />);
    expect(screen.getByText("MR")).toBeInTheDocument();
  });

  it("con un solo nombre, usa su primera letra", () => {
    render(<Avatar nombre="Mariana" />);
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("con foto que no termina de cargar, cae a las iniciales pasado el margen de espera (sin parpadeo)", async () => {
    // jsdom no carga imágenes de verdad: `new Image()` nunca dispara `load`, así que Radix reporta
    // "error" de inmediato — es justo el caso real que este `delayMs` cubre (foto que falla o tarda).
    // La ruta "sí carga" es responsabilidad de `@radix-ui/react-avatar` (ya probada por Radix); aquí
    // solo se verifica que ANTES del margen no hay parpadeo de iniciales y DESPUÉS sí aparecen.
    render(<Avatar nombre="Rodrigo Vega" src="https://example.com/foto.jpg" />);
    expect(screen.queryByText("RV")).not.toBeInTheDocument();
    expect(await screen.findByText("RV")).toBeInTheDocument();
  });

  it("el punto de estado es decorativo (aria-hidden) y no oculta el nombre", () => {
    const { container } = render(<Avatar nombre="Mariana Rodríguez" estado="activo" />);
    const punto = container.querySelector('[aria-hidden="true"]');
    expect(punto).not.toBeNull();
    expect(screen.getByText("MR")).toBeInTheDocument();
  });

  it("sin violaciones de a11y", async () => {
    const { container } = render(<Avatar nombre="Mariana Rodríguez" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
