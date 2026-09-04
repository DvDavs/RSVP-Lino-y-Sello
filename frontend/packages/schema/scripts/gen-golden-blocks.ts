// packages/schema/scripts/gen-golden-blocks.ts — golden/blocks/<kind>.cases.json (06 §5.2).
// Matriz obligatoria de 6 casos por tipo de bloque: P, PM, N-kind, N-shape, N-limit, N-null.
// Cada caso se ejecuta de verdad contra BlockValue (Zod) y, cuando corresponde, contra
// validateValueAgainstSpec (ADR-1R-D-09: nada se teclea sin pasar por el código real).
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BlockValue, BlockKind } from "../src/blocks.ts";
import { validateValueAgainstSpec, type InvariantCode } from "../src/invariants.ts";
import type { BlockSpec } from "../src/blocks.ts";
import {
  textSpec, richTextSpec, listTextSpec, imageSpec, audioSpec, dateSpec, timeSpec,
  dateTimeRangeSpec, linkSpec, locationSpec, choiceSpec, booleanSpec, personSpec, groupSpec,
  textValue, richTextValue, listTextValue, imageValue, audioValue, dateValue, timeValue,
  dateTimeRangeValue, linkValue, locationValue, choiceValue, booleanValue, personValue,
  groupValue, groupItem, assetId, ulid,
} from "./fixtures.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = HERE + "../golden/blocks/";
mkdirSync(OUT, { recursive: true });
const write = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

type Tag = "P" | "PM" | "N-kind" | "N-shape" | "N-limit" | "N-null" | "extra";
type BlockCase = {
  name: string; tag: Tag; spec: BlockSpec | null; value: unknown; path: string;
  expectZodValid: boolean; expectViolations: InvariantCode[]; note?: string;
};

function bcase(name: string, tag: Tag, spec: BlockSpec | null, value: unknown, path: string,
  expectZodValid: boolean, expectViolations: InvariantCode[] = [], note?: string): BlockCase {
  const zr = BlockValue.safeParse(value);
  if (zr.success !== expectZodValid)
    throw new Error(`${name} [${tag}]: esperaba zodValid=${expectZodValid}, obtuve ${zr.success}` + (zr.success ? "" : ` (${zr.error?.issues?.[0]?.message})`));
  let violations: InvariantCode[] = [];
  if (zr.success && spec) {
    violations = validateValueAgainstSpec(spec, value as any, path).map(v => v.code).sort();
    if (JSON.stringify(violations) !== JSON.stringify([...expectViolations].sort()))
      throw new Error(`${name} [${tag}]: esperaba violaciones ${JSON.stringify(expectViolations)}, obtuve ${JSON.stringify(violations)}`);
  } else if (expectViolations.length > 0) {
    throw new Error(`${name} [${tag}]: se esperaban violaciones pero el valor no es zod-válido o no hay spec`);
  }
  return { name, tag, spec, value, path, expectZodValid, expectViolations: violations, note };
}

const kinds: Record<string, () => BlockCase[]> = {};

// 1. text --------------------------------------------------------------------------------------
kinds.text = () => {
  const spec = textSpec("test.text", "decorative", { minLength: 0, maxLength: 200 }) as BlockSpec;
  const specMin1 = textSpec("test.text", "decorative", { minLength: 1, maxLength: 200 }) as BlockSpec;
  return [
    bcase("P mínimo", "P", spec, textValue("Ana"), "content.test.text", true, []),
    bcase("PM: value al límite superior (200)", "PM", spec, textValue("a".repeat(200)), "content.test.text", true, []),
    bcase("N-kind: ImageValue contra TextSpec", "N-kind", spec, imageValue(assetId("nk1")), "content.test.text", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta value", "N-shape", spec, { kind: "text" }, "content.test.text", false),
    bcase("N-limit: 2001 chars excede el máximo DURO de TextValue (2000)", "N-limit", spec, textValue("a".repeat(2001)), "content.test.text", false),
    bcase("N-null", "N-null", spec, null, "content.test.text", false),
    bcase('extra: value:"" con minLength:0 es válido', "extra", spec, textValue(""), "content.test.text", true, []),
    bcase('extra: value:"" con minLength:1 viola I-16', "extra", specMin1, textValue(""), "content.test.text", true, ["I-16_TEXT_TOO_LONG"]),
  ];
};

// 2. richText ------------------------------------------------------------------------------------
kinds.richText = () => {
  const spec = richTextSpec("test.rich", "decorative", { maxLength: 8000 }) as BlockSpec;
  const p1 = richTextValue(["Un párrafo."]);
  const pm = richTextValue(Array.from({ length: 40 }, (_, i) => `Párrafo ${i}.`));
  const p41 = richTextValue(Array.from({ length: 41 }, (_, i) => `Párrafo ${i}.`));
  return [
    bcase("P mínimo: 1 párrafo, 1 span", "P", spec, p1, "content.test.rich", true, []),
    bcase("PM: 40 párrafos (máximo)", "PM", spec, pm, "content.test.rich", true, []),
    bcase("N-kind: TextValue contra RichTextSpec", "N-kind", spec, textValue("x"), "content.test.rich", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta doc", "N-shape", spec, { kind: "richText" }, "content.test.rich", false),
    bcase("N-limit: 41 párrafos excede RichDoc.max(40)", "N-limit", spec, p41, "content.test.rich", false),
    bcase("N-null", "N-null", spec, null, "content.test.rich", false),
    bcase('extra: marks:["bold","italic","bold"] excede max(2)', "extra", spec, {
      kind: "richText", doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: ["bold", "italic", "bold"] }] }] },
    }, "content.test.rich", false),
    bcase('extra: href con javascript: falla HttpUrl', "extra", spec, {
      kind: "richText", doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", href: "javascript:alert(1)" }] }] },
    }, "content.test.rich", false),
  ];
};

// 3. listText ------------------------------------------------------------------------------------
kinds.listText = () => {
  const spec = listTextSpec("test.list", "decorative", { minItems: 0, maxItems: 12, maxItemLength: 200 }) as BlockSpec;
  // spec dedicado para el caso "trampa" (maxItemLength por debajo del máximo DURO de 200 del esquema,
  // para que un ítem de 150 chars sea zod-válido pero SÍ viole el maxItemLength DECLARADO — I-16).
  const specCorto = listTextSpec("test.list2", "decorative", { minItems: 0, maxItems: 12, maxItemLength: 100 }) as BlockSpec;
  return [
    bcase("P mínimo", "P", spec, listTextValue(["a"]), "content.test.list", true, []),
    bcase("PM: 12 ítems (máximo) de 200 chars", "PM", spec, listTextValue(Array.from({ length: 12 }, (_, i) => "x".repeat(200))), "content.test.list", true, []),
    bcase("N-kind: ImageValue contra ListTextSpec", "N-kind", spec, imageValue(assetId("nk2")), "content.test.list", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta items", "N-shape", spec, { kind: "listText" }, "content.test.list", false),
    bcase("N-limit: 13 ítems excede ListTextValue.max(12)", "N-limit", spec, listTextValue(Array.from({ length: 13 }, () => "x")), "content.test.list", false),
    bcase("N-null", "N-null", spec, null, "content.test.list", false),
    bcase("extra: items:[] con minItems:0 es válido", "extra", spec, listTextValue([]), "content.test.list", true, []),
    bcase("extra: ítem de 150 chars excede maxItemLength:100 declarado → I-16 (sin tocar el máx. duro de 200)", "extra", specCorto, listTextValue(["x".repeat(150)]), "content.test.list2", true, ["I-16_TEXT_TOO_LONG"]),
  ];
};

// 4. image ---------------------------------------------------------------------------------------
kinds.image = () => {
  const spec = imageSpec("test.image", "decorative") as BlockSpec;
  const id = assetId("img1");
  return [
    bcase("P mínimo", "P", spec, imageValue(id, { alt: "", x: 0, y: 0 }), "content.test.image", true, []),
    bcase("PM: alt de 200 chars, focal en el límite", "PM", spec, imageValue(id, { alt: "a".repeat(200), x: 1, y: 1 }), "content.test.image", true, []),
    bcase("N-kind: TextValue contra ImageSpec", "N-kind", spec, textValue("x"), "content.test.image", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta assetId", "N-shape", spec, { kind: "image", alt: "", focal: { x: 0, y: 0 } }, "content.test.image", false),
    bcase("N-limit: focal.x = 1.1 excede Focal.max(1)", "N-limit", spec, { kind: "image", assetId: id, alt: "", focal: { x: 1.1, y: 0 } }, "content.test.image", false),
    bcase("N-null", "N-null", spec, null, "content.test.image", false),
    bcase("extra: assetId sin prefijo as_", "extra", spec, { kind: "image", assetId: id.slice(3), alt: "", focal: { x: 0, y: 0 } }, "content.test.image", false),
    bcase("extra: alt:\"\" es válido (imagen decorativa, a11y debe tolerarlo)", "extra", spec, imageValue(id, { alt: "" }), "content.test.image", true, []),
  ];
};

// 5. audio ---------------------------------------------------------------------------------------
kinds.audio = () => {
  const spec = audioSpec("test.audio", "backgroundMusic") as BlockSpec;
  const id = assetId("aud1");
  return [
    bcase("P mínimo", "P", spec, audioValue(id), "content.test.audio", true, []),
    bcase("PM: AudioValue no tiene más campos opcionales que rellenar", "PM", spec, audioValue(id), "content.test.audio", true, []),
    bcase("N-kind: TextValue contra AudioSpec", "N-kind", spec, textValue("x"), "content.test.audio", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta assetId", "N-shape", spec, { kind: "audio" }, "content.test.audio", false),
    bcase("N-limit: no aplica — AudioValue no lleva ningún campo numérico; maxBytes se comprueba en el reductor (X-06), no aquí", "N-limit", spec, audioValue(id), "content.test.audio", true, []),
    bcase("N-null", "N-null", spec, null, "content.test.audio", false),
    bcase("extra: ULID en minúsculas es inválido (Crockford exige mayúsculas)", "extra", spec, { kind: "audio", assetId: "as_" + id.slice(3).toLowerCase() }, "content.test.audio", false),
  ];
};

// 6. date ------------------------------------------------------------------------------------------
kinds.date = () => {
  const spec = dateSpec("test.date", "eventDate") as BlockSpec;
  return [
    bcase("P mínimo", "P", spec, dateValue("2026-12-31"), "content.test.date", true, []),
    bcase("PM: DateValue no tiene más campos", "PM", spec, dateValue("2026-01-01"), "content.test.date", true, []),
    bcase("N-kind: TextValue contra DateSpec", "N-kind", spec, textValue("x"), "content.test.date", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta value", "N-shape", spec, { kind: "date" }, "content.test.date", false),
    bcase("N-limit: mes 13 no existe", "N-limit", spec, dateValue("2026-13-01"), "content.test.date", false),
    bcase("N-null", "N-null", spec, null, "content.test.date", false),
    bcase('extra (hueco conocido, ver preguntas-abiertas.md): "2026-02-30" PASA el regex — IsoDate no valida días por mes', "extra", spec, dateValue("2026-02-30"), "content.test.date", true, []),
  ];
};

// 7. time -----------------------------------------------------------------------------------------
kinds.time = () => {
  const spec = timeSpec("test.time", "eventTime") as BlockSpec;
  return [
    bcase("P mínimo", "P", spec, timeValue("23:59"), "content.test.time", true, []),
    bcase("PM: TimeValue no tiene más campos", "PM", spec, timeValue("00:00"), "content.test.time", true, []),
    bcase("N-kind: TextValue contra TimeSpec", "N-kind", spec, textValue("x"), "content.test.time", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta value", "N-shape", spec, { kind: "time" }, "content.test.time", false),
    bcase("N-limit: 24:00 no existe (horas 00-23)", "N-limit", spec, timeValue("24:00"), "content.test.time", false),
    bcase("N-null", "N-null", spec, null, "content.test.time", false),
    bcase('extra: "9:30" sin cero a la izquierda falla', "extra", spec, timeValue("9:30"), "content.test.time", false),
  ];
};

// 8. dateTimeRange ------------------------------------------------------------------------------
kinds.dateTimeRange = () => {
  const spec = dateTimeRangeSpec("test.range", "eventWhen") as BlockSpec;
  return [
    bcase("P mínimo: solo start", "P", spec, dateTimeRangeValue("2026-12-31T16:00"), "content.test.range", true, []),
    bcase("PM: con end presente", "PM", spec, dateTimeRangeValue("2026-12-31T16:00", "2026-12-31T18:00"), "content.test.range", true, []),
    bcase("N-kind: TextValue contra DateTimeRangeSpec", "N-kind", spec, textValue("x"), "content.test.range", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta start", "N-shape", spec, { kind: "dateTimeRange", end: "2026-12-31T18:00" }, "content.test.range", false),
    bcase("N-limit: end anterior a start → I-01", "N-limit", spec, dateTimeRangeValue("2026-12-31T16:00", "2026-12-31T15:00"), "content.test.range", true, ["I-01_RANGE_END_BEFORE_START"]),
    bcase("N-null", "N-null", spec, null, "content.test.range", false),
    bcase("extra: start con zona (Z) falla el regex (IsoLocalDateTime es sin zona)", "extra", spec, { kind: "dateTimeRange", start: "2026-12-31T16:00:00Z" }, "content.test.range", false),
  ];
};

// 9. link --------------------------------------------------------------------------------------
kinds.link = () => {
  const spec = linkSpec("test.link", "coverButtonLink") as BlockSpec;
  return [
    bcase("P mínimo", "P", spec, linkValue("https://a.mx"), "content.test.link", true, []),
    bcase("PM: label de 80 chars (máximo)", "PM", spec, linkValue("https://a.mx", "a".repeat(80)), "content.test.link", true, []),
    bcase("N-kind: TextValue contra LinkSpec", "N-kind", spec, textValue("x"), "content.test.link", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta href", "N-shape", spec, { kind: "link" }, "content.test.link", false),
    bcase("N-limit: label de 81 chars", "N-limit", spec, linkValue("https://a.mx", "a".repeat(81)), "content.test.link", false),
    bcase("N-null", "N-null", spec, null, "content.test.link", false),
    bcase("extra: href javascript: rechazado por HttpUrl", "extra", spec, { kind: "link", href: "javascript:alert(1)" }, "content.test.link", false),
  ];
};

// 10. location -----------------------------------------------------------------------------------
kinds.location = () => {
  const spec = locationSpec("test.location", "eventPlace") as BlockSpec;
  return [
    bcase("P mínimo", "P", spec, locationValue("Templo"), "content.test.location", true, []),
    bcase("PM: con address y mapHref", "PM", spec, locationValue("Templo", { address: "Calle 1", mapHref: "https://maps.example.com/x" }), "content.test.location", true, []),
    bcase("N-kind: TextValue contra LocationSpec", "N-kind", spec, textValue("x"), "content.test.location", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta name", "N-shape", spec, { kind: "location" }, "content.test.location", false),
    bcase("N-limit: name:\"\" (min 1)", "N-limit", spec, locationValue(""), "content.test.location", false),
    bcase("N-null", "N-null", spec, null, "content.test.location", false),
    bcase("extra: mapHref no-http rechazado", "extra", spec, { kind: "location", name: "Templo", mapHref: "geo:1,2" }, "content.test.location", false),
  ];
};

// 11. choice -------------------------------------------------------------------------------------
kinds.choice = () => {
  const spec = choiceSpec("test.choice", "decorative", [{ id: "cash" }, { id: "transfer" }]) as BlockSpec;
  return [
    bcase("P mínimo", "P", spec, choiceValue("cash"), "content.test.choice", true, []),
    bcase("PM: ChoiceValue no tiene más campos", "PM", spec, choiceValue("transfer"), "content.test.choice", true, []),
    bcase("N-kind: TextValue contra ChoiceSpec", "N-kind", spec, textValue("x"), "content.test.choice", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta optionId", "N-shape", spec, { kind: "choice" }, "content.test.choice", false),
    bcase("N-limit: optionId en mayúsculas (Ident es kebab minúscula)", "N-limit", spec, choiceValue("CASH"), "content.test.choice", false),
    bcase("N-null", "N-null", spec, null, "content.test.choice", false),
    bcase("extra: optionId válido en forma pero ausente de spec.options → I-02", "extra", spec, choiceValue("crypto"), "content.test.choice", true, ["I-02_CHOICE_UNKNOWN_OPTION"]),
  ];
};

// 12. boolean --------------------------------------------------------------------------------------
kinds.boolean = () => {
  const spec = booleanSpec("test.boolean", "rsvpChildrenAllowed") as BlockSpec;
  return [
    bcase("P mínimo", "P", spec, booleanValue(true), "content.test.boolean", true, []),
    bcase("PM: BooleanValue no tiene más campos", "PM", spec, booleanValue(false), "content.test.boolean", true, []),
    bcase("N-kind: TextValue contra BooleanSpec", "N-kind", spec, textValue("x"), "content.test.boolean", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta value", "N-shape", spec, { kind: "boolean" }, "content.test.boolean", false),
    bcase('N-limit: value:"true" (string, no boolean)', "N-limit", spec, { kind: "boolean", value: "true" }, "content.test.boolean", false),
    bcase("N-null", "N-null", spec, null, "content.test.boolean", false),
  ];
};

// 13. person ---------------------------------------------------------------------------------------
kinds.person = () => {
  const spec = personSpec("test.person", "personName") as BlockSpec;
  return [
    bcase("P mínimo", "P", spec, personValue("Ana"), "content.test.person", true, []),
    bcase("PM: note al límite (200 chars)", "PM", spec, personValue("Ana", "a".repeat(200)), "content.test.person", true, []),
    bcase("N-kind: TextValue contra PersonSpec", "N-kind", spec, textValue("x"), "content.test.person", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta name", "N-shape", spec, { kind: "person" }, "content.test.person", false),
    bcase("N-limit: name:\"\" (min 1)", "N-limit", spec, personValue(""), "content.test.person", false),
    bcase("N-null", "N-null", spec, null, "content.test.person", false),
    bcase("extra: note de 201 chars", "extra", spec, personValue("Ana", "a".repeat(201)), "content.test.person", false),
  ];
};

// 14. group ------------------------------------------------------------------------------------
kinds.group = () => {
  const inner = [textSpec("title", "sectionTitle")] as BlockSpec[];
  const spec = groupSpec("test.group", "eventCards", inner, { min: 0, max: 24 }) as BlockSpec;
  const item1 = groupItem(ulid("gi1"), { title: textValue("A") });
  return [
    bcase("P mínimo: 1 ítem con values vacío", "P", spec, { kind: "group", items: [groupItem(ulid("gi0"), {})] }, "content.test.group", true, []),
    bcase("PM: 24 ítems (máximo)", "PM", spec, groupValue(Array.from({ length: 24 }, (_, i) => groupItem(ulid("g" + i), { title: textValue("T" + i) }))), "content.test.group", true, []),
    bcase("N-kind: TextValue contra GroupSpec", "N-kind", spec, textValue("x"), "content.test.group", true, ["I-15_BLOCK_KIND_MISMATCH"]),
    bcase("N-shape: falta items", "N-shape", spec, { kind: "group" }, "content.test.group", false),
    bcase("N-limit: 25 ítems excede GroupValue.max(24)", "N-limit", spec, groupValue(Array.from({ length: 25 }, (_, i) => groupItem(ulid("h" + i), {}))), "content.test.group", false),
    bcase("N-null", "N-null", spec, null, "content.test.group", false),
    bcase("extra: values con clave no declarada → I-18", "extra", spec, groupValue([groupItem(ulid("x1"), { noExiste: textValue("x") })]), "content.test.group", true, ["I-18_ITEM_BLOCK_UNKNOWN"]),
    bcase("extra: itemId duplicado → I-03", "extra", spec, groupValue([item1, groupItem(item1.itemId, { title: textValue("B") })]), "content.test.group", true, ["I-03_ITEM_ID_DUPLICATE"]),
    bcase("extra: grupo anidado dentro de values debe fallar (ScalarValue excluye GroupValue)", "extra", spec, {
      kind: "group", items: [{ itemId: ulid("nest"), values: { title: { kind: "group", items: [] } } }],
    }, "content.test.group", false),
  ];
};

// =============================================================================================
if (Object.keys(kinds).length !== BlockKind.options.length)
  throw new Error(`faltan tipos de bloque: generados ${Object.keys(kinds).length}, catálogo ${BlockKind.options.length}`);

let total = 0;
for (const kind of BlockKind.options) {
  const list = kinds[kind]!();
  const required: Tag[] = ["P", "PM", "N-kind", "N-shape", "N-limit", "N-null"];
  for (const tag of required) if (!list.some(c => c.tag === tag)) throw new Error(`${kind}: falta el caso ${tag}`);
  write(OUT + `${kind}.cases.json`, list);
  total++;
}
console.log(`golden/blocks: ${total} ficheros (${BlockKind.options.length} tipos de bloque)`);
