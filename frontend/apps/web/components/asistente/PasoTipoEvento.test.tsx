import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EventKind } from "@invitaciones/schema";
import { PasoTipoEvento } from "./PasoTipoEvento.tsx";
import { TIPOS_DE_EVENTO } from "./tipos-de-evento.ts";

function pintar(parcial: Partial<Parameters<typeof PasoTipoEvento>[0]> = {}) {
  const alSeleccionar = vi.fn();
  const conteo = new Map<EventKind, number>([
    ["wedding", 1],
    ["quince", 1],
  ]);
  render(
    <>
      <h1 id="titulo">¿Qué vamos a celebrar?</h1>
      <PasoTipoEvento
        seleccionado="wedding"
        alSeleccionar={alSeleccionar}
        conteo={conteo}
        tipoDeLaInvitacion="wedding"
        idTitulo="titulo"
        {...parcial}
      />
    </>,
  );
  return { alSeleccionar };
}

describe("paso 1 — ¿Qué vamos a celebrar?", () => {
  it("es un grupo de radios de verdad, con los ocho tipos y nombre accesible", () => {
    pintar();
    const grupo = screen.getByRole("radiogroup", { name: "¿Qué vamos a celebrar?" });
    expect(grupo).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(TIPOS_DE_EVENTO.length);
    expect(screen.getByRole("radio", { name: /Boda/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Bautizo/ }).getAttribute("aria-checked")).toBe("false");
  });

  it("dice cuántas plantillas hay de cada tipo y avisa de los que todavía no tienen ninguna", () => {
    pintar();
    expect(screen.getByRole("radio", { name: /Boda.*1 plantilla/s }).getAttribute("data-tipo")).toBe("wedding");
    expect(screen.getByRole("radio", { name: /Bautizo.*Todavía no hay plantillas/s }).getAttribute("data-tipo")).toBe("baptism");
  });

  it("marca cuál es el tipo con el que se registró la invitación", () => {
    pintar({ tipoDeLaInvitacion: "quince", seleccionado: "quince" });
    expect(screen.getByRole("radio", { name: /XV años.*El de tu invitación/s })).toBeTruthy();
  });

  it("al pulsar una tarjeta se elige ese tipo", async () => {
    const { alSeleccionar } = pintar();
    await userEvent.click(screen.getByRole("radio", { name: /Graduación/ }));
    expect(alSeleccionar).toHaveBeenCalledWith("graduation");
  });

  it("tabulación itinerante: solo la marcada es parada de tabulación", () => {
    pintar();
    const radios = screen.getAllByRole("radio");
    expect(radios.filter((r) => r.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: /Boda/ }).getAttribute("tabindex")).toBe("0");
  });

  it("sin nada marcado, la primera tarjeta es la parada de tabulación (no se pierde el teclado)", () => {
    pintar({ seleccionado: null, tipoDeLaInvitacion: null });
    const radios = screen.getAllByRole("radio");
    expect(radios[0].getAttribute("tabindex")).toBe("0");
    expect(radios.filter((r) => r.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("las flechas mueven y SELECCIONAN, como en un grupo de radios nativo", async () => {
    const { alSeleccionar } = pintar();
    screen.getByRole("radio", { name: /Boda/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(alSeleccionar).toHaveBeenLastCalledWith("quince");
    await userEvent.keyboard("{ArrowLeft}");
    expect(alSeleccionar).toHaveBeenLastCalledWith("wedding");
    await userEvent.keyboard("{End}");
    expect(alSeleccionar).toHaveBeenLastCalledWith("generic");
    await userEvent.keyboard("{Home}");
    expect(alSeleccionar).toHaveBeenLastCalledWith("wedding");
    // Y da la vuelta: desde la primera, «izquierda» lleva a la última.
    await userEvent.keyboard("{ArrowLeft}");
    expect(alSeleccionar).toHaveBeenLastCalledWith("generic");
  });

  it("cada tarjeta lleva el placeholder del sistema marcado para `imagenes-pendientes.md`", () => {
    const { container } = render(
      <PasoTipoEvento
        seleccionado={null}
        alSeleccionar={() => {}}
        conteo={new Map()}
        tipoDeLaInvitacion={null}
        idTitulo="titulo"
      />,
    );
    const pendientes = [...container.querySelectorAll("[data-imagen-pendiente]")].map((n) => n.getAttribute("data-imagen-pendiente"));
    expect(pendientes).toEqual(TIPOS_DE_EVENTO.map((t) => t.imagenId));
  });
});
