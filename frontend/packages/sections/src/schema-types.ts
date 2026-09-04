// packages/sections/src/schema-types.ts — alias locales de tipos que @invitaciones/schema expone
// solo como VALOR (el esquema Zod), sin el `export type X = z.infer<typeof X>` correspondiente.
//
// Comprobado [V] contra `packages/schema/src/composed.ts`: exporta el valor `ComposedSection`,
// `ComposedBlock`, `ComposedGroup`, `ResolvedValue` y `ResolvedTheme`, pero solo da `type` a
// `ComposedDocument`, `CompositionReport`, `CompositionResult`, `AssetIndex` y `BusinessSnapshot`.
// Este paquete no declara `zod` como dependencia directa (`04 §2.1` fija el `package.json` exacto
// de `packages/sections` y no incluye `zod`; `.npmrc` usa `node-linker=isolated`, así que un import
// no declarado no resolvería), así que en vez de `z.infer<typeof X>` se deriva el tipo con
// `ReturnType<typeof X.parse>` — produce EXACTAMENTE el mismo tipo de salida sin importar "zod".
// Registrado como hueco de higiene en `preguntas-abiertas.md` (no se toca `packages/schema`, es
// solo lectura para este agente).
import {
  ComposedBlock as ComposedBlockSchema,
  ComposedGroup as ComposedGroupSchema,
  ComposedSection as ComposedSectionSchema,
  ResolvedTheme as ResolvedThemeSchema,
  ResolvedValue as ResolvedValueSchema,
} from "@invitaciones/schema";

export type ComposedBlock = ReturnType<typeof ComposedBlockSchema.parse>;
export type ComposedGroup = ReturnType<typeof ComposedGroupSchema.parse>;
export type ComposedSection = ReturnType<typeof ComposedSectionSchema.parse>;
export type ResolvedValue = ReturnType<typeof ResolvedValueSchema.parse>;
export type ResolvedTheme = ReturnType<typeof ResolvedThemeSchema.parse>;

/** El `kind` discriminante de `ComposedBlock`/`ResolvedValue` — los 14 tipos de `BlockKind` menos "group". */
export type ScalarBlockKind = Exclude<ComposedBlock["type"], "group">;

/**
 * `ComposedSection.blocks: Array<ComposedBlock | ComposedGroup>` (composed.ts) NO es una unión
 * discriminada limpia para TypeScript: `ComposedBlock.type` es `BlockKind` COMPLETO (incluye el
 * literal "group" como uno de sus 14 valores posibles, aunque el dominio nunca lo produzca ahí —
 * 01 §2.5, los grupos no anidan), así que `block.type === "group"` no excluye de forma fiable el
 * miembro `ComposedBlock` de la unión al narrowing de TypeScript. Se distingue por la PRESENCIA de
 * `items` (solo en `ComposedGroup`), que sí narrowea de forma exclusiva.
 */
export function isComposedGroup(block: ComposedBlock | ComposedGroup): block is ComposedGroup {
  return "items" in block;
}

/**
 * `RichDoc`/`RichParagraph`/`RichSpan` (blocks.ts) tampoco tienen `type X = z.infer<typeof X>`
 * exportado (mismo hueco que arriba). Se derivan por indexación desde `ResolvedValue`, que sí es
 * derivable — evita un tercer import de valor solo para tipar.
 */
type RichTextResolvedValue = Extract<ResolvedValue, { kind: "richText" }>;
export type RichDoc = RichTextResolvedValue["doc"];
export type RichParagraph = RichDoc["content"][number];
export type RichSpan = RichParagraph["content"][number];

// Re-export de los esquemas (valor) para quien quiera `.parse()`/`.safeParse()` — útil en pruebas
// para construir fixtures VALIDADAS en vez de simples `as ComposedSection` sin comprobar nada.
export {
  ComposedBlockSchema,
  ComposedGroupSchema,
  ComposedSectionSchema,
  ResolvedThemeSchema,
  ResolvedValueSchema,
};
