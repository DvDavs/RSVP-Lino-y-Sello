// components/fields/ImageField.test.tsx — validación local (04 §13.2 paso 2: "se avisa ANTES de
// subir por la red"), texto alternativo obligatorio y punto focal. El recorte→subida completo
// (`react-image-crop` sobre un `<canvas>` real) es de `e2e/imagenes.spec.ts` contra el backend real:
// jsdom no decodifica imágenes de verdad, así que aquí se prueba todo lo anterior al recorte.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ImageSpec } from "@/lib/block-types.ts";
import * as apiClient from "@/lib/api-client.ts";
import { ImageField } from "./ImageField.tsx";

function espec(): ImageSpec {
  return {
    id: "coverImage",
    role: "coverImage",
    label: { "es-MX": "Foto de portada" },
    required: true,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "image",
    constraints: { aspect: "square", maxBytes: 1024 },
  };
}

describe("ImageField", () => {
  it("rechaza un formato no admitido ANTES de subir (04 §13.2 paso 2)", async () => {
    const espia = vi.spyOn(apiClient, "uploadAsset");
    render(<ImageField id="c-foto" invitationId={3} spec={espec()} value={null} onCommit={vi.fn()} />);
    const archivo = new File(["x"], "foto.gif", { type: "image/gif" });
    const input = screen.getByLabelText(/elegir archivo/i) as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [archivo] });
    fireEvent.change(input);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/formato no admitido/i);
    expect(espia).not.toHaveBeenCalled();
  });

  it("rechaza un archivo que excede maxBytes ANTES de subir", async () => {
    const espia = vi.spyOn(apiClient, "uploadAsset");
    render(<ImageField id="c-foto" invitationId={3} spec={espec()} value={null} onCommit={vi.fn()} />);
    const archivo = new File([new Uint8Array(2048)], "foto.webp", { type: "image/webp" });
    const input = screen.getByLabelText(/elegir archivo/i) as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [archivo] });
    fireEvent.change(input);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/pesa más de/i);
    expect(espia).not.toHaveBeenCalled();
  });

  it("no deja guardar sin texto alternativo (salvo decorativo)", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <ImageField
        id="c-foto"
        invitationId={3}
        spec={espec()}
        value={{ assetId: "as_01ARZ3NDEKTSV4RRFFQ69G5FAV", url: "https://cdn/x.webp", alt: "Ana y Luis", focal: { x: 0.5, y: 0.5 } }}
        onCommit={onCommit}
      />,
    );
    const alt = screen.getByLabelText("Texto alternativo");
    await usuario.clear(alt);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("un bloque decorativo no pide alt y lo guarda vacío", () => {
    render(
      <ImageField
        id="c-foto"
        invitationId={3}
        spec={{ ...espec(), role: "decorative" }}
        esDecorativo
        value={{ assetId: "as_01ARZ3NDEKTSV4RRFFQ69G5FAV", url: "https://cdn/x.webp", alt: "", focal: { x: 0.5, y: 0.5 } }}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Texto alternativo")).toBeNull();
  });

  it("mover el punto focal guarda el nuevo valor con aria-valuetext en palabras", async () => {
    const onCommit = vi.fn();
    render(
      <ImageField
        id="c-foto"
        invitationId={3}
        spec={espec()}
        value={{ assetId: "as_01ARZ3NDEKTSV4RRFFQ69G5FAV", url: "https://cdn/x.webp", alt: "Ana y Luis", focal: { x: 0.5, y: 0.5 } }}
        onCommit={onCommit}
      />,
    );
    const horizontal = screen.getByLabelText(/horizontal/i);
    expect(horizontal.getAttribute("aria-valuetext")).toBe("centro");
    fireEvent.change(horizontal, { target: { value: "10" } });
    expect(onCommit).toHaveBeenCalledWith({
      kind: "image",
      assetId: "as_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      alt: "Ana y Luis",
      focal: { x: 0.1, y: 0.5 },
    });
  });
});
