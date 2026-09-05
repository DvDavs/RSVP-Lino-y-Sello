// components/fields/fecha-del-evento.test.tsx — U-3 / I-06: «la fecha de la boda no se puede
// cambiar en ninguna parte». Salía con candado y una frase que no llevaba a ningún sitio, porque no
// había sitio: ninguna ruta de cliente escribía `invitation.date`. Ahora se cambia aquí mismo.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FechaDelEvento } from "./FechaDelEvento.tsx";
import { ApiError } from "@/lib/errors.ts";
import { es_MX } from "@/lib/i18n";
import { useEditorStore } from "@/lib/store.ts";

const cambiar = vi.fn();

beforeEach(() => {
  cambiar.mockReset();
  vi.spyOn(useEditorStore, "getState").mockReturnValue({
    cambiarFechaDelEvento: cambiar,
  } as unknown as ReturnType<typeof useEditorStore.getState>);
});

function pintar(): void {
  render(<FechaDelEvento label="Fecha del evento" valor="2027-04-18" formateado="18 de abril de 2027" />);
}

describe("la clienta cambia la fecha de su evento desde el panel", () => {
  it("en reposo enseña la fecha formateada por el SERVIDOR y un botón que sí edita", () => {
    pintar();
    expect(screen.getByText("18 de abril de 2027")).toBeTruthy();
    // El `[Editar allí]` de `04 §6.3`, ahora con destino: es un botón que edita, no un enlace a una
    // página de ayuda que explica que no se puede.
    expect(screen.getByRole("button", { name: /cambiar la fecha/i })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("guarda la fecha nueva llamando a la ruta del editor, no a una operación del documento", async () => {
    cambiar.mockResolvedValue({ invitationId: 3, date: "2028-05-20", time: "17:00", releaseStale: false, staleReason: [] });
    const usuario = userEvent.setup();
    pintar();

    await usuario.click(screen.getByRole("button", { name: /cambiar la fecha/i }));
    const campo = screen.getByLabelText(es_MX.editor.fechaEvento.etiquetaCampo);
    await usuario.clear(campo);
    await usuario.type(campo, "2028-05-20");
    await usuario.click(screen.getByRole("button", { name: es_MX.editor.fechaEvento.guardar }));

    await waitFor(() => expect(cambiar).toHaveBeenCalledWith("2028-05-20"));
    expect(await screen.findByText(new RegExp(es_MX.editor.fechaEvento.guardada))).toBeTruthy();
  });

  it("si la invitación ya está publicada, dice que hay que volver a publicar (no se invalida sola)", async () => {
    cambiar.mockResolvedValue({
      invitationId: 3, date: "2028-05-20", time: "17:00", releaseStale: true, staleReason: ["business.date"],
    });
    const usuario = userEvent.setup();
    pintar();

    await usuario.click(screen.getByRole("button", { name: /cambiar la fecha/i }));
    await usuario.click(screen.getByRole("button", { name: es_MX.editor.fechaEvento.guardar }));

    expect(await screen.findByText(new RegExp("Vuelve a publicar"))).toBeTruthy();
  });

  it("un 422 TPL_EVENT_DATE_INVALID se cuenta en es-MX y deja el campo abierto para corregir", async () => {
    cambiar.mockRejectedValue(
      new ApiError(
        { timestamp: "x", statusCode: 422, code: "TPL_EVENT_DATE_INVALID", message: "formato" },
        422,
      ),
    );
    const usuario = userEvent.setup();
    pintar();

    await usuario.click(screen.getByRole("button", { name: /cambiar la fecha/i }));
    await usuario.click(screen.getByRole("button", { name: es_MX.editor.fechaEvento.guardar }));

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe(es_MX.editor.fechaEvento.formatoInvalido);
    expect(screen.getByLabelText(es_MX.editor.fechaEvento.etiquetaCampo)).toBeTruthy();
  });

  it("cancelar devuelve el borrador al valor guardado y no llama a nada", async () => {
    const usuario = userEvent.setup();
    pintar();

    await usuario.click(screen.getByRole("button", { name: /cambiar la fecha/i }));
    const campo = screen.getByLabelText(es_MX.editor.fechaEvento.etiquetaCampo) as HTMLInputElement;
    await usuario.clear(campo);
    await usuario.type(campo, "2030-01-01");
    await usuario.click(screen.getByRole("button", { name: es_MX.editor.fechaEvento.cancelar }));

    expect(cambiar).not.toHaveBeenCalled();
    expect(screen.getByText("18 de abril de 2027")).toBeTruthy();
  });
});
