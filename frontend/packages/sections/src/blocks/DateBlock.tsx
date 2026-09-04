// packages/sections/src/blocks/DateBlock.tsx — tipo 6/14. <time datetime="YYYY-MM-DD"> (04 §17.3).
import type { BlockComponentProps } from "./types.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./blocks.module.css";
import shared from "../styles/shared.module.css";

export function DateBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "date") return null;
  return (
    <time
      dateTime={block.value.value}
      className={`${styles.time} ${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      {block.value.formatted}
    </time>
  );
}
