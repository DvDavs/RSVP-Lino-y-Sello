// packages/sections/src/blocks/index.ts — los 14 componentes de bloque + su contrato (04 §5.3).
export type { BlockComponentProps, GroupBlockComponentProps } from "./types.ts";

export { TextBlock } from "./TextBlock.tsx";
export { RichTextBlock } from "./RichTextBlock.tsx";
export { ListTextBlock } from "./ListTextBlock.tsx";
export { ImageBlock } from "./ImageBlock.tsx";
export { AudioBlock } from "./AudioBlock.tsx";
export { DateBlock } from "./DateBlock.tsx";
export { TimeBlock } from "./TimeBlock.tsx";
export { DateTimeRangeBlock } from "./DateTimeRangeBlock.tsx";
export { LinkBlock } from "./LinkBlock.tsx";
export { LocationBlock } from "./LocationBlock.tsx";
export { ChoiceBlock } from "./ChoiceBlock.tsx";
export { BooleanBlock } from "./BooleanBlock.tsx";
export { PersonBlock } from "./PersonBlock.tsx";
export { GroupBlock } from "./GroupBlock.tsx";

export { SCALAR_BLOCK_COMPONENTS, itemPendingKey } from "./dispatch.ts";
export { isSafeHttpUrl, hostOf } from "./url.ts";
export { activationAttrs } from "./activation.ts";
export type { ActivationAttrs } from "./activation.ts";
