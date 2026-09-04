// packages/schema/scripts/gen-golden-operations.ts — golden/operations/<op>.cases.json (11 ficheros,
// `clearItemBlock` incluida: ADR-1R-X-01) + golden/fixtures/operations-base.json.
//
// CIERRA LA OBJECIÓN O-01 de `bitacora/2-0a-REV.md`. Antes, `expectManifestError` se calculaba contra
// un `manifestFixture(...)`/`KNOWN_ITEM_ID` que vivían SOLO en este script: era un campo contractual
// que no verificaba nadie en ninguno de los dos lados y que obligaba al lector Kotlin a reimplementar
// `fixtures.ts`. Ahora:
//   1. El fixture base (manifiesto + tema + defaults + documento + `assetMeta` + semilla de ULID) se
//      emite como DATO en `golden/fixtures/operations-base.json`, fuera de la carpeta contada de 11.
//   2. `reducerResult` es la salida REAL de `applyOperation(doc, op, ctx)` sobre ese fixture
//      (`operations-reducer.ts`), no `null` con `reducerResultPending`.
//   3. `expectOpViolations` es la salida REAL de `validateOperations` (`operations-validate.ts`).
// Los tres campos son ejecutables desde Kotlin con solo leer `golden/`.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Operation } from "../src/operations.ts";
import type { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import type { InvitationDocument } from "../src/document.ts";
import type { TemplatePackage } from "../src/compose.ts";
import { applyBatch, applyOperation, type AssetMeta, type ReducerContext } from "../src/operations-reducer.ts";
import { validateOperations } from "../src/operations-validate.ts";
import {
  textSpec, imageSpec, audioSpec, groupSpec, sectionSpec, themeFixture, manifestFixture,
  defaultsFixture, documentFixture, textValue, imageValue, groupItem, groupValue, ulid, assetId,
} from "./fixtures.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = HERE + "../golden/operations/";
const FIX = HERE + "../golden/fixtures/";
mkdirSync(OUT, { recursive: true });
mkdirSync(FIX, { recursive: true });
const write = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

// -------------------------------------------------------------------------------------------
// 1. Fixture base — se EMITE como dato (O-01). Todo lo que el reductor necesita está aquí.
// -------------------------------------------------------------------------------------------
const theme: ThemeSpec = themeFixture();
const manifest: TemplateManifest = manifestFixture([
  sectionSpec("cover", "cover", [
    textSpec("cover.title", "coverTitle", { maxLength: 80 }),
    imageSpec("cover.image", "coverImage", { aspect: "square", maxBytes: 100_000 }),
    textSpec("cover.fixed", "coverSubtitle", { source: "fixed" }),
    audioSpec("cover.music", "backgroundMusic", { maxBytes: 100_000 }),
  ], { variants: ["default", "alt"], required: true }),
  sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [
      textSpec("title", "sectionTitle"), imageSpec("image", "decorative"),
    ], { max: 3, min: 1 }),
  ]),
]);
const defaults: DefaultsFile = defaultsFixture(manifest, { "cover.fixed": textValue("Fijo de la plantilla") });

const KNOWN_ITEM_ID = ulid("known1");
const OTHER_ITEM_ID = ulid("known2");
const ASSET_OK = assetId("assetok");        // 1000x1000, 50 KB → cuadrada y dentro de maxBytes
const ASSET_GRANDE = assetId("assetbg");    // 1000x1000, 900 KB → excede image.maxBytes
const ASSET_ANCHO = assetId("assetwd");     // 1600x400  → no es cuadrada
const ASSET_AJENO = assetId("assetno");     // no está en assetMeta → TPL_ASSET_NOT_OWNED

const ASSET_META: Record<string, AssetMeta> = {
  [ASSET_OK]: { bytes: 50_000, width: 1000, height: 1000, contentType: "image/webp" },
  [ASSET_GRANDE]: { bytes: 900_000, width: 1000, height: 1000, contentType: "image/webp" },
  [ASSET_ANCHO]: { bytes: 50_000, width: 1600, height: 400, contentType: "image/webp" },
};

const documento: InvitationDocument = documentFixture(manifest, theme, {
  content: {
    "cover.title": textValue("Ana & Luis"),
    "event.cards": groupValue([
      groupItem(KNOWN_ITEM_ID, { title: textValue("Ceremonia") }),
      groupItem(OTHER_ITEM_ID, { title: textValue("Recepción") }),
    ]),
  },
});

/** ULIDs deterministas para que `reducerResult` sea reproducible byte a byte en los dos lados. */
const ULID_SEED = ulid("newitem");
const nuevoUlid = () => ULID_SEED;

const pkg: TemplatePackage = { manifest, theme, defaults };
const ctx: ReducerContext = {
  pkg, newUlid: nuevoUlid,
  assetMeta: (id: string) => ASSET_META[id] ?? null,
};

write(FIX + "operations-base.json", {
  _comentario:
    "Fixture base de golden/operations/ (O-01). Es DATO: Kotlin lo lee tal cual para reproducir " +
    "`reducerResult` y `expectOpViolations` sin conocer scripts/fixtures.ts. `newUlid` devuelve " +
    "SIEMPRE `ulidSeed`: el reductor es determinista si se le inyecta una fuente determinista.",
  manifest, theme, defaults, documento, assetMeta: ASSET_META, ulidSeed: ULID_SEED,
  knownItemId: KNOWN_ITEM_ID, otherItemId: OTHER_ITEM_ID,
});

// -------------------------------------------------------------------------------------------
// 2. Casos
// -------------------------------------------------------------------------------------------
type Tag = "valid-shape" | "invalid-shape" | "invalid-manifest";
type OpCase = {
  name: string; tag: Tag; operation: unknown;
  expectZodValid: boolean;
  /** salida REAL de validateOperations(ops, manifest, theme, doc, {aiOnly:false}) */
  expectOpViolations: string[];
  /** salida REAL de applyOperation(documento, op, ctx); `null` solo si la forma no es válida */
  reducerResult: unknown;
};

function ocase(name: string, tag: Tag, operation: unknown, expectZodValid: boolean): OpCase {
  const zr = Operation.safeParse(operation);
  if (zr.success !== expectZodValid)
    throw new Error(`${name}: esperaba zodValid=${expectZodValid}, obtuve ${zr.success}`);
  if (!zr.success) return { name, tag, operation, expectZodValid, expectOpViolations: [], reducerResult: null };
  const op = zr.data;
  const violaciones = validateOperations([op], manifest, theme, documento, { aiOnly: false }).map(v => v.code);
  const r = applyOperation(documento, op, ctx);
  // Coherencia entre los dos: si el reductor falla, el validador tuvo que ver algo — salvo en los
  // casos de asset, que el validador no puede comprobar sin `assetOwned` (ADR-030, se resuelve en el
  // servidor) y en `TPL_BLOCK_TYPE_MISMATCH`, que el validador reporta como OP_VALUE_INVALID/I-15.
  return { name, tag, operation, expectZodValid, expectOpViolations: violaciones, reducerResult: r };
}

const files: Record<string, () => OpCase[]> = {
  setBlock: () => [
    ocase("forma válida", "valid-shape", { op: "setBlock", blockId: "cover.title", value: textValue("Camila & Antonio") }, true),
    ocase("forma inválida: falta value", "invalid-shape", { op: "setBlock", blockId: "cover.title" }, false),
    ocase("blockId inexistente en el manifiesto", "invalid-manifest", { op: "setBlock", blockId: "no.existe", value: textValue("x") }, true),
    ocase("bloque source=fixed: no editable (I-21)", "invalid-manifest", { op: "setBlock", blockId: "cover.fixed", value: textValue("x") }, true),
    ocase("kind del valor distinto del type del spec", "invalid-manifest", { op: "setBlock", blockId: "cover.title", value: imageValue(ASSET_OK) }, true),
    ocase("texto más largo que maxLength (I-16)", "invalid-manifest", { op: "setBlock", blockId: "cover.title", value: textValue("x".repeat(81)) }, true),
    ocase("salto de línea con multiline=false (I-30)", "invalid-manifest", { op: "setBlock", blockId: "cover.title", value: textValue("Ana\nLuis") }, true),
    ocase("assetId que no pertenece (ADR-030)", "invalid-manifest", { op: "setBlock", blockId: "cover.image", value: imageValue(ASSET_AJENO) }, true),
    ocase("asset que excede image.maxBytes (X-06)", "invalid-manifest", { op: "setBlock", blockId: "cover.image", value: imageValue(ASSET_GRANDE) }, true),
    ocase("asset que incumple image.aspect=square (X-06)", "invalid-manifest", { op: "setBlock", blockId: "cover.image", value: imageValue(ASSET_ANCHO) }, true),
    ocase("asset correcto: pasa las tres comprobaciones", "valid-shape", { op: "setBlock", blockId: "cover.image", value: imageValue(ASSET_OK) }, true),
  ],
  clearBlock: () => [
    ocase("forma válida", "valid-shape", { op: "clearBlock", blockId: "cover.title" }, true),
    ocase("forma inválida: campo extra", "invalid-shape", { op: "clearBlock", blockId: "cover.title", value: textValue("x") }, false),
    ocase("blockId inexistente", "invalid-manifest", { op: "clearBlock", blockId: "no.existe" }, true),
    ocase("bloque source=fixed: no editable", "invalid-manifest", { op: "clearBlock", blockId: "cover.fixed" }, true),
  ],
  addItem: () => [
    ocase("forma válida", "valid-shape", { op: "addItem", groupId: "event.cards", tempId: "tmp:abcdefgh", values: { title: textValue("Fiesta") } }, true),
    ocase("forma inválida: tempId demasiado corto", "invalid-shape", { op: "addItem", groupId: "event.cards", tempId: "tmp:x", values: {} }, false),
    ocase("groupId inexistente", "invalid-manifest", { op: "addItem", groupId: "no.existe", tempId: "tmp:abcdefgh", values: {} }, true),
    ocase("clave de values que no es itemBlock del grupo", "invalid-manifest", { op: "addItem", groupId: "event.cards", tempId: "tmp:abcdefgh", values: { noExiste: textValue("x") } }, true),
    ocase("index más allá del final", "invalid-manifest", { op: "addItem", groupId: "event.cards", tempId: "tmp:abcdefgh", values: {}, index: 7 }, true),
    ocase("inserción en el índice 0", "valid-shape", { op: "addItem", groupId: "event.cards", tempId: "tmp:abcdefgh", values: {}, index: 0 }, true),
  ],
  removeItem: () => [
    ocase("forma válida", "valid-shape", { op: "removeItem", groupId: "event.cards", itemId: KNOWN_ITEM_ID }, true),
    ocase("forma inválida: itemId no es ULID ni tempId", "invalid-shape", { op: "removeItem", groupId: "event.cards", itemId: "bad" }, false),
    ocase("itemId inexistente", "invalid-manifest", { op: "removeItem", groupId: "event.cards", itemId: ulid("noexist") }, true),
    ocase("tempId sin resolver: TPL_ITEM_UNKNOWN", "invalid-manifest", { op: "removeItem", groupId: "event.cards", itemId: "tmp:abcdefgh" }, true),
  ],
  moveItem: () => [
    ocase("forma válida", "valid-shape", { op: "moveItem", groupId: "event.cards", itemId: OTHER_ITEM_ID, toIndex: 0 }, true),
    ocase("forma inválida: toIndex negativo", "invalid-shape", { op: "moveItem", groupId: "event.cards", itemId: KNOWN_ITEM_ID, toIndex: -1 }, false),
    ocase("groupId inexistente", "invalid-manifest", { op: "moveItem", groupId: "no.existe", itemId: KNOWN_ITEM_ID, toIndex: 0 }, true),
    ocase("toIndex fuera del rango de items", "invalid-manifest", { op: "moveItem", groupId: "event.cards", itemId: KNOWN_ITEM_ID, toIndex: 5 }, true),
  ],
  setItemBlock: () => [
    ocase("forma válida", "valid-shape", { op: "setItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "title", value: textValue("Misa") }, true),
    ocase("forma inválida: falta value", "invalid-shape", { op: "setItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "title" }, false),
    ocase("blockId no es itemBlock del grupo", "invalid-manifest", { op: "setItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "noExiste", value: textValue("x") }, true),
    ocase("itemId inexistente", "invalid-manifest", { op: "setItemBlock", groupId: "event.cards", itemId: ulid("noexist"), blockId: "title", value: textValue("x") }, true),
  ],
  clearItemBlock: () => [
    // X-05 (ADR-1R-X-01): la inversa de un `setItemBlock` sobre un itemBlock SIN valor previo. Sin
    // ella esa entrada de undo quedaba no deshacible o —peor— se deshacía promoviendo un valor de
    // demostración a contenido de usuario (reabre H-03 y desactiva el bloqueo de publicación).
    ocase("forma válida", "valid-shape", { op: "clearItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "title" }, true),
    ocase("forma inválida: campo extra", "invalid-shape", { op: "clearItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "title", value: textValue("x") }, false),
    ocase("itemId inexistente", "invalid-manifest", { op: "clearItemBlock", groupId: "event.cards", itemId: ulid("noexist"), blockId: "title" }, true),
    ocase("borrar un itemBlock que no tenía valor es no-op válido", "valid-shape", { op: "clearItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "image" }, true),
  ],
  setSectionVisible: () => [
    ocase("forma válida", "valid-shape", { op: "setSectionVisible", sectionKey: "event", visible: false }, true),
    ocase("forma inválida: visible no booleano", "invalid-shape", { op: "setSectionVisible", sectionKey: "cover", visible: "no" }, false),
    ocase("sectionKey inexistente", "invalid-manifest", { op: "setSectionVisible", sectionKey: "noExiste", visible: true }, true),
    ocase("ocultar una sección required (I-17)", "invalid-manifest", { op: "setSectionVisible", sectionKey: "cover", visible: false }, true),
  ],
  setSectionVariant: () => [
    ocase("forma válida", "valid-shape", { op: "setSectionVariant", sectionKey: "cover", variant: "alt" }, true),
    ocase("forma inválida: falta variant", "invalid-shape", { op: "setSectionVariant", sectionKey: "cover" }, false),
    ocase("variant no declarada", "invalid-manifest", { op: "setSectionVariant", sectionKey: "cover", variant: "no-existe" }, true),
  ],
  reorderSections: () => [
    ocase("forma válida: permutación exacta", "valid-shape", { op: "reorderSections", order: ["event", "cover"] }, true),
    ocase("forma inválida: array vacío (min 1)", "invalid-shape", { op: "reorderSections", order: [] }, false),
    ocase("no es una permutación (I-24)", "invalid-manifest", { op: "reorderSections", order: ["cover", "cover"] }, true),
  ],
  setTheme: () => [
    ocase("forma válida", "valid-shape", { op: "setTheme", paletteId: "olive" }, true),
    ocase("forma inválida: paletteId no es Ident", "invalid-shape", { op: "setTheme", paletteId: "OLIVE!" }, false),
    ocase("paletteId inexistente", "invalid-manifest", { op: "setTheme", paletteId: "no-existe" }, true),
    ocase("sin paletteId ni fontSetId", "invalid-manifest", { op: "setTheme" }, true),
  ],
};

const EXPECTED_OPS = [
  "setBlock", "clearBlock", "addItem", "removeItem", "moveItem", "setItemBlock", "clearItemBlock",
  "setSectionVisible", "setSectionVariant", "reorderSections", "setTheme",
];
if (EXPECTED_OPS.length !== 11) throw new Error("EXPECTED_OPS debe tener 11 entradas");
for (const op of EXPECTED_OPS) if (!files[op]) throw new Error(`falta generador para la operación ${op}`);

// -------------------------------------------------------------------------------------------
// 3. Lotes — resolución de `tempId` DENTRO del lote y política todo-o-nada (01 §6.5).
//    Van a `golden/fixtures/` para no alterar el recuento contractual de 11 ficheros de
//    `golden/operations/` (contratos.md §6); el runner de los dos lenguajes los ejecuta igual.
// -------------------------------------------------------------------------------------------
type BatchCase = { name: string; descripcion: string; operations: unknown[]; expect: unknown };
const lotes: BatchCase[] = [];
function bcase(name: string, descripcion: string, ops: unknown[]): void {
  const parsed = ops.map(o => {
    const r = Operation.safeParse(o);
    if (!r.success) throw new Error(`${name}: operación con forma inválida en un caso de lote`);
    return r.data;
  });
  // Cada `addItem` del lote debe recibir un ULID distinto, o el segundo chocaría con el primero.
  let n = 0;
  const ctxLote: ReducerContext = { ...ctx, newUlid: () => ulid("lote" + (n++)) };
  lotes.push({ name, descripcion, operations: ops, expect: applyBatch(documento, parsed, ctxLote) });
}

bcase("tempId resuelto dentro del lote",
  "01 §6.5: `addItem` produce un ULID y lo guarda en idMap[tempId]; una operación POSTERIOR del mismo lote que use ese tempId lo resuelve contra idMap. El cliente nunca aporta ULIDs (ADR-020, P8)",
  [
    { op: "addItem", groupId: "event.cards", tempId: "tmp:nuevoit1", values: {} },
    { op: "setItemBlock", groupId: "event.cards", itemId: "tmp:nuevoit1", blockId: "title", value: textValue("Brindis") },
  ]);
bcase("tempId sin resolver",
  "01 §6.5: un `tempId` que ningún `addItem` anterior del lote creó → TPL_ITEM_UNKNOWN, con el opIndex que falló",
  [{ op: "moveItem", groupId: "event.cards", itemId: "tmp:noexiste", toIndex: 0 }]);
bcase("tempId duplicado en el mismo lote",
  "dos `addItem` con el mismo tempId → TPL_TEMP_ID_DUPLICATE (03 §5, 07 §2 OP_TEMP_ID_DUPLICATE)",
  [
    { op: "addItem", groupId: "event.cards", tempId: "tmp:repetido", values: {} },
    { op: "addItem", groupId: "event.cards", tempId: "tmp:repetido", values: {} },
  ]);
bcase("todo o nada: la segunda operación falla y NADA se aplica",
  "un lote humano es todo-o-nada (ADR-014): si la operación 1 falla, el documento devuelto es el original y el error trae su opIndex",
  [
    { op: "setBlock", blockId: "cover.title", value: textValue("Ana") },
    { op: "setBlock", blockId: "cover.fixed", value: textValue("no editable") },
  ]);
bcase("lote válido de tres operaciones",
  "camino feliz: las tres se aplican en orden sobre el documento acumulado",
  [
    { op: "setBlock", blockId: "cover.title", value: textValue("Ana & Luis") },
    { op: "addItem", groupId: "event.cards", tempId: "tmp:tercera1", values: { title: textValue("Fiesta") } },
    { op: "setSectionVariant", sectionKey: "cover", variant: "alt" },
  ]);

write(FIX + "operations-batches.json", {
  _comentario:
    "Casos de `applyBatch` sobre el fixture `operations-base.json`. `newUlid` devuelve ulid('lote'+n) " +
    "con n empezando en 0 y avanzando UNA vez por cada llamada del lote — el runner de Kotlin debe " +
    "inyectar exactamente esa secuencia para reproducir `expect`.",
  ulidsDelLote: [ulid("lote0"), ulid("lote1"), ulid("lote2")],
  casos: lotes,
});

let total = 0;
let casos = 0;
for (const op of EXPECTED_OPS) {
  const cs = files[op]!();
  for (const tag of ["valid-shape", "invalid-shape", "invalid-manifest"])
    if (!cs.some(c => c.tag === tag)) throw new Error(`${op}: falta un caso ${tag}`);
  write(OUT + `${op}.cases.json`, cs);
  total++;
  casos += cs.length;
}
console.log(
  `golden/operations: ${total} ficheros, ${casos} casos con reducerResult REAL (O-01 cerrada); ` +
  `golden/fixtures/operations-base.json y operations-batches.json (${lotes.length} lotes) emitidos`,
);
