import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { EventKind } from "@invitaciones/schema";
import { PasoCrearInvitacion } from "./PasoCrearInvitacion.tsx";

function pintar(parcial: Partial<Parameters<typeof PasoCrearInvitacion>[0]> = {}) {
  const alSeleccionarTipo = vi.fn();
  const alCambiarFecha = vi.fn();
  const alCambiarHora = vi.fn();
  const alCambiarHashtag = vi.fn();
  const alEnviar = vi.fn();
  render(
    <PasoCrearInvitacion
      idTitulo="crear-titulo"
      tipoElegido={null}
      alSeleccionarTipo={alSeleccionarTipo}
      conteo={new Map<EventKind, number>()}
      fecha=""
      hora=""
      hashtag=""
      alCambiarFecha={alCambiarFecha}
      alCambiarHora={alCambiarHora}
      alCambiarHashtag={alCambiarHashtag}
      enviando={false}
      error={null}
      alEnviar={alEnviar}
      {...parcial}
    />,
  );
  return { alSeleccionarTipo, alCambiarFecha, alCambiarHora, alCambiarHashtag, alEnviar };
}

describe("PasoCrearInvitacion (alta desde el asistente, cierre de G-01)", () => {
  it("pide el tipo de evento, la fecha y la hora — exactamente lo que el contrato exige junto", () => {
    pintar();
    expect(screen.getByRole("radiogroup", { name: "Crea tu invitación" })).toBeTruthy();
    expect(screen.getByLabelText("Fecha del evento")).toBeTruthy();
    expect(screen.getByLabelText("Hora de inicio")).toBeTruthy();
    expect(screen.getByLabelText("Hashtag (opcional)")).toBeTruthy();
  });

  it("dice que toda invitación nace en el plan básico ANTES de que la clienta elija plantilla (contrato §7)", () => {
    pintar();
    expect(screen.getByText(/plan básico/)).toBeTruthy();
  });

  it("elegir un tipo avisa al asistente", async () => {
    const { alSeleccionarTipo } = pintar();
    await userEvent.click(screen.getByRole("radio", { name: /Boda/ }));
    expect(alSeleccionarTipo).toHaveBeenCalledWith("wedding");
  });

  it("escribir la fecha y la hora avisa al asistente con el valor crudo", () => {
    const { alCambiarFecha, alCambiarHora } = pintar();
    fireEvent.change(screen.getByLabelText("Fecha del evento"), { target: { value: "2027-06-10" } });
    expect(alCambiarFecha).toHaveBeenCalledWith("2027-06-10");
    fireEvent.change(screen.getByLabelText("Hora de inicio"), { target: { value: "17:30" } });
    expect(alCambiarHora).toHaveBeenCalledWith("17:30");
  });

  it("el botón llama a `alEnviar` y no antes de que la clienta lo pulse", async () => {
    const { alEnviar } = pintar();
    expect(alEnviar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("asistente-crear-invitacion"));
    expect(alEnviar).toHaveBeenCalledTimes(1);
  });

  it("`enviando` deshabilita el botón (doble envío, contrato §3)", () => {
    pintar({ enviando: true });
    expect((screen.getByTestId("asistente-crear-invitacion") as HTMLButtonElement).disabled).toBe(true);
  });

  it("un error se anuncia como alerta", () => {
    pintar({ error: "Ya tienes 3 invitaciones sin publicar." });
    expect(screen.getByRole("alert").textContent).toContain("Ya tienes 3 invitaciones sin publicar");
  });

  it("sin error, no hay ninguna alerta", () => {
    pintar();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
