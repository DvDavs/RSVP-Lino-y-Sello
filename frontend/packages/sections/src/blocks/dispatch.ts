// packages/sections/src/blocks/dispatch.ts — mapa type → componente de bloque escalar.
// Lo usan `GroupBlock` (para los itemBlocks de cada ítem) y `placeholder/SectionPlaceholder.tsx`
// (para los bloques de nivel de sección) — una sola fuente para no duplicar el switch dos veces.
import type { ComponentType } from "react";
import type { BlockComponentProps } from "./types.ts";
import type { ScalarBlockKind } from "../schema-types.ts";
import { TextBlock } from "./TextBlock.tsx";
import { RichTextBlock } from "./RichTextBlock.tsx";
import { ListTextBlock } from "./ListTextBlock.tsx";
import { ImageBlock } from "./ImageBlock.tsx";
import { AudioBlock } from "./AudioBlock.tsx";
import { DateBlock } from "./DateBlock.tsx";
import { TimeBlock } from "./TimeBlock.tsx";
import { DateTimeRangeBlock } from "./DateTimeRangeBlock.tsx";
import { LinkBlock } from "./LinkBlock.tsx";
import { LocationBlock } from "./LocationBlock.tsx";
import { ChoiceBlock } from "./ChoiceBlock.tsx";
import { BooleanBlock } from "./BooleanBlock.tsx";
import { PersonBlock } from "./PersonBlock.tsx";

export const SCALAR_BLOCK_COMPONENTS: Readonly<
  Record<ScalarBlockKind, ComponentType<BlockComponentProps>>
> = {
  text: TextBlock,
  richText: RichTextBlock,
  listText: ListTextBlock,
  image: ImageBlock,
  audio: AudioBlock,
  date: DateBlock,
  time: TimeBlock,
  dateTimeRange: DateTimeRangeBlock,
  link: LinkBlock,
  location: LocationBlock,
  choice: ChoiceBlock,
  boolean: BooleanBlock,
  person: PersonBlock,
};

/** Clave de `pending` para un bloque dentro de un ítem de grupo (04 §5.2: `pending?: ReadonlySet<string>`
 *  a nivel de sección se indexa por `blockId`; dentro de un grupo hace falta `itemId` también). */
export function itemPendingKey(itemId: string, itemBlockId: string): string {
  return `${itemId}.${itemBlockId}`;
}
