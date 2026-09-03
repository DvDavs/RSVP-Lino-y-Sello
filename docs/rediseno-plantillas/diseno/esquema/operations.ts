// packages/schema/src/operations.ts — catálogo CERRADO de operaciones de edición. Un solo reductor para
// la interfaz humana, el autoguardado (lote de operaciones) y la propuesta de IA (07-extension-ia.md).
import { z } from "zod";
import { BlockId, Ident, ItemId, SectionKey, TempId } from "./common.ts";
import { ScalarValue } from "./blocks.ts";

/** En operaciones ENTRANTES un ítem puede referirse por id temporal; el servidor devuelve idMap tmp→ULID. */
const AnyItemId = z.union([ItemId, TempId]);

export const Operation = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("setBlock"), blockId: BlockId, value: ScalarValue }),
  z.strictObject({ op: z.literal("clearBlock"), blockId: BlockId }),
  z.strictObject({ op: z.literal("addItem"), groupId: BlockId, tempId: TempId,
    values: z.record(BlockId, ScalarValue), index: z.number().int().min(0).max(24).optional() }),
  z.strictObject({ op: z.literal("removeItem"), groupId: BlockId, itemId: AnyItemId }),
  z.strictObject({ op: z.literal("moveItem"), groupId: BlockId, itemId: AnyItemId, toIndex: z.number().int().min(0).max(23) }),
  z.strictObject({ op: z.literal("setItemBlock"), groupId: BlockId, itemId: AnyItemId, blockId: BlockId, value: ScalarValue }),
  z.strictObject({ op: z.literal("setSectionVisible"), sectionKey: SectionKey, visible: z.boolean() }),
  z.strictObject({ op: z.literal("setSectionVariant"), sectionKey: SectionKey, variant: Ident }),
  z.strictObject({ op: z.literal("reorderSections"), order: z.array(SectionKey).min(1).max(16) }),
  z.strictObject({ op: z.literal("setTheme"), paletteId: Ident.optional(), fontSetId: Ident.optional() }),
]);

/** Cuerpo de POST …/document/operations (03-api.md §3.3). */
export const OperationBatch = z.strictObject({
  baseRevision: z.number().int().min(0),
  clientBatchId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),   // idempotencia del autoguardado
  operations: z.array(Operation).min(1).max(50),
});

/** Salida estructurada del modelo de IA (07-extension-ia.md). ≤ 10 operaciones, acotadas a UNA sección. */
export const EditProposal = z.strictObject({
  sectionKey: SectionKey,
  rationale: z.string().max(400),
  operations: z.array(Operation).min(1).max(10),
});

export type Operation = z.infer<typeof Operation>;
export type OperationBatch = z.infer<typeof OperationBatch>;
export type EditProposal = z.infer<typeof EditProposal>;
