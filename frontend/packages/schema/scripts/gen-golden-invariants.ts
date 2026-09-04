// packages/schema/scripts/gen-golden-invariants.ts — golden/invariants/I-xx-*.json (contratos.md §3/§6,
// 06-pruebas-y-calidad.md §4). Cada caso EJECUTA la función real de src/invariants.ts; si el resultado
// no coincide con lo que el caso declara que debe pasar, el generador lanza (nunca se teclea a mano
// un "expect" no verificado — ADR-1R-D-09).
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  validateManifest, validateDocument, validateValueAgainstSpec, validateReorder, assertNoReservedKeys,
  type Violation, type InvariantCode,
} from "../src/invariants.ts";
import type { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import type { InvitationDocument } from "../src/document.ts";
import type { BlockSpec } from "../src/blocks.ts";
import {
  loc, textSpec, richTextSpec, listTextSpec, imageSpec, audioSpec, dateSpec, timeSpec,
  dateTimeRangeSpec, linkSpec, locationSpec, choiceSpec, booleanSpec, personSpec, groupSpec,
  sectionSpec, themeFixture, manifestFixture, defaultsFixture, documentFixture, structureFrom,
  textValue, richTextValue, listTextValue, imageValue, audioValue, dateValue, timeValue,
  dateTimeRangeValue, linkValue, locationValue, choiceValue, booleanValue, personValue,
  groupValue, groupItem, assetId, ulid,
} from "./fixtures.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = HERE + "../golden/invariants/";
mkdirSync(OUT, { recursive: true });
const clone = <T>(v: T): T => structuredClone(v);
const write = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

function filenameFor(code: InvariantCode): string {
  const [num, ...rest] = code.split("_");
  return `${num}-${rest.join("_").toLowerCase().replace(/_/g, "-")}.json`;
}

// -------------------------------------------------------------------------------------------
// Tipos de caso (documentados en golden/README.md)
// -------------------------------------------------------------------------------------------
type CaseVVAS = { name: string; fn: "validateValueAgainstSpec"; spec: BlockSpec; input: unknown; path: string; expect: InvariantCode[] };
type CaseVM = { name: string; fn: "validateManifest"; manifest: TemplateManifest; theme: ThemeSpec; defaults: DefaultsFile; expect: InvariantCode[] };
type CaseVD = { name: string; fn: "validateDocument"; doc: InvitationDocument; manifest: TemplateManifest; theme: ThemeSpec; expect: InvariantCode[] };
type CaseVR = { name: string; fn: "validateReorder"; order: string[]; actuales: string[]; expect: InvariantCode[] };
type CaseANR = { name: string; fn: "assertNoReservedKeys"; raw: unknown; expect: InvariantCode[] };
type Case = CaseVVAS | CaseVM | CaseVD | CaseVR | CaseANR;

const codes = (vs: Violation[]): InvariantCode[] => [...vs.map(v => v.code)].sort();
const expectEq = (name: string, got: InvariantCode[], want: InvariantCode[]) => {
  if (JSON.stringify(got) !== JSON.stringify(want))
    throw new Error(`caso "${name}": esperaba ${JSON.stringify(want)}, obtuve ${JSON.stringify(got)}`);
};

function vvas(name: string, spec: BlockSpec, input: unknown, path: string, expect: InvariantCode[]): CaseVVAS {
  expectEq(name, codes(validateValueAgainstSpec(spec, input as any, path)), expect);
  return { name, fn: "validateValueAgainstSpec", spec, input, path, expect };
}
function vm(name: string, manifest: TemplateManifest, theme: ThemeSpec, defaults: DefaultsFile, expect: InvariantCode[]): CaseVM {
  expectEq(name, codes(validateManifest(manifest, theme, defaults)), expect);
  return { name, fn: "validateManifest", manifest, theme, defaults, expect };
}
function vd(name: string, doc: InvitationDocument, manifest: TemplateManifest, theme: ThemeSpec, expect: InvariantCode[]): CaseVD {
  expectEq(name, codes(validateDocument(doc, manifest, theme)), expect);
  return { name, fn: "validateDocument", doc, manifest, theme, expect };
}
function vr(name: string, order: string[], actuales: string[], expect: InvariantCode[]): CaseVR {
  expectEq(name, codes(validateReorder(order, actuales)), expect);
  return { name, fn: "validateReorder", order, actuales, expect };
}
function anr(name: string, raw: unknown, expect: InvariantCode[]): CaseANR {
  expectEq(name, codes(assertNoReservedKeys(raw)), expect);
  return { name, fn: "assertNoReservedKeys", raw, expect };
}

// -------------------------------------------------------------------------------------------
// Fixture compartida mínima y válida (clonar y mutar por caso).
// -------------------------------------------------------------------------------------------
function basePkg() {
  const theme = themeFixture();
  const coverTitle = textSpec("cover.title", "coverTitle", { required: true });
  const coverImage = imageSpec("cover.image", "coverImage");
  const eventWhen = dateTimeRangeSpec("event.when", "eventWhen");
  const eventCards = groupSpec("event.cards", "eventCards", [
    textSpec("title", "sectionTitle"), imageSpec("image", "decorative"),
  ], { max: 4 });
  const familyPerson = personSpec("family.person1", "personName");
  const sections = [
    sectionSpec("cover", "cover", [coverTitle, coverImage], { required: true }),
    sectionSpec("event", "event", [eventWhen, eventCards], { variants: ["default", "alt"] }),
    sectionSpec("family", "family", [familyPerson]),
  ];
  const manifest = manifestFixture(sections);
  const defaults = defaultsFixture(manifest, {
    "cover.title": textValue("Boda de Ana y Luis"),
    "cover.image": imageValue(assetId("cov1")),
  });
  return { manifest, theme, defaults };
}
function baseDoc(manifest: TemplateManifest, theme: ThemeSpec) {
  return documentFixture(manifest, theme, {
    content: {
      "cover.title": textValue("Ana & Luis"),
      "event.when": dateTimeRangeValue("2026-12-12T16:00", "2026-12-12T19:00"),
    },
  });
}

// =============================================================================================
const cases: Record<InvariantCode, Case[]> = {} as any;
const add = (code: InvariantCode, list: Case[]) => { cases[code] = list; };

// I-01 -----------------------------------------------------------------------------------------
{
  const spec = dateTimeRangeSpec("event.when", "eventWhen") as BlockSpec;
  add("I-01_RANGE_END_BEFORE_START", [
    vvas("end anterior a start", spec, dateTimeRangeValue("2026-12-12T16:00", "2026-12-12T15:00"), "content.event.when", ["I-01_RANGE_END_BEFORE_START"]),
    vvas("end ausente no viola", spec, dateTimeRangeValue("2026-12-12T16:00"), "content.event.when", []),
    vvas("end igual a start no viola", spec, dateTimeRangeValue("2026-12-12T16:00", "2026-12-12T16:00"), "content.event.when", []),
  ]);
}

// I-02 -----------------------------------------------------------------------------------------
{
  const spec = choiceSpec("rsvp.attend", "decorative", [{ id: "yes" }, { id: "no" }]) as BlockSpec;
  const specUno = choiceSpec("rsvp.single", "decorative", [{ id: "only" }]) as BlockSpec;
  add("I-02_CHOICE_UNKNOWN_OPTION", [
    vvas("optionId fuera de options", spec, choiceValue("maybe"), "content.rsvp.attend", ["I-02_CHOICE_UNKNOWN_OPTION"]),
    vvas("optionId de la lista", spec, choiceValue("yes"), "content.rsvp.attend", []),
    vvas("options con un solo elemento", specUno, choiceValue("only"), "content.rsvp.single", []),
  ]);
}

// I-03 -----------------------------------------------------------------------------------------
{
  const inner = [textSpec("title", "sectionTitle")];
  const spec = groupSpec("event.cards", "eventCards", inner, { max: 24 }) as BlockSpec;
  const dup = ulid("dup");
  add("I-03_ITEM_ID_DUPLICATE", [
    vvas("dos ítems con el mismo ULID", spec,
      { kind: "group", items: [groupItem(dup, { title: textValue("A") }), groupItem(dup, { title: textValue("B") })] },
      "content.event.cards", ["I-03_ITEM_ID_DUPLICATE"]),
    vvas("ítems distintos", spec,
      { kind: "group", items: [groupItem(ulid("a"), { title: textValue("A") }), groupItem(ulid("b"), { title: textValue("B") })] },
      "content.event.cards", []),
    vvas("24 ítems (máximo) todos distintos", spec,
      { kind: "group", items: Array.from({ length: 24 }, (_, i) => groupItem(ulid("i" + i), { title: textValue("T" + i) })) },
      "content.event.cards", []),
  ]);
}

// I-04 -----------------------------------------------------------------------------------------
{
  const inner = [textSpec("title", "sectionTitle")];
  const grpSpec = groupSpec("event.cards", "eventCards", inner, { min: 0, max: 2 }) as BlockSpec;
  const listSpec = listTextSpec("gallery.tags", "decorative", { minItems: 0, maxItems: 3, maxItemLength: 50 }) as BlockSpec;
  add("I-04_GROUP_SIZE_OUT_OF_BOUNDS", [
    vvas("grupo con items.length > max", grpSpec,
      { kind: "group", items: [0, 1, 2].map(i => groupItem(ulid("g" + i), { title: textValue("T") })) },
      "content.event.cards", ["I-04_GROUP_SIZE_OUT_OF_BOUNDS"]),
    vvas("grupo dentro de rango", grpSpec,
      { kind: "group", items: [groupItem(ulid("g0"), { title: textValue("T") })] },
      "content.event.cards", []),
    vvas("listText con items.length > maxItems (mismo código)", listSpec, listTextValue(["a", "b", "c", "d"]), "content.gallery.tags", ["I-04_GROUP_SIZE_OUT_OF_BOUNDS"]),
  ]);
}

// I-05 -----------------------------------------------------------------------------------------
{
  const { manifest, theme, defaults } = basePkg();
  const viola = clone(manifest);
  viola.sections[0]!.blocks.push(textSpec("cover.subtitle", "coverSubtitle", { source: "business" }) as any);
  const noViola = clone(manifest);
  noViola.sections[0]!.blocks.push(textSpec("cover.subtitle", "coverSubtitle", { source: "business", businessField: "invitation.hashtag" }) as any);
  const extra = clone(manifest); // source user sin businessField: no viola I-05
  extra.sections[0]!.blocks.push(textSpec("cover.subtitle2", "coverSubtitle", { source: "user" }) as any);
  add("I-05_BUSINESS_FIELD_MISSING", [
    vm("bloque business sin businessField", viola, theme, defaults, ["I-05_BUSINESS_FIELD_MISSING"]),
    vm("bloque business con businessField", noViola, theme, defaults, []),
    vm("bloque user sin businessField no viola", extra, theme, defaults, []),
  ]);
}

// I-06 -----------------------------------------------------------------------------------------
{
  const { theme, defaults } = basePkg();
  const withBiz = (type: "text" | "date" | "boolean", field: string) => {
    const m = manifestFixture([sectionSpec("cover", "cover", [
      (type === "text" ? textSpec : type === "date" ? dateSpec : booleanSpec)("cover.biz", "decorative", { source: "business", businessField: field as any }) as BlockSpec,
    ])]);
    return m;
  };
  const viola = withBiz("text", "invitation.date");
  const noViola = withBiz("date", "invitation.date");
  const extraCases = ([
    ["invitation.date", "date"], ["invitation.time", "time"], ["invitation.hashtag", "text"],
    ["invitation.coverPhotoUrl", "image"], ["invitation.childrenAllowed", "boolean"], ["invitation.youngAllowed", "boolean"],
  ] as const).map(([field, t], i) => {
    const specFn = t === "text" ? textSpec : t === "date" ? dateSpec : t === "time" ? timeSpec : t === "image" ? imageSpec : booleanSpec;
    const m = manifestFixture([sectionSpec("cover", "cover", [specFn("cover.biz" + i, "decorative", { source: "business", businessField: field }) as BlockSpec])]);
    return vm(`businessField ${field} con tipo correcto ${t}`, m, theme, defaultsFixture(m, {}), []);
  });
  add("I-06_BUSINESS_TYPE_MISMATCH", [
    vm("businessField invitation.date en bloque text", viola, theme, defaultsFixture(viola, {}), ["I-06_BUSINESS_TYPE_MISMATCH"]),
    vm("businessField invitation.date en bloque date", noViola, theme, defaultsFixture(noViola, {}), []),
    ...extraCases,
  ]);
}

// I-07 -----------------------------------------------------------------------------------------
{
  const { theme } = basePkg();
  const mk = (min: number, max: number) => manifestFixture([sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [textSpec("title", "sectionTitle")], { min, max }) as BlockSpec,
  ])]);
  const viola = mk(5, 3), noViola = mk(0, 12), extra = mk(3, 3);
  add("I-07_GROUP_MIN_GT_MAX", [
    vm("min 5 > max 3", viola, theme, defaultsFixture(viola, {}), ["I-07_GROUP_MIN_GT_MAX"]),
    vm("min 0, max 12", noViola, theme, defaultsFixture(noViola, {}), []),
    vm("min == max no viola", extra, theme, defaultsFixture(extra, {}), []),
  ]);
}

// I-08 -----------------------------------------------------------------------------------------
{
  const { theme } = basePkg();
  const secViola = sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")], { variants: ["a", "b"], defaultVariant: "c" });
  const mViola = manifestFixture([secViola]);
  const secOk = sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")], { variants: ["a", "b"], defaultVariant: "a" });
  const mOk = manifestFixture([secOk]);
  add("I-08_DEFAULT_VARIANT_UNKNOWN", [
    vm("defaultVariant fuera de variants", mViola, theme, defaultsFixture(mViola, {}), ["I-08_DEFAULT_VARIANT_UNKNOWN"]),
    vm("defaultVariant dentro de variants", mOk, theme, defaultsFixture(mOk, {}), []),
  ]);
  // segunda mitad de la tabla: structure[].variant desconocido, vía validateDocument
  const docViola = documentFixture(mOk, theme, { structure: { sections: [{ key: "cover", variant: "z", visible: true }] } });
  const docOk = documentFixture(mOk, theme, { structure: { sections: [{ key: "cover", variant: "b", visible: true }] } });
  cases["I-08_DEFAULT_VARIANT_UNKNOWN"]!.push(
    vd("structure[].variant desconocido (validateDocument)", docViola, mOk, theme, ["I-08_DEFAULT_VARIANT_UNKNOWN"]),
    vd("structure[].variant conocido (validateDocument)", docOk, mOk, theme, []),
  );
}

// I-09 -----------------------------------------------------------------------------------------
{
  const { manifest } = basePkg();
  const themeViola = themeFixture({ defaultPaletteId: "no-existe" });
  const themeOk = themeFixture();
  const themeViola2 = themeFixture({ defaultFontSetId: "no-existe" });
  add("I-09_THEME_DEFAULT_UNKNOWN", [
    vm("defaultPaletteId inexistente", manifest, themeViola, defaultsFixture(manifest, {}), ["I-09_THEME_DEFAULT_UNKNOWN"]),
    vm("defaultPaletteId y defaultFontSetId existentes", manifest, themeOk, defaultsFixture(manifest, {}), []),
    vm("defaultFontSetId inexistente (segunda rama)", manifest, themeViola2, defaultsFixture(manifest, {}), ["I-09_THEME_DEFAULT_UNKNOWN"]),
  ]);
}

// I-10 -----------------------------------------------------------------------------------------
{
  const { manifest, theme } = basePkg();
  const dViola = defaultsFixture(manifest, { "no.existe": textValue("x") });
  const dOk = defaultsFixture(manifest, { "cover.title": textValue("x") });
  const dItemBlock = defaultsFixture(manifest, { "image": imageValue(assetId("gg1")) }); // clave de itemBlock, NO es blockId de nivel superior
  add("I-10_DEFAULT_KEY_UNKNOWN", [
    vm("clave de defaults.content que no es blockId", manifest, theme, dViola, ["I-10_DEFAULT_KEY_UNKNOWN"]),
    vm("clave válida", manifest, theme, dOk, []),
    vm("clave que es itemBlock de un grupo: hoy NO es válida (fija el comportamiento)", manifest, theme, dItemBlock, ["I-10_DEFAULT_KEY_UNKNOWN"]),
  ]);
}

// I-11 -----------------------------------------------------------------------------------------
{
  const { manifest, theme } = basePkg();
  const docViola = documentFixture(manifest, theme, { structure: { sections: [{ key: "cover", variant: "default", visible: true }, { key: "cover", variant: "default", visible: true }] } });
  const docOk = documentFixture(manifest, theme);
  const many = manifestFixture(Array.from({ length: 16 }, (_, i) => sectionSpec("s" + i, "cover", [textSpec("s" + i + ".t", "sectionTitle")])));
  const docMany = documentFixture(many, theme);
  add("I-11_STRUCTURE_DUPLICATE_KEY", [
    vd("dos entradas con el mismo key", docViola, manifest, theme, ["I-11_STRUCTURE_DUPLICATE_KEY"]),
    vd("claves distintas", docOk, manifest, theme, []),
    vd("16 entradas (máximo) sin repetir", docMany, many, theme, []),
  ]);
}

// I-12 -----------------------------------------------------------------------------------------
{
  const { manifest, theme } = basePkg();
  const docViola = documentFixture(manifest, theme, { content: { "no.existe": textValue("x") } });
  const docOk = documentFixture(manifest, theme, { content: { "cover.title": textValue("x") } });
  const docOld = documentFixture(manifest, theme, { content: { "cover.subtitle.legacy": textValue("x") } });
  add("I-12_CONTENT_KEY_UNKNOWN", [
    vd('content["noExiste"]', docViola, manifest, theme, ["I-12_CONTENT_KEY_UNKNOWN"]),
    vd("clave declarada", docOk, manifest, theme, []),
    vd("clave de una versión anterior (va a attic)", docOld, manifest, theme, ["I-12_CONTENT_KEY_UNKNOWN"]),
  ]);
}

// I-13 -----------------------------------------------------------------------------------------
{
  const { theme } = basePkg();
  const mViola = manifestFixture([sectionSpec("cover", "cover", [
    textSpec("dup.id", "coverTitle"), textSpec("dup.id", "coverSubtitle"),
  ])]);
  const mOk = manifestFixture([sectionSpec("cover", "cover", [textSpec("a.id", "coverTitle"), textSpec("b.id", "coverSubtitle")])]);
  const mInnerSame = manifestFixture([sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [textSpec("title", "sectionTitle"), textSpec("title", "sectionIntro")]) as BlockSpec,
  ])]);
  const mInnerCross = manifestFixture([sectionSpec("event", "event", [
    groupSpec("event.cardsA", "eventCards", [textSpec("title", "sectionTitle")]) as BlockSpec,
    groupSpec("event.cardsB", "galleryPhotos", [textSpec("title", "sectionTitle")]) as BlockSpec,
  ])]);
  add("I-13_BLOCK_ID_DUPLICATE", [
    vm("mismo blockId en dos secciones", mViola, theme, defaultsFixture(mViola, {}), ["I-13_BLOCK_ID_DUPLICATE"]),
    vm("ids únicos", mOk, theme, defaultsFixture(mOk, {}), []),
    vm("mismo id en dos itemBlocks del MISMO grupo (viola)", mInnerSame, theme, defaultsFixture(mInnerSame, {}), ["I-13_BLOCK_ID_DUPLICATE"]),
    vm("mismo id en itemBlocks de grupos DISTINTOS (no viola: relativos)", mInnerCross, theme, defaultsFixture(mInnerCross, {}), []),
  ]);
}

// I-14 -----------------------------------------------------------------------------------------
{
  const { theme } = basePkg();
  const mViola = manifestFixture([
    sectionSpec("cover", "cover", [textSpec("a", "coverTitle")]),
    { ...sectionSpec("cover", "event", [textSpec("b", "eventTitle")]) },
  ]);
  const mOk = manifestFixture([sectionSpec("cover", "cover", [textSpec("a", "coverTitle")]), sectionSpec("event", "event", [textSpec("b", "eventTitle")])]);
  add("I-14_SECTION_KEY_DUPLICATE", [
    vm("dos secciones con la misma key", mViola, theme, defaultsFixture(mViola, {}), ["I-14_SECTION_KEY_DUPLICATE"]),
    vm("claves distintas", mOk, theme, defaultsFixture(mOk, {}), []),
  ]);
}

// I-15 -----------------------------------------------------------------------------------------
{
  const spec = textSpec("cover.title", "coverTitle") as BlockSpec;
  add("I-15_BLOCK_KIND_MISMATCH", [
    vvas("TextValue sobre ImageSpec", imageSpec("cover.image", "coverImage") as BlockSpec, textValue("x"), "content.cover.image", ["I-15_BLOCK_KIND_MISMATCH"]),
    vvas("tipos coincidentes", spec, textValue("x"), "content.cover.title", []),
    vvas("BooleanValue sobre TextSpec (matriz §5.2, un representante)", spec, booleanValue(true), "content.cover.title", ["I-15_BLOCK_KIND_MISMATCH"]),
  ]);
}

// I-16 -----------------------------------------------------------------------------------------
{
  const textSp = textSpec("cover.title", "coverTitle", { minLength: 3, maxLength: 10 }) as BlockSpec;
  const richSp = richTextSpec("story.body", "storyBody", { maxLength: 20 }) as BlockSpec;
  const listSp = listTextSpec("gallery.tags", "decorative", { maxItemLength: 5 }) as BlockSpec;
  add("I-16_TEXT_TOO_LONG", [
    vvas("text con length > maxLength", textSp, textValue("esto es mucho mas largo de lo permitido"), "content.cover.title", ["I-16_TEXT_TOO_LONG"]),
    vvas("text dentro de rango", textSp, textValue("Hola"), "content.cover.title", []),
    vvas("text con length < minLength (mismo código)", textSp, textValue("ab"), "content.cover.title", ["I-16_TEXT_TOO_LONG"]),
    vvas("listText: ítem que excede maxItemLength", listSp, listTextValue(["123456"]), "content.gallery.tags", ["I-16_TEXT_TOO_LONG"]),
    vvas("richText cuyo texto plano excede maxLength", richSp, richTextValue(["este parrafo es demasiado largo para el limite"]), "content.story.body", ["I-16_TEXT_TOO_LONG"]),
  ]);
}

// I-17 -----------------------------------------------------------------------------------------
{
  const m = manifestFixture([sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")], { required: true }),
    sectionSpec("footer", "footer", [textSpec("footer.note", "footerNote")], { required: false })]);
  const theme = themeFixture();
  const docViola = documentFixture(m, theme, { structure: { sections: [{ key: "cover", variant: "default", visible: false }, { key: "footer", variant: "default", visible: true }] } });
  const docOk = documentFixture(m, theme);
  const docOptOculta = documentFixture(m, theme, { structure: { sections: [{ key: "cover", variant: "default", visible: true }, { key: "footer", variant: "default", visible: false }] } });
  add("I-17_REQUIRED_SECTION_HIDDEN", [
    vd("sección required:true con visible:false", docViola, m, theme, ["I-17_REQUIRED_SECTION_HIDDEN"]),
    vd("sección visible", docOk, m, theme, []),
    vd("sección required:false oculta no viola", docOptOculta, m, theme, []),
  ]);
}

// I-18 -----------------------------------------------------------------------------------------
{
  const spec = groupSpec("event.cards", "eventCards", [textSpec("title", "sectionTitle")]) as BlockSpec;
  add("I-18_ITEM_BLOCK_UNKNOWN", [
    vvas("values con clave que no es itemBlock del grupo", spec, { kind: "group", items: [groupItem(ulid("i1"), { noExiste: textValue("x") })] }, "content.event.cards", ["I-18_ITEM_BLOCK_UNKNOWN"]),
    vvas("clave válida", spec, { kind: "group", items: [groupItem(ulid("i1"), { title: textValue("x") })] }, "content.event.cards", []),
    vvas("clave que es blockId de nivel superior pero no del grupo (viola)", spec, { kind: "group", items: [groupItem(ulid("i1"), { "cover.title": textValue("x") })] }, "content.event.cards", ["I-18_ITEM_BLOCK_UNKNOWN"]),
  ]);
}

// I-19 -----------------------------------------------------------------------------------------
{
  const { manifest, theme } = basePkg();
  const docViola = documentFixture(manifest, theme, { structure: { sections: [{ key: "noExiste", variant: "default", visible: true }] } });
  const docOk = documentFixture(manifest, theme);
  add("I-19_STRUCTURE_KEY_UNKNOWN", [
    vd("structure con key que no está en el manifiesto", docViola, manifest, theme, ["I-19_STRUCTURE_KEY_UNKNOWN"]),
    vd("key válida", docOk, manifest, theme, []),
  ]);
}

// I-20 -----------------------------------------------------------------------------------------
{
  const { manifest, theme } = basePkg();
  const docViola = documentFixture(manifest, theme, { paletteId: "no-existe" });
  const docOk = documentFixture(manifest, theme);
  const docViola2 = documentFixture(manifest, theme, { fontSetId: "no-existe" });
  add("I-20_THEME_ID_UNKNOWN", [
    vd("doc.theme.paletteId inexistente", docViola, manifest, theme, ["I-20_THEME_ID_UNKNOWN"]),
    vd("existente", docOk, manifest, theme, []),
    vd("fontSetId inexistente (segunda rama)", docViola2, manifest, theme, ["I-20_THEME_ID_UNKNOWN"]),
  ]);
}

// I-21 -----------------------------------------------------------------------------------------
{
  const theme = themeFixture();
  const m = manifestFixture([sectionSpec("cover", "cover", [
    textSpec("cover.biz", "decorative", { source: "business", businessField: "invitation.hashtag" }) as BlockSpec,
    textSpec("cover.fixed", "decorative", { source: "fixed" }) as BlockSpec,
    textSpec("cover.title", "coverTitle") as BlockSpec,
  ])]);
  const defaults = defaultsFixture(m, { "cover.fixed": textValue("fijo") });
  const docViolaBiz = documentFixture(m, theme, { content: { "cover.biz": textValue("x") } });
  const docOkUser = documentFixture(m, theme, { content: { "cover.title": textValue("x") } });
  const docViolaFixed = documentFixture(m, theme, { content: { "cover.fixed": textValue("x") } });
  add("I-21_BUSINESS_BLOCK_WRITTEN", [
    vd("content[x] sobre bloque source:business", docViolaBiz, m, theme, ["I-21_BUSINESS_BLOCK_WRITTEN"]),
    vd("bloque source:user", docOkUser, m, theme, []),
    vd("bloque source:fixed escrito (también viola)", docViolaFixed, m, theme, ["I-21_BUSINESS_BLOCK_WRITTEN"]),
  ]);
  void defaults;
}

// I-22 -----------------------------------------------------------------------------------------
{
  const theme = themeFixture();
  const mViola = manifestFixture([sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [textSpec("title", "sectionTitle", { source: "business", businessField: "invitation.hashtag" }) as BlockSpec]) as BlockSpec,
  ])]);
  const mOk = manifestFixture([sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [textSpec("title", "sectionTitle", { source: "user" }) as BlockSpec]) as BlockSpec,
  ])]);
  const mFixed = manifestFixture([sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [textSpec("title", "sectionTitle", { source: "fixed" }) as BlockSpec]) as BlockSpec,
  ])]);
  add("I-22_ITEM_BLOCK_SOURCE_NOT_USER", [
    vm("itemBlock con source:business", mViola, theme, defaultsFixture(mViola, {}), ["I-22_ITEM_BLOCK_SOURCE_NOT_USER"]),
    vm("source:user", mOk, theme, defaultsFixture(mOk, {}), []),
    vm("itemBlock con source:fixed (viola)", mFixed, theme, defaultsFixture(mFixed, {}), ["I-22_ITEM_BLOCK_SOURCE_NOT_USER"]),
  ]);
}

// I-23 -----------------------------------------------------------------------------------------
{
  const theme = themeFixture();
  const m = manifestFixture([sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle")])], { locales: ["es-MX"] });
  const docViola = documentFixture(m, theme, { locale: "en-US" });
  const docOk = documentFixture(m, theme, { locale: "es-MX" });
  const mAll = manifestFixture([sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle", { label: "T" }) as any])], { locales: ["es-MX", "es-ES", "en-US"] });
  add("I-23_LOCALE_NOT_SUPPORTED", [
    vd('meta.locale:"en-US" con locales:["es-MX"]', docViola, m, theme, ["I-23_LOCALE_NOT_SUPPORTED"]),
    vd("locale declarado", docOk, m, theme, []),
    vd("es-MX declarado y usado (matriz, caso 2/3)", documentFixture(mAll, theme, { locale: "es-MX" }), mAll, theme, []),
    vd("es-ES declarado y usado (matriz, caso 3/3)", documentFixture(mAll, theme, { locale: "es-ES" }), mAll, theme, []),
  ]);
}

// I-24 -----------------------------------------------------------------------------------------
add("I-24_REORDER_NOT_A_PERMUTATION", [
  vr('order con clave repetida y faltante', ["cover", "cover", "cover"], ["cover", "event", "footer"], ["I-24_REORDER_NOT_A_PERMUTATION"]),
  vr("permutación exacta de las claves actuales", ["footer", "cover", "event"], ["cover", "event", "footer"], []),
  vr("mismo conjunto en distinto orden no viola", ["event", "footer", "cover"], ["cover", "event", "footer"], []),
]);
{
  cases["I-24_REORDER_NOT_A_PERMUTATION"]!.push(
    vr("una clave de más viola", ["cover", "event", "footer", "extra"], ["cover", "event", "footer"], ["I-24_REORDER_NOT_A_PERMUTATION"]),
  );
}

// I-25 -----------------------------------------------------------------------------------------
{
  const theme = themeFixture();
  const mViolaGroup = manifestFixture([sectionSpec("event", "event", [groupSpec("event.cards", "coverTitle", [textSpec("title", "sectionTitle")]) as BlockSpec])]);
  const mViolaScalar = manifestFixture([sectionSpec("cover", "cover", [textSpec("cover.title", "eventCards") as BlockSpec])]);
  const mOk = manifestFixture([sectionSpec("event", "event", [groupSpec("event.cards", "eventCards", [textSpec("title", "sectionTitle")]) as BlockSpec])]);
  const mInner = manifestFixture([sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [textSpec("title", "galleryPhotos") as BlockSpec]) as BlockSpec,
  ])]);
  add("I-25_GROUP_ROLE_MISMATCH", [
    vm("bloque type:group con rol que no es de grupo", mViolaGroup, theme, defaultsFixture(mViolaGroup, {}), ["I-25_GROUP_ROLE_MISMATCH"]),
    vm("rol coherente con el tipo", mOk, theme, defaultsFixture(mOk, {}), []),
    vm("bloque escalar con rol reservado a grupos (viola)", mViolaScalar, theme, defaultsFixture(mViolaScalar, {}), ["I-25_GROUP_ROLE_MISMATCH"]),
    vm("itemBlock con rol de grupo (viola, dentro del bucle de itemBlocks)", mInner, theme, defaultsFixture(mInner, {}), ["I-25_GROUP_ROLE_MISMATCH"]),
  ]);
}

// I-26 -----------------------------------------------------------------------------------------
{
  const theme = themeFixture();
  const mViola = manifestFixture([sectionSpec("cover", "cover", [
    textSpec("cover.a", "coverTitle") as BlockSpec, textSpec("cover.b", "coverTitle") as BlockSpec,
  ])]);
  const mOk = manifestFixture([sectionSpec("cover", "cover", [textSpec("cover.a", "coverTitle") as BlockSpec])]);
  const mNoSingleton = manifestFixture([sectionSpec("cover", "cover", [
    textSpec("cover.a", "sectionTitle") as BlockSpec, textSpec("cover.b", "sectionTitle") as BlockSpec,
  ])]);
  add("I-26_SINGLETON_ROLE_DUPLICATE", [
    vm("el mismo rol singleton en dos bloques", mViola, theme, defaultsFixture(mViola, {}), ["I-26_SINGLETON_ROLE_DUPLICATE"]),
    vm("un solo uso", mOk, theme, defaultsFixture(mOk, {}), []),
    vm("rol NO singleton repetido no viola", mNoSingleton, theme, defaultsFixture(mNoSingleton, {}), []),
  ]);
}

// I-27 -----------------------------------------------------------------------------------------
// Construido a mano (sin manifestFixture/sectionSpec) porque `name`/`title` de esas factorías solo
// llevan es-MX: con locales:["es-MX","en-US"] eso dispararía I-27 también en `name` y en el título
// de sección, además del `label` bajo prueba — hay que fijar TODOS los demás LocalizedText en los
// dos locales para que el caso aísle una sola causa.
{
  const theme = themeFixture();
  const bilingueNombre = loc("Plantilla de prueba", { "en-US": "Test template" });
  const bilingueTitulo = loc("cover", { "en-US": "cover" });
  const mkManifest = (label: ReturnType<typeof loc>): TemplateManifest => ({
    manifestVersion: 1, slug: "fixture-tpl", version: "1.0.0", name: bilingueNombre,
    eventKinds: ["generic"], minPlanTier: 1, locales: ["es-MX", "en-US"], capabilities: [],
    sections: [{
      key: "cover", type: "cover", title: bilingueTitulo, variants: ["default"], defaultVariant: "default",
      required: false, defaultVisible: true,
      blocks: [{ ...(textSpec("cover.title", "coverTitle") as BlockSpec), label } as BlockSpec],
    }],
    assets: [], migrationsFrom: [],
  });
  const mViola = mkManifest(loc("Título"));
  const mOk = mkManifest(loc("Título", { "en-US": "Title" }));
  const mSingleLocale = manifestFixture([sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle") as BlockSpec])], { locales: ["es-MX"] });
  add("I-27_LOCALIZED_TEXT_MISSING_LOCALE", [
    vm("label sin en-US cuando locales lo declara", mViola, theme, defaultsFixture(mViola, {}), ["I-27_LOCALIZED_TEXT_MISSING_LOCALE"]),
    vm("todos los locales presentes", mOk, theme, defaultsFixture(mOk, {}), []),
    vm("locales:[es-MX] y label solo con es-MX no viola", mSingleLocale, theme, defaultsFixture(mSingleLocale, {}), []),
  ]);
}

// I-28 -----------------------------------------------------------------------------------------
{
  const theme = themeFixture();
  const m = manifestFixture([sectionSpec("cover", "cover", [
    textSpec("cover.biz", "decorative", { source: "business", businessField: "invitation.hashtag" }) as BlockSpec,
    textSpec("cover.user", "coverTitle") as BlockSpec,
    textSpec("cover.fixed", "decorative", { source: "fixed" }) as BlockSpec,
  ])]);
  const dViola = defaultsFixture(m, { "cover.biz": textValue("muerto") });
  const dOk = defaultsFixture(m, { "cover.user": textValue("hola") });
  const dFixed = defaultsFixture(m, { "cover.fixed": textValue("fijo") });
  add("I-28_DEFAULT_FOR_BUSINESS_BLOCK", [
    vm("default sobre bloque source:business", m, theme, dViola, ["I-28_DEFAULT_FOR_BUSINESS_BLOCK"]),
    vm("default sobre bloque source:user", m, theme, dOk, []),
    vm("default sobre source:fixed: hoy NO viola (fija el comportamiento)", m, theme, dFixed, []),
  ]);
}

// I-29 -----------------------------------------------------------------------------------------
{
  // `{ __proto__: ... }` como LITERAL de objeto no crea una clave propia (asigna al prototipo del
  // objeto en runtime) — para simular fielmente el JSON crudo que llega por HTTP (donde "__proto__"
  // SÍ es una clave propia normal del árbol parseado por JSON.parse) hay que construirlo con
  // JSON.parse, tal como lo hace la comprobación real (assertNoReservedKeys corre sobre `raw`).
  const rawViola = JSON.parse('{"content":{"__proto__":{"kind":"text","value":"x"}}}');
  const rawOk = JSON.parse('{"content":{"cover.title":{"kind":"text","value":"x"}}}');
  const rawCtor = JSON.parse('{"content":{"constructor":{"kind":"text","value":"x"},"prototype":{"kind":"text","value":"y"}}}');
  const rawNested = JSON.parse('{"attic":{"boda@1.0.0":{"__proto__":{"kind":"text","value":"x"}}},"content":{"group":{"kind":"group","items":[{"itemId":"01J8AAAAAAAAAAAAAAAAAAAAAA","values":{"__proto__":{"kind":"text","value":"x"}}}]}}}');
  add("I-29_RESERVED_OBJECT_KEY", [
    anr("content con la clave __proto__", rawViola, ["I-29_RESERVED_OBJECT_KEY"]),
    anr("claves normales", rawOk, []),
    anr('"constructor" y "prototype" también violan', rawCtor, ["I-29_RESERVED_OBJECT_KEY", "I-29_RESERVED_OBJECT_KEY"]),
    anr("__proto__ dentro de attic y de GroupItem.values", rawNested, ["I-29_RESERVED_OBJECT_KEY", "I-29_RESERVED_OBJECT_KEY"]),
  ]);
}

// I-30 -----------------------------------------------------------------------------------------
{
  const spec = textSpec("cover.title", "coverTitle", { multiline: false }) as BlockSpec;
  const specMulti = textSpec("story.body", "storyBody", { multiline: true }) as BlockSpec;
  add("I-30_TEXT_MULTILINE_NOT_ALLOWED", [
    vvas("salto de línea con multiline:false", spec, textValue("Ana\nMaría"), "content.cover.title", ["I-30_TEXT_MULTILINE_NOT_ALLOWED"]),
    vvas("mismo valor sin salto de línea", spec, textValue("Ana Maria"), "content.cover.title", []),
    vvas("mismo valor con multiline:true no viola", specMulti, textValue("Ana\nMaría"), "content.story.body", []),
    vvas('"\\r" solo también viola', spec, textValue("Ana\rMaria"), "content.cover.title", ["I-30_TEXT_MULTILINE_NOT_ALLOWED"]),
  ]);
}

// =============================================================================================
let total = 0;
for (const [code, list] of Object.entries(cases) as [InvariantCode, Case[]][]) {
  const violates = list.some(c => c.expect.length > 0);
  const clean = list.some(c => c.expect.length === 0);
  if (!violates || !clean) throw new Error(`${code}: falta un caso que viola o uno que no viola`);
  write(OUT + filenameFor(code), list);
  total++;
}
console.log(`golden/invariants: ${total} ficheros, ${Object.values(cases).reduce((n, l) => n + l.length, 0)} casos totales`);

export { cases };
