// packages/sections/src/blocks/ChoiceBlock.tsx — tipo 11/14. `label` ya resuelta por compose()
// contra `spec.options` en el locale (01 §3.2 fila 11): el bloque solo pinta texto, nunca `optionId`.
import type { BlockComponentProps } from "./types.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./blocks.module.css";
import shared from "../styles/shared.module.css";

export function ChoiceBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "choice") return null;
  return (
    <span
      className={`${styles.choice} ${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      {block.value.label}
    </span>
  );
}
