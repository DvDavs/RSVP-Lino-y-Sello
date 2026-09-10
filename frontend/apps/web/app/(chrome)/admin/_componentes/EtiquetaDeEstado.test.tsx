// EtiquetaDeEstado.test.tsx — el color nunca es el único portador del significado: cada estado
// trae su texto, y estados distintos de la misma familia se pintan distinto (no solo un texto igual
// sobre el mismo color).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EtiquetaDeEstado } from "./EtiquetaDeEstado.tsx";

describe("EtiquetaDeEstado", () => {
  it.each([
    ["publicada", "Publicada"],
    ["en-edicion", "En edición"],
    ["deshabilitada", "Deshabilitada"],
  ] as const)("invitación %s: siempre trae su texto", (estado, texto) => {
    render(<EtiquetaDeEstado familia="invitacion" estado={estado} texto={texto} />);
    expect(screen.getByText(texto)).toBeTruthy();
  });

  it.each([
    ["pagado", "Pagado"],
    ["pendiente", "Pendiente"],
    ["devuelto", "Devuelto"],
  ] as const)("pago %s: siempre trae su texto", (estado, texto) => {
    render(<EtiquetaDeEstado familia="pago" estado={estado} texto={texto} />);
    expect(screen.getByText(texto)).toBeTruthy();
  });

  it("dos estados distintos de la misma familia se pintan con tonos distintos", () => {
    const { container: publicada } = render(<EtiquetaDeEstado familia="invitacion" estado="publicada" texto="Publicada" />);
    const { container: deshabilitada } = render(<EtiquetaDeEstado familia="invitacion" estado="deshabilitada" texto="Deshabilitada" />);
    const claseA = publicada.querySelector("span")?.className ?? "";
    const claseB = deshabilitada.querySelector("span")?.className ?? "";
    expect(claseA).not.toBe(claseB);
  });

  it("admite className adicional sin perder las clases base del Badge", () => {
    render(<EtiquetaDeEstado familia="pago" estado="pendiente" texto="Pendiente" className="ml-2" />);
    expect(screen.getByText("Pendiente").className).toMatch(/ml-2/);
  });
});
