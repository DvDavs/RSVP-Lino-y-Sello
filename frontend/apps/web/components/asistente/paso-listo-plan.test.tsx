// components/asistente/paso-listo-plan.test.tsx — ADR-5-0B-01: el paso final del asistente deja
// la salida al plan a mano, sin empujar a pagar antes de haber visto nada (editar es gratis).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasoListo } from "./PasoListo.tsx";
import { es_MX } from "@/lib/i18n";

describe("PasoListo — botón «Elegir plan»", () => {
  it("enseña un botón secundario a /editor/<id>/plan con la frase honesta de es_MX", () => {
    render(<PasoListo invitationId={12} nombreDelTipo="Boda" nombreDeLaPlantilla="Clásica" />);

    const boton = screen.getByTestId("asistente-elegir-plan");
    expect(boton.tagName).toBe("A");
    expect(boton.getAttribute("href")).toBe("/editor/12/plan");
    expect(boton.textContent).toBe(es_MX.panel.plan.elegirPlan);

    expect(screen.getByText(es_MX.asistente.listo.notaPlan)).not.toBeNull();
  });

  it("sigue enseñando «Abrir mi invitación» como salida primaria", () => {
    render(<PasoListo invitationId={7} nombreDelTipo="XV años" nombreDeLaPlantilla="Jardín" />);
    const abrir = screen.getByTestId("asistente-abrir-editor");
    expect(abrir.getAttribute("href")).toBe("/editor/7");
  });
});
