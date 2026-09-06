// components/sitio/ayuda-y-errores.test.tsx — `/ayuda` (buscador + acordeón + vacío) y la pantalla
// de error. Las dos comparten el mismo criterio: nunca una pantalla sin salida (`11 §7`).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BuscadorAyuda } from "./BuscadorAyuda.tsx";
import { PantallaError } from "./PantallaError.tsx";
import { DUDAS, filtrarDudas } from "./dudas-ayuda.ts";
import { es_MX } from "@/lib/i18n";

describe("ayuda", () => {
  it("empieza con todas las dudas plegadas y dice cuántas hay", () => {
    render(<BuscadorAyuda />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(DUDAS.length);
    expect(screen.getByRole("status").textContent).toBe(es_MX.ayuda.resultados(DUDAS.length));
    for (const detalle of document.querySelectorAll("details")) expect(detalle.open).toBe(false);
  });

  it("cada duda conserva su ancla: `/ayuda#fecha` sigue llevando a la de la fecha", () => {
    render(<BuscadorAyuda />);
    expect(document.querySelector("#fecha")).not.toBeNull();
  });

  // G-01: `components/asistente/MisInvitaciones.tsx` manda a `/ayuda#planes` a quien no tiene
  // ninguna invitación. Llegaba a un renglón PLEGADO, así que la respuesta que había venido a
  // buscar seguía escondida detrás de un chevron.
  it("`/ayuda#planes` llega con esa duda ABIERTA, no plegada como el resto", () => {
    window.location.hash = "#planes";
    try {
      render(<BuscadorAyuda />);
      const abierta = document.querySelector<HTMLDetailsElement>("#planes");
      expect(abierta?.open).toBe(true);
      expect(document.querySelector<HTMLDetailsElement>("#fecha")?.open).toBe(false);
    } finally {
      window.location.hash = "";
    }
  });

  it("y esa duda contesta lo que la clienta pregunta: cuánto cuesta y con quién se contrata", () => {
    render(<BuscadorAyuda />);
    const planes = DUDAS.find((duda) => duda.id === "planes");
    expect(planes?.pregunta).toContain("Cuánto cuesta");
    expect(planes?.parrafos.join(" ")).toContain("precios");
    // La pregunta de precios se encuentra buscando por la palabra que se teclea.
    expect(filtrarDudas(DUDAS, "precio").map((duda) => duda.id)).toContain("planes");
    expect(filtrarDudas(DUDAS, "cuanto cuesta").map((duda) => duda.id)).toContain("planes");
  });

  it("el buscador filtra por lo que hay dentro de la respuesta", async () => {
    const persona = userEvent.setup();
    render(<BuscadorAyuda />);
    await persona.type(screen.getByLabelText(es_MX.ayuda.buscar), "webp");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe(es_MX.ayuda.resultados(1));
  });

  it("sin resultados enseña el estado vacío con una salida que de verdad funciona", async () => {
    const persona = userEvent.setup();
    render(<BuscadorAyuda />);
    await persona.type(screen.getByLabelText(es_MX.ayuda.buscar), "criptomoneda");
    expect(screen.getByText(es_MX.ayuda.sinResultados.titulo)).not.toBeNull();
    await persona.click(screen.getByRole("button", { name: es_MX.ayuda.sinResultados.accion }));
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(DUDAS.length);
  });
});

describe("pantalla de error", () => {
  it("tiene título, una acción que reintenta de verdad y una salida a la portada", async () => {
    const persona = userEvent.setup();
    const reintentar = vi.fn();
    render(<PantallaError onReintentar={reintentar} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(es_MX.errores.algoSalioMal.titulo);
    await persona.click(screen.getByRole("button", { name: es_MX.errores.algoSalioMal.reintentar }));
    expect(reintentar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: es_MX.comun.irAlInicio }).getAttribute("href")).toBe("/");
  });

  it("el código técnico se enseña aparte, y solo si existe", () => {
    const { rerender } = render(<PantallaError onReintentar={() => {}} />);
    expect(screen.queryByText(/Código:/)).toBeNull();
    rerender(<PantallaError digest="a1b2c3" onReintentar={() => {}} />);
    expect(screen.getByText(es_MX.errores.codigo("a1b2c3"))).not.toBeNull();
  });
});
