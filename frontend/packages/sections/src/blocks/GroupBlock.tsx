// packages/sections/src/blocks/GroupBlock.tsx — tipo 14/14 (04 §5.3, prueba U-05).
// "GroupBlock: <ul>/<li> en el orden de items (R7, U-05)." Los ítems se ordenan por su posición
// en `doc.content[groupId].items` (01 §5.2 R7); `compose()` ya entrega `items` en ese orden —
// este componente NUNCA reordena, solo pinta.
import type { GroupBlockComponentProps } from "./types.ts";
import { SCALAR_BLOCK_COMPONENTS, itemPendingKey } from "./dispatch.ts";
import styles from "./GroupBlock.module.css";

export function GroupBlock({ group, mode, onActivate, ref_, pending }: GroupBlockComponentProps) {
  if (group.items.length === 0) return null; // R2/R5: sin ítems, ningún nodo.
  return (
    <ul className={styles.list}>
      {group.items.map((item) => (
        <li key={item.itemId} className={styles.item}>
          {item.blocks.map((block) => {
            // Defensivo: `ComposedBlock.type` es `BlockKind` completo (incluye "group") aunque el
            // dominio prohíbe grupos anidados (01 §2.5, `GroupItem.values` solo admite
            // `ScalarValue`) — un `itemBlock` con `type:"group"` no debería llegar nunca aquí, pero
            // si lo hiciera (desajuste de versión, dato corrupto) se omite en vez de lanzar (R5).
            if (block.type === "group") return null;
            const Component = SCALAR_BLOCK_COMPONENTS[block.type];
            const itemBlockRef = {
              sectionKey: ref_.sectionKey,
              blockId: ref_.blockId,
              itemId: item.itemId,
              itemBlockId: block.id,
            };
            const isPending = pending?.has(itemPendingKey(item.itemId, block.id)) ?? false;
            return (
              <span key={block.id} className={styles.itemBlock}>
                <Component
                  block={block}
                  mode={mode}
                  onActivate={onActivate}
                  ref_={itemBlockRef}
                  pending={isPending}
                />
              </span>
            );
          })}
        </li>
      ))}
    </ul>
  );
}
