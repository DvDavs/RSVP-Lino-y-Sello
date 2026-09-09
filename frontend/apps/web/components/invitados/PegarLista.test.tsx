import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as invitadosApi from "@/lib/invitados/api";
import type { GuestDraft, GuestItem } from "@/lib/invitados/api";
import { PegarLista } from "./PegarLista";

function draft(sobrescribir: Partial<GuestDraft> = {}): GuestDraft {
  return {
    fullName: "María Fernanda Cruz",
    email: null,
    phone: "9511234567",
    tableNumber: null,
    adults: 2,
    children: 1,
    young: 0,
    ...sobrescribir,
  };
}

function creado(sobrescribir: Partial<GuestItem> = {}): GuestItem {
  return {
    id: 1,
    fullName: "María Fernanda Cruz",
    email: null,
    phone: "9511234567",
    tableNumber: null,
    adults: 2,
    children: 1,
    young: 0,
    adultsConfirmed: 0,
    childrenConfirmed: 0,
    youngConfirmed: 0,
    status: "PENDING",
    message: null,
    updatedAt: null,
    ...sobrescribir,
  };
}

async function abrirYPegar(texto: string) {
  const usuario = userEvent.setup();
  const onImportados = vi.fn();
  render(<PegarLista invitationId={7} onImportados={onImportados} />);
  await usuario.click(screen.getByText("Pegar una lista"));
  const area = await screen.findByPlaceholderText(/María Fernanda Cruz, 2, 1, 0/);
  await usuario.type(area, texto);
  return { usuario, onImportados };
}

describe("PegarLista", () => {
  it("pegar sin escribir nada y pulsar Revisar lista no llama al backend", async () => {
    const usuario = userEvent.setup();
    const previsualizar = vi.spyOn(invitadosApi, "previewGuestsPaste");
    render(<PegarLista invitationId={7} onImportados={vi.fn()} />);
    await usuario.click(screen.getByText("Pegar una lista"));
    await usuario.click(await screen.findByText("Revisar lista"));
    expect(await screen.findByText(/Pega al menos un renglón/i)).toBeTruthy();
    expect(previsualizar).not.toHaveBeenCalled();
  });

  it("muestra listos/con problemas y el error POR RENGLÓN con su sugerencia (nunca 'formato inválido')", async () => {
    vi.spyOn(invitadosApi, "previewGuestsPaste").mockResolvedValue({
      ready: [draft()],
      problems: [
        { line: 3, raw: ", 3", code: "GUEST_INVALID", message: "Falta el nombre.", hint: "Escríbelo antes de la primera coma." },
      ],
    });
    const { usuario } = await abrirYPegar("María Fernanda Cruz, 2, 1, 0, 9511234567\nRocío Delgado, 2\n, 3");
    await usuario.click(screen.getByText("Revisar lista"));

    expect(await screen.findByText(/Vista previa: 1 invitado listo, 1 con problema/i)).toBeTruthy();
    expect(screen.getByText(/Renglón 3:/)).toBeTruthy();
    expect(screen.getByText(/Falta el nombre\./)).toBeTruthy();
    expect(screen.getByText(/Escríbelo antes de la primera coma\./)).toBeTruthy();
    expect(screen.queryByText(/formato inválido/i)).toBeNull();
  });

  it("«Agregar los N que están bien» importa solo lo válido y avisa cuántos se agregaron", async () => {
    vi.spyOn(invitadosApi, "previewGuestsPaste").mockResolvedValue({
      ready: [draft()],
      problems: [{ line: 2, raw: ", 3", code: "GUEST_INVALID", message: "Falta el nombre.", hint: "Escríbelo antes de la primera coma." }],
    });
    const item = creado();
    const importar = vi.spyOn(invitadosApi, "importGuestsPaste").mockResolvedValue({ ready: [item], problems: [] });
    const { usuario, onImportados } = await abrirYPegar("María Fernanda Cruz, 2, 1, 0, 9511234567\n, 3");
    await usuario.click(screen.getByText("Revisar lista"));
    await screen.findByText(/Vista previa/i);

    const botonAgregar = screen.getByText(/Agregar el 1 que está bien/i);
    await usuario.click(botonAgregar);

    await waitFor(() => expect(onImportados).toHaveBeenCalledWith([item]));
    expect(importar).toHaveBeenCalledWith(7, "María Fernanda Cruz, 2, 1, 0, 9511234567\n, 3");
  });

  it("«Volver a la lista» regresa al textarea sin perder lo escrito", async () => {
    vi.spyOn(invitadosApi, "previewGuestsPaste").mockResolvedValue({ ready: [draft()], problems: [] });
    const { usuario } = await abrirYPegar("María Fernanda Cruz, 2, 1, 0, 9511234567");
    await usuario.click(screen.getByText("Revisar lista"));
    await screen.findByText(/Vista previa/i);
    await usuario.click(screen.getByText("Volver a la lista"));
    const area = (await screen.findByPlaceholderText(/María Fernanda Cruz, 2, 1, 0/)) as HTMLTextAreaElement;
    expect(area.value).toContain("María Fernanda Cruz");
  });
});
