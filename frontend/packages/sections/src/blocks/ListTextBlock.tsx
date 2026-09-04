// packages/sections/src/blocks/ListTextBlock.tsx — tipo 3/14. `<ul>/<li>`, nunca <div> sueltos
// (04 §17.3, mismo criterio que GroupBlock aunque `listText` no sea `type:"group"`).
import type { BlockComponentProps } from "./types.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./blocks.module.css";
import shared from "../styles/shared.module.css";

export function ListTextBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "listText") return null;
  if (block.value.items.length === 0) return null;
  return (
    <ul
      className={`${styles.list} ${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      {block.value.items.map((item, index) => (
        // El orden es el del array (no hay id estable por ítem en `listText`, a diferencia de
        // `group`/`GroupItem.itemId` — usar el índice como key es correcto aquí: la lista entera
        // se reemplaza como unidad en cada edición, nunca se reordena un solo ítem in-place).
        // eslint-disable-next-line react/no-array-index-key
        <li key={index} className={styles.listItem}>
          {item}
        </li>
      ))}
    </ul>
  );
}
