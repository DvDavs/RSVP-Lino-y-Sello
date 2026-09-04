// packages/sections/src/blocks/TextBlock.tsx — tipo 1/14 (04 §5.3, 01 §3.2 fila 1).
// Semánticamente neutro a propósito: la sección decide si envuelve el texto en <h1>/<h2>/<p>
// ("el nivel lo decide la posición en el documento", 04 §17.3) — el bloque solo aporta el texto.
import type { BlockComponentProps } from "./types.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./blocks.module.css";
import shared from "../styles/shared.module.css";

export function TextBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  // R2/R5: sin valor, ningún nodo — ni un hueco vacío, ni "—" (04 §5.3, U-02).
  if (block.value === null || block.value.kind !== "text") return null;
  return (
    <span
      className={`${styles.text} ${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      {block.value.value}
    </span>
  );
}
