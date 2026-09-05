// components/editor/GroupField.test.tsx — el 14.º tipo de bloque (`group`): agregar, quitar y
// reordenar SIN arrastre (menú ⋮, 04 §14.4) llaman a las mismas acciones del store que usaría el
// asa. Se sustituyen las acciones del store por espías: `GroupField` es agnóstico de red.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposedGroup } from "@/lib/block-types.ts";
import type { GroupSpec } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import { GroupField } from "./GroupField.tsx";

function spec(): GroupSpec {
  return {
    id: "giftOptions",
    role: "giftOptions",
    label: { "es-MX": "Mesa de regalos" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "group",
    min: 0,
    max: 5,
    reorderable: true,
    itemLabel: { "es-MX": "Opción" },
    itemBlocks: [
      {
        id: "title",
        role: "giftOptionTitle",
        label: { "es-MX": "Título" },
        required: true,
        editable: true,
        source: "user",
        aiEditable: true,
        type: "text",
        constraints: { minLength: 0, maxLength: 40, multiline: false },
      },
    ],
  };
}

function grupo(itemIds: string[]): ComposedGroup {
  return {
    id: "giftOptions",
    role: "giftOptions",
    type: "group",
    label: "Mesa de regalos",
    provenance: "user",
    items: itemIds.map((itemId) => ({
      itemId,
      blocks: [{ id: "title", role: "giftOptionTitle", type: "text", label: "Título", provenance: "empty", value: null }],
    })),
  };
}

describe("GroupField", () => {
  beforeEach(() => {
    useEditorStore.setState({
      document: { content: { giftOptions: { kind: "group", items: [] } } } as never,
    });
  });

  it("agregar llama a addItem del store", async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(useEditorStore.getState(), "addItem").mockReturnValue("tmp:x");
    render(<GroupField invitationId={3} spec={spec()} groupId="giftOptions" group={grupo([])} />);
    await usuario.click(screen.getByRole("button", { name: /agregar opción/i }));
    expect(espia).toHaveBeenCalledWith("giftOptions", {});
  });

  it("el menú ⋮ (sin arrastre) Bajar llama a moveItem — misma operación que el asa", async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(useEditorStore.getState(), "moveItem");
    render(<GroupField invitationId={3} spec={spec()} groupId="giftOptions" group={grupo(["01ITEMAAAAAAAAAAAAAAAAAAAA", "01ITEMBBBBBBBBBBBBBBBBBBBB"])} />);
    await usuario.click(screen.getAllByRole("button", { name: /más opciones de/i })[0]!);
    await usuario.click(await screen.findByRole("menuitem", { name: "Bajar" }));
    expect(espia).toHaveBeenCalledWith("giftOptions", "01ITEMAAAAAAAAAAAAAAAAAAAA", 1);
  });

  it("quitar llama a removeItem", async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(useEditorStore.getState(), "removeItem");
    render(<GroupField invitationId={3} spec={spec()} groupId="giftOptions" group={grupo(["01ITEMAAAAAAAAAAAAAAAAAAAA"])} />);
    await usuario.click(screen.getByRole("button", { name: /quitar/i }));
    expect(espia).toHaveBeenCalledWith("giftOptions", "01ITEMAAAAAAAAAAAAAAAAAAAA");
  });

  it("respeta el máximo: el botón agregar se deshabilita", () => {
    const items = Array.from({ length: 5 }, (_, i) => `01ITEM${i}AAAAAAAAAAAAAAAAA`.slice(0, 26));
    render(<GroupField invitationId={3} spec={spec()} groupId="giftOptions" group={grupo(items)} />);
    expect((screen.getByRole("button", { name: /agregar opción/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
