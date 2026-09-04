// packages/sections/src/canvas/SelectionOverlay.tsx — marco + etiqueta del bloque activo, SOLO
// en modo "canvas" (04 §5 tarea 4). Mide por `querySelector` sobre los MISMOS `data-block-id`/
// `data-item-id`/`data-item-block-id` que `blocks/activation.ts` ya coloca en modo canvas — así
// ningún componente de bloque necesita registrarse aparte en un mapa (menos superficie, un solo
// mecanismo). Posición y tamaño se aplican por CSSOM (`el.style.setProperty`), NUNCA con la prop
// `style` de React: mismo motivo que `ThemeProvider`/`ImageBlock` — la CSP del lienzo no permite
// `style="…"` renderizado en servidor (handoffs/3-0b.md §1). Visibilidad por defecto = `display:
// none` en el `.module.css`; el efecto la enciende con CSSOM cuando hay selección medible.
import { useEffect, useRef, type RefObject } from "react";
import { useCanvasOptional } from "./CanvasContext.tsx";
import type { BlockRef } from "../types.ts";
import styles from "./SelectionOverlay.module.css";

export interface SelectionOverlayProps {
  /** Contenedor a medir contra — normalmente el mismo elemento que envuelve `<SectionsRoot>`. */
  readonly containerRef: RefObject<HTMLElement | null>;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function selectorFor(ref: BlockRef): string {
  let selector = `[data-block-id="${cssEscape(ref.blockId)}"]`;
  selector += ref.itemId !== undefined ? `[data-item-id="${cssEscape(ref.itemId)}"]` : ":not([data-item-id])";
  selector +=
    ref.itemBlockId !== undefined
      ? `[data-item-block-id="${cssEscape(ref.itemBlockId)}"]`
      : ":not([data-item-block-id])";
  return selector;
}

function labelFor(ref: BlockRef): string {
  return ref.itemBlockId !== undefined ? `${ref.blockId} · ${ref.itemBlockId}` : ref.blockId;
}

export function SelectionOverlay({ containerRef }: SelectionOverlayProps) {
  const canvas = useCanvasOptional();
  const boxRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const selected = canvas?.selected ?? null;

  useEffect(() => {
    const container = containerRef.current;
    const box = boxRef.current;
    if (!box) return;

    function hide() {
      box!.style.setProperty("display", "none");
    }

    function measure() {
      if (!container || !selected) {
        hide();
        return;
      }
      const target = container.querySelector<HTMLElement>(selectorFor(selected));
      if (!target) {
        hide();
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      box!.style.setProperty("display", "block");
      box!.style.setProperty("top", `${targetRect.top - containerRect.top + container.scrollTop}px`);
      box!.style.setProperty("left", `${targetRect.left - containerRect.left + container.scrollLeft}px`);
      box!.style.setProperty("width", `${targetRect.width}px`);
      box!.style.setProperty("height", `${targetRect.height}px`);
      if (labelRef.current) labelRef.current.textContent = labelFor(selected);
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [containerRef, selected]);

  if (!canvas) return null; // fuera de un CanvasProvider (p. ej. mode="public"): nada que dibujar.

  return (
    <div ref={boxRef} className={styles.overlay} aria-hidden="true">
      <span ref={labelRef} className={styles.label} />
    </div>
  );
}
