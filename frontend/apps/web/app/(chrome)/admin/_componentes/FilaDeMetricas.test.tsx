// FilaDeMetricas.test.tsx — la fila de métricas del resumen: tres estados, una sola forma
// protagonista y ninguna cifra inventada cuando falla.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilaDeMetricas, type MetricaDeResumen } from "./FilaDeMetricas.tsx";

const metricas: MetricaDeResumen[] = [
  { etiqueta: "CLIENTAS", valor: 128 },
  { etiqueta: "INVITACIONES", valor: 141 },
  { etiqueta: "PUBLICADAS", valor: 96 },
  { etiqueta: "PAGADAS", valor: 103 },
  { etiqueta: "RSVP 7 DÍAS", valor: 412 },
];

function error() {
  return {
    titulo: "No pudimos cargar el resumen",
    cuerpo: "Vuelve a intentarlo en unos segundos.",
    etiquetaReintentar: "Reintentar",
    onReintentar: vi.fn(),
  };
}

describe("FilaDeMetricas", () => {
  it("listo: enseña las cinco etiquetas y sus valores", () => {
    render(<FilaDeMetricas metricas={metricas} estado="listo" etiquetaCargando="Cargando métricas" error={error()} />);
    for (const metrica of metricas) {
      expect(screen.getByText(metrica.etiqueta)).toBeTruthy();
      expect(screen.getByText(String(metrica.valor))).toBeTruthy();
    }
  });

  it("cargando: las etiquetas se enseñan de inmediato; el valor es un Skeleton ocupado, no la cifra", () => {
    render(<FilaDeMetricas metricas={metricas} estado="cargando" etiquetaCargando="Cargando métricas" error={error()} />);
    expect(screen.getByText("CLIENTAS")).toBeTruthy();
    expect(screen.queryByText("128")).toBeNull();
    const ocupados = screen.getAllByRole("status", { name: "Cargando métricas" });
    expect(ocupados).toHaveLength(metricas.length);
    for (const ocupado of ocupados) expect(ocupado.getAttribute("aria-busy")).toBe("true");
  });

  it("error: sustituye la fila entera por BloqueConError (ninguna cifra a medias) y llama a onReintentar", async () => {
    const usuario = userEvent.setup();
    const err = error();
    render(<FilaDeMetricas metricas={metricas} estado="error" etiquetaCargando="Cargando métricas" error={err} />);
    expect(screen.getByText(err.titulo)).toBeTruthy();
    expect(screen.queryByText("CLIENTAS")).toBeNull();
    await usuario.click(screen.getByRole("button", { name: err.etiquetaReintentar }));
    expect(err.onReintentar).toHaveBeenCalledTimes(1);
  });

  it("listo: pinta la forma protagonista (Stripes) una sola vez", () => {
    const { container } = render(<FilaDeMetricas metricas={metricas} estado="listo" etiquetaCargando="Cargando métricas" error={error()} />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });
});
