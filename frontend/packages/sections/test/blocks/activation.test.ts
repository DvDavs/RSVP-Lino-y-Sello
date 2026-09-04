import { describe, expect, it, vi } from "vitest";
import type * as React from "react";
import { activationAttrs } from "../../src/blocks/activation.ts";

const ref_ = { sectionKey: "cover", blockId: "cover.title" };

describe("activationAttrs", () => {
  it('mode="public" ⇒ objeto vacío, sin importar onActivate', () => {
    const onActivate = vi.fn();
    expect(activationAttrs("public", ref_, onActivate, false)).toEqual({});
  });

  it('mode="canvas" sin onActivate ⇒ objeto vacío (nada que invocar)', () => {
    expect(activationAttrs("canvas", ref_, undefined, false)).toEqual({});
  });

  it('mode="canvas" con onActivate ⇒ atributos de activación + data-block-id', () => {
    const onActivate = vi.fn();
    const attrs = activationAttrs("canvas", ref_, onActivate, false);
    expect(attrs["data-block-id"]).toBe("cover.title");
    expect(attrs["data-item-id"]).toBeUndefined();
    expect(attrs["data-item-block-id"]).toBeUndefined();
    expect(attrs.tabIndex).toBe(0);
    expect(attrs["aria-busy"]).toBeUndefined();
  });

  it("incluye data-item-id/data-item-block-id cuando el ref los trae (bloque de ítem)", () => {
    const attrs = activationAttrs(
      "canvas",
      { sectionKey: "family", blockId: "family.godparents", itemId: "01J8ITEM000000000000000AA", itemBlockId: "person" },
      vi.fn(),
      false,
    );
    expect(attrs["data-item-id"]).toBe("01J8ITEM000000000000000AA");
    expect(attrs["data-item-block-id"]).toBe("person");
  });

  it("pending:true ⇒ aria-busy:true; pending:false/undefined ⇒ sin aria-busy", () => {
    expect(activationAttrs("canvas", ref_, vi.fn(), true)["aria-busy"]).toBe(true);
    expect(activationAttrs("canvas", ref_, vi.fn(), false)["aria-busy"]).toBeUndefined();
    expect(activationAttrs("canvas", ref_, vi.fn(), undefined)["aria-busy"]).toBeUndefined();
  });

  it("onClick invoca onActivate(ref_) y previene el comportamiento por defecto", () => {
    const onActivate = vi.fn();
    const attrs = activationAttrs("canvas", ref_, onActivate, false);
    const preventDefault = vi.fn();
    attrs.onClick?.({ preventDefault } as unknown as React.MouseEvent);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onActivate).toHaveBeenCalledWith(ref_);
  });

  it("onKeyDown con Enter/Espacio invoca onActivate; otras teclas no", () => {
    const onActivate = vi.fn();
    const attrs = activationAttrs("canvas", ref_, onActivate, false);
    const preventDefault = vi.fn();
    attrs.onKeyDown?.({ key: "Enter", preventDefault } as unknown as React.KeyboardEvent);
    attrs.onKeyDown?.({ key: " ", preventDefault } as unknown as React.KeyboardEvent);
    attrs.onKeyDown?.({ key: "Tab", preventDefault } as unknown as React.KeyboardEvent);
    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });
});
