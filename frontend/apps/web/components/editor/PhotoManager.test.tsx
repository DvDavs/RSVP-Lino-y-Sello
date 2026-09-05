// components/editor/PhotoManager.test.tsx — gestor de fotos (04 §6.4, §14). Reordenar sin arrastre
// (menú ⋮) y validación local antes de subir; la subida real va contra el backend en
// `e2e/imagenes.spec.ts`.
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ComposedGroup } from "@/lib/block-types.ts";
import type { GroupSpec } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import * as apiClient from "@/lib/api-client.ts";
import { PhotoManager } from "./PhotoManager.tsx";

function spec(): GroupSpec {
  return {
    id: "galleryPhotos",
    role: "galleryPhotos",
    label: { "es-MX": "Galería" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "group",
    min: 0,
    max: 3,
    reorderable: true,
    itemLabel: { "es-MX": "Foto" },
    itemBlocks: [
      {
        id: "photo",
        role: "galleryPhoto",
        label: { "es-MX": "Foto" },
        required: true,
        editable: true,
        source: "user",
        aiEditable: true,
        type: "image",
        constraints: { aspect: "free", maxBytes: 1024 },
      },
    ],
  };
}

function grupo(n: number): ComposedGroup {
  return {
    id: "galleryPhotos",
    role: "galleryPhotos",
    type: "group",
    label: "Galería",
    provenance: "user",
    items: Array.from({ length: n }, (_, i) => ({
      itemId: `01ITEM${i}AAAAAAAAAAAAAAAAA`.slice(0, 26),
      blocks: [{ id: "photo", role: "galleryPhoto", type: "image", label: "Foto", provenance: "user", value: null }],
    })),
  };
}

describe("PhotoManager", () => {
  it("muestra el contador N de M fotos", () => {
    render(<PhotoManager invitationId={3} spec={spec()} groupId="galleryPhotos" group={grupo(2)} maxItemBytes={1024} />);
    expect(screen.getByText("Galería — 2 de 3 fotos")).toBeTruthy();
  });

  it("deshabilita «Agregar» al llegar al máximo", () => {
    render(<PhotoManager invitationId={3} spec={spec()} groupId="galleryPhotos" group={grupo(3)} maxItemBytes={1024} />);
    expect((screen.getByRole("button", { name: "Agregar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("el menú ⋮ de una foto (sin arrastre) llama a moveItem", async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(useEditorStore.getState(), "moveItem");
    render(<PhotoManager invitationId={3} spec={spec()} groupId="galleryPhotos" group={grupo(2)} maxItemBytes={1024} />);
    await usuario.click(screen.getAllByRole("button", { name: /más opciones de la foto/i })[0]!);
    await usuario.click(await screen.findByRole("menuitem", { name: "Bajar" }));
    expect(espia).toHaveBeenCalledWith("galleryPhotos", grupo(2).items[0]!.itemId, 1);
  });

  it("un archivo con formato no admitido no llega a subirse", async () => {
    const espia = vi.spyOn(apiClient, "uploadAsset");
    render(<PhotoManager invitationId={3} spec={spec()} groupId="galleryPhotos" group={grupo(0)} maxItemBytes={1024} />);
    const archivo = new File(["x"], "foto.gif", { type: "image/gif" });
    const input = screen.getByLabelText(/elegir fotos/i) as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [archivo] });
    fireEvent.change(input);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(espia).not.toHaveBeenCalled();
  });
});
