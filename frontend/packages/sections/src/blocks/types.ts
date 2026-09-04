// packages/sections/src/blocks/types.ts — contrato de los 14 componentes de bloque (04 §5.3).
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import type { BlockRef, RenderMode } from "../types.ts";

export interface BlockComponentProps<T extends ComposedBlock = ComposedBlock> {
  /** Incluye value (puede ser null), provenance, label, role. */
  readonly block: T;
  readonly mode: RenderMode;
  readonly onActivate?: (ref: BlockRef) => void;
  /** Identidad para el mensaje BLOCK_CLICKED. */
  readonly ref_: BlockRef;
  readonly pending?: boolean;
}

/**
 * `GroupBlock` no encaja en `BlockComponentProps<T extends ComposedBlock>`: `ComposedGroup` no
 * tiene `value` (tiene `items`) y no comparte forma con los otros 13 tipos. Mismos campos
 * transversales (mode/onActivate/ref_/pending), pero `pending` es un conjunto — cada ítem puede
 * estar pendiente de forma independiente (`04 §5.2`: `pending?: ReadonlySet<string>` a nivel de
 * `SectionComponentProps`; aquí se filtra por `itemBlockId` antes de pasarlo al ítem).
 */
export interface GroupBlockComponentProps {
  readonly group: ComposedGroup;
  readonly mode: RenderMode;
  readonly onActivate?: (ref: BlockRef) => void;
  /** Referencia del grupo en sí (sin itemId/itemBlockId). */
  readonly ref_: BlockRef;
  /** Claves `pending` con forma `"<itemId>.<itemBlockId>"` — ver `pendingKey()` en dispatch.ts. */
  readonly pending?: ReadonlySet<string>;
}
