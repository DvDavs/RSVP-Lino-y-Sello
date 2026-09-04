// packages/sections/src/blocks/LinkBlock.tsx — tipo 9/14.
// "Enlaces con texto significativo: nunca 'aquí' ni 'ver más' sin contexto (LinkValue.label, si
// falta, cae al host del href)" — 04 §17.3, literal.
import type { BlockComponentProps } from "./types.ts";
import { hostOf, isSafeHttpUrl } from "./url.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./blocks.module.css";
import shared from "../styles/shared.module.css";

export function LinkBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "link") return null;
  const { href, label } = block.value;
  if (!isSafeHttpUrl(href)) return null; // defensa en profundidad (04 §17.6), ver blocks/url.ts
  const text = label !== undefined && label !== "" ? label : hostOf(href);
  return (
    <a
      className={`${styles.link} ${shared.focusRing} ${shared.transition} ${shared.touchTarget}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      {text}
    </a>
  );
}
