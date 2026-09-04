// packages/sections/src/blocks/DateTimeRangeBlock.tsx — tipo 8/14.
// El instante máquina-legible es `start` (04 §17.3 exige UN <time datetime>, no dicta cuántos);
// `formatted` ya trae el rango completo en texto ("compose.ts" formatRange, 01 §5.2 R6/R9.2).
import type { BlockComponentProps } from "./types.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./blocks.module.css";
import shared from "../styles/shared.module.css";

export function DateTimeRangeBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "dateTimeRange") return null;
  return (
    <time
      dateTime={block.value.start}
      className={`${styles.time} ${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      {block.value.formatted}
    </time>
  );
}
