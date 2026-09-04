// packages/sections/src/blocks/ImageBlock.tsx — tipo 4/14 (04 §5.3).
//
// - `role === "decorative"` ⇒ `alt="" aria-hidden="true"` (04 §17.4, prueba U-03), sin excepción.
// - Punto focal (`ImageValue.focal`, x/y en [0,1]) → `object-position`. Se aplica por CSSOM
//   (`el.style.setProperty`, permitido por la CSP del lienzo) en vez de la prop `style` de React:
//   un `style={{…}}` renderizado en servidor DENTRO del lienzo viola su CSP (medido en
//   handoffs/3-0b.md §1, control `?probe=inline-style`) — y estos componentes se montan también
//   ahí. La hoja `.module.css` lee `--inv-focal-x/y` con reserva 50% (centro) para el primer
//   pintado (antes de que el `useEffect` corra, p. ej. en SSR).
// - Reserva de espacio: `ResolvedValue` de `image` NO lleva ancho/alto (compose.ts no los
//   resuelve; ADR-2-3-07 dice explícitamente que los assets de PLANTILLA los traen a NULL), así
//   que no hay dimensión intrínseca de la que partir. Se reserva por `aspect-ratio` con el valor
//   de reserva del sistema (`--inv-image-aspect-default`) — una sección real puede sobrescribirlo
//   con su propio módulo CSS para su propio hueco (p. ej. el marco cuadrado de un retrato).
import { useEffect, useRef } from "react";
import type { BlockComponentProps } from "./types.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./ImageBlock.module.css";
import shared from "../styles/shared.module.css";

function clampUnit(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export function ImageBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const value = block.value;
  const isImage = value !== null && value.kind === "image";
  const focalX = isImage ? clampUnit(value.focal.x) : null;
  const focalY = isImage ? clampUnit(value.focal.y) : null;

  useEffect(() => {
    const el = imgRef.current;
    if (!el || focalX === null || focalY === null) return;
    el.style.setProperty("--inv-focal-x", `${(focalX * 100).toFixed(2)}%`);
    el.style.setProperty("--inv-focal-y", `${(focalY * 100).toFixed(2)}%`);
  }, [focalX, focalY]);

  if (!isImage) return null;
  const isDecorative = block.role === "decorative";

  return (
    <span
      className={`${styles.frame} ${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      {/* Sin `crossOrigin`: carga desde el CDN del asset aunque este no mande CORS; con
       * `crossOrigin` sí lo exigiría (handoffs/3-0b.md §1). */}
      <img
        ref={imgRef}
        className={styles.img}
        src={value.url}
        alt={isDecorative ? "" : value.alt}
        aria-hidden={isDecorative ? "true" : undefined}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
