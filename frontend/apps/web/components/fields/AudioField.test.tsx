import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AudioSpec } from "@/lib/block-types.ts";
import * as apiClient from "@/lib/api-client.ts";
import { AudioField } from "./AudioField.tsx";

function espec(): AudioSpec {
  return {
    id: "backgroundMusic",
    role: "backgroundMusic",
    label: { "es-MX": "Música de fondo" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "audio",
    constraints: { maxBytes: 8_388_608 },
  };
}

describe("AudioField", () => {
  it("rechaza un formato distinto de MP3 sin llamar a la API", async () => {
    const espia = vi.spyOn(apiClient, "uploadAsset");
    render(<AudioField id="c-audio" invitationId={3} spec={espec()} value={null} onCommit={vi.fn()} />);
    const archivo = new File(["x"], "cancion.wav", { type: "audio/wav" });
    const input = screen.getByLabelText(/elegir archivo/i) as HTMLInputElement;
    // `userEvent.upload` respeta el `accept` del input (correcto para un usuario real); aquí se
    // fuerza el cambio para probar la validación MANUAL de tipo, que es la defensa real cuando el
    // selector nativo del sistema operativo deja pasar "todos los archivos".
    Object.defineProperty(input, "files", { value: [archivo] });
    fireEvent.change(input);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(espia).not.toHaveBeenCalled();
  });

  it("sube un MP3 válido y guarda el assetId devuelto", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(apiClient, "uploadAsset").mockResolvedValue({
      assetId: "as_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      bytes: 1,
      contentType: "audio/mpeg",
      sha256: "a".repeat(64),
      reused: false,
      previewUrl: "https://cdn/x.mp3",
    });
    const onCommit = vi.fn();
    render(<AudioField id="c-audio" invitationId={3} spec={espec()} value={null} onCommit={onCommit} />);
    const archivo = new File(["x"], "cancion.mp3", { type: "audio/mpeg" });
    await usuario.upload(screen.getByLabelText(/elegir archivo/i), archivo);
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith({ kind: "audio", assetId: "as_01ARZ3NDEKTSV4RRFFQ69G5FAV" }));
  });
});
