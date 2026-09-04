// packages/sections/src/blocks/PersonBlock.tsx — tipo 13/14.
import type { BlockComponentProps } from "./types.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./blocks.module.css";
import shared from "../styles/shared.module.css";

export function PersonBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "person") return null;
  const { name, note } = block.value;
  return (
    <span
      className={`${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      <span className={styles.personName}>{name}</span>
      {note !== undefined && note !== "" ? <span className={styles.personNote}>{note}</span> : null}
    </span>
  );
}
