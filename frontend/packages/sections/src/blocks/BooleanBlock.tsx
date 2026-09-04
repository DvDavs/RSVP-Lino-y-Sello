// packages/sections/src/blocks/BooleanBlock.tsx — tipo 12/14.
// Los 4 roles booleanos del catálogo (personPhotoVisible, backgroundMusicEnabled,
// rsvpChildrenAllowed, rsvpYoungAllowed — blocks.ts:117-119) son banderas de control que casi
// siempre consume la SECCIÓN directamente (`block.value.value`) para decidir qué pintar, no un
// texto visible. Este componente existe para cuando sí se necesita mostrarlo (p. ej. en modo
// "canvas", para que el editor pueda seleccionar y ver el estado) — texto es-MX, nunca un ícono
// solo (nunca información transmitida solo por color/forma, WCAG 1.4.1).
import type { BlockComponentProps } from "./types.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./blocks.module.css";
import shared from "../styles/shared.module.css";

export function BooleanBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "boolean") return null;
  return (
    <span
      className={`${styles.boolean} ${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      {block.value.value ? "Sí" : "No"}
    </span>
  );
}
