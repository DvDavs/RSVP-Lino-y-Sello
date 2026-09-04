// packages/sections/src/blocks/activation.ts — atributos de "click-to-select" del lienzo.
//
// `mode === "public"` ⇒ objeto vacío: CERO onClick, cero data-block-*, cero manejador de teclado
// (04 §5.3, prueba U-07: "el HTML público no contiene data-block-* ni manejadores"). Se atan
// directamente al elemento semántico propio del bloque (nunca un <div> envolvente adicional) para
// no pisar su rol implícito (un <h1>/<time>/<img> conserva su semántica; solo gana manejadores).
import type { KeyboardEvent, MouseEvent } from "react";
import type { BlockRef, RenderMode } from "../types.ts";

export interface ActivationAttrs {
  readonly onClick?: (event: MouseEvent) => void;
  readonly onKeyDown?: (event: KeyboardEvent) => void;
  readonly tabIndex?: number;
  readonly "data-block-id"?: string;
  readonly "data-item-id"?: string;
  readonly "data-item-block-id"?: string;
  readonly "aria-busy"?: boolean;
}

const EMPTY_ACTIVATION: ActivationAttrs = {};

export function activationAttrs(
  mode: RenderMode,
  ref_: BlockRef,
  onActivate: ((ref: BlockRef) => void) | undefined,
  pending: boolean | undefined,
): ActivationAttrs {
  if (mode !== "canvas" || !onActivate) return EMPTY_ACTIVATION;
  const attrs: ActivationAttrs = {
    onClick: (event) => {
      event.preventDefault();
      onActivate(ref_);
    },
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate(ref_);
      }
    },
    tabIndex: 0,
    "data-block-id": ref_.blockId,
  };
  return {
    ...attrs,
    ...(ref_.itemId !== undefined ? { "data-item-id": ref_.itemId } : {}),
    ...(ref_.itemBlockId !== undefined ? { "data-item-block-id": ref_.itemBlockId } : {}),
    ...(pending ? { "aria-busy": true } : {}),
  };
}
