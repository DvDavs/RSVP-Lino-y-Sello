// packages/schema/scripts/gen-golden-migrations.ts — golden/migrations/
//
// CIERRA LA OBJECIÓN O-01 / ADR-2-0a-03 en su parte de migración. Antes esta carpeta entregaba
// **0 pares** antes/después porque `migrate.ts` no existía y ninguno de los dos ejemplos declara
// `migrationsFrom`. La revisión dictaminó (2-0a-REV §5.4) que eso NO es lo que ADR-1R-D-09 permite:
// la ADR prohíbe **escribir** golden a mano, no **sintetizar con código** un `MigrationPlan` y ejecutar
// `migrate()` sobre él. Aquí se sintetiza un par 1.0.0→2.0.0 que ejercita las ONCE operaciones de
// migración de `01 §6.2`, más los cinco `MigrationError` y un caso de `switchTemplate` (`01 §6.4`).
//
// Todo el material de entrada se emite como DATO (paquetes de origen y destino, plan y documento):
// Kotlin ejecuta `migrate()`/`switchTemplate()` con solo leer `golden/`, sin conocer este script.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MigrationOp, TemplateManifest, type MigrationPlan, type ThemeSpec, type DefaultsFile } from "../src/manifest.ts";
import type { InvitationDocument } from "../src/document.ts";
import type { TemplatePackage } from "../src/compose.ts";
import { migrate, switchTemplate } from "../src/migrate.ts";
import {
  textSpec, richTextSpec, listTextSpec, imageSpec, dateSpec, groupSpec, sectionSpec,
  themeFixture, manifestFixture, defaultsFixture, documentFixture, loc,
  textValue, richTextValue, listTextValue, imageValue, dateValue, groupItem, groupValue, ulid, assetId,
} from "./fixtures.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const EJEMPLOS = HERE + "../../../../docs/rediseno-plantillas/diseno/ejemplos/";
const OUT = HERE + "../golden/migrations/";
mkdirSync(OUT, { recursive: true });
const write = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const writeDir = (dir: string, files: Record<string, unknown>) => {
  mkdirSync(OUT + dir, { recursive: true });
  for (const [n, v] of Object.entries(files)) write(OUT + dir + "/" + n, v);
};
const paquete = (dir: string, prefijo: string, p: TemplatePackage) => ({
  [`${prefijo}-template.json`]: p.manifest, [`${prefijo}-theme.json`]: p.theme, [`${prefijo}-defaults.json`]: p.defaults,
});

// Verificación de la afirmación que justificaba los 0 pares (sigue siendo cierta: por eso se sintetiza).
for (const dir of ["boda-clasica-1.0.0", "xv-jardin-1.0.0"]) {
  const m = TemplateManifest.parse(JSON.parse(readFileSync(EJEMPLOS + dir + "/template.json", "utf8")));
  if (m.migrationsFrom.length !== 0)
    throw new Error(`${dir} SÍ declara migrationsFrom (${m.migrationsFrom.join(",")}) — derivar de él un caso real`);
}

// =============================================================================================
// 1. `op-shapes.cases.json` — forma de las 11 MigrationOp (se conserva de 2-0a)
// =============================================================================================
type ShapeCase = { name: string; op: unknown; expectZodValid: boolean };
function opCase(name: string, op: unknown, expectZodValid: boolean): ShapeCase {
  const zr = MigrationOp.safeParse(op);
  if (zr.success !== expectZodValid) throw new Error(`${name}: esperaba zodValid=${expectZodValid}, obtuve ${zr.success}`);
  return { name, op, expectZodValid };
}
const shapes: ShapeCase[] = [
  opCase("renameBlock: forma válida", { op: "renameBlock", from: "a.old", to: "a.new" }, true),
  opCase("renameBlock: falta to", { op: "renameBlock", from: "a.old" }, false),
  opCase("removeBlock: forma válida", { op: "removeBlock", id: "a.old" }, true),
  opCase("removeBlock: id con forma inválida de BlockId", { op: "removeBlock", id: "A-old!" }, false),
  opCase("addBlock: forma válida", { op: "addBlock", id: "a.new" }, true),
  opCase("addBlock: campo extra", { op: "addBlock", id: "a.new", value: "x" }, false),
  opCase("renameSection: forma válida", { op: "renameSection", from: "old", to: "new" }, true),
  opCase("renameSection: from con forma inválida de SectionKey", { op: "renameSection", from: "old-section", to: "new" }, false),
  opCase("removeSection: forma válida", { op: "removeSection", key: "old" }, true),
  opCase("removeSection: falta key", { op: "removeSection" }, false),
  opCase("renamePalette: forma válida", { op: "renamePalette", from: "olive", to: "sage" }, true),
  opCase("renamePalette: from mayúsculas (Ident es kebab minúscula)", { op: "renamePalette", from: "Olive", to: "sage" }, false),
  opCase("renameFontSet: forma válida", { op: "renameFontSet", from: "clasica", to: "moderna" }, true),
  opCase("renameFontSet: falta to", { op: "renameFontSet", from: "clasica" }, false),
  opCase("changeBlockType: forma válida", { op: "changeBlockType", id: "a.text", converterId: "textToRichText" }, true),
  opCase("changeBlockType: converterId fuera del catálogo cerrado de 4", { op: "changeBlockType", id: "a.text", converterId: "textToDate" }, false),
  opCase("moveIntoGroup: forma válida", { op: "moveIntoGroup", blockId: "a.old", groupId: "g.items", itemBlockId: "title" }, true),
  opCase("moveIntoGroup: falta itemBlockId", { op: "moveIntoGroup", blockId: "a.old", groupId: "g.items" }, false),
  opCase("flattenGroup: forma válida", { op: "flattenGroup", groupId: "g.items", itemBlockId: "title", toBlockId: "a.new" }, true),
  opCase("flattenGroup: falta toBlockId", { op: "flattenGroup", groupId: "g.items", itemBlockId: "title" }, false),
  opCase("shrinkGroup: forma válida", { op: "shrinkGroup", groupId: "g.items", max: 4 }, true),
  opCase("shrinkGroup: max fuera de rango (1..24)", { op: "shrinkGroup", groupId: "g.items", max: 0 }, false),
];
const REQUIRED_OPS = [
  "renameBlock", "removeBlock", "addBlock", "renameSection", "removeSection", "renamePalette",
  "renameFontSet", "changeBlockType", "moveIntoGroup", "flattenGroup", "shrinkGroup",
];
for (const op of REQUIRED_OPS) if (!shapes.some(c => (c.op as { op: string }).op === op)) throw new Error(`falta MigrationOp ${op}`);
write(OUT + "op-shapes.cases.json", shapes);

// =============================================================================================
// 2. Par antes/después REAL — `fixture-tpl` 1.0.0 → 2.0.0, con las 11 operaciones
// =============================================================================================
const temaOrigen: ThemeSpec = themeFixture({
  palettes: [{ id: "olive", name: loc("Olivo"), tokens: { bg: "#FFFFFF", surface: "#F5F5F0", ink: "#222222", accent: "#556B2F", accentInk: "#FFFFFF", muted: "#999999" } }],
  fontSets: [{ id: "clasica", name: loc("Clásica"), heading: { family: "Playfair Display", weights: [400], source: "bundled" }, body: { family: "Lora", weights: [400], source: "bundled" } }],
});
const temaDestino: ThemeSpec = themeFixture({
  palettes: [{ id: "verde", name: loc("Verde"), tokens: { bg: "#FFFFFF", surface: "#F2F6F0", ink: "#1E2A1E", accent: "#3E6B2F", accentInk: "#FFFFFF", muted: "#8A968A" } }],
  fontSets: [{ id: "serif", name: loc("Serif"), heading: { family: "Playfair Display", weights: [400], source: "bundled" }, body: { family: "Lora", weights: [400], source: "bundled" } }],
  defaultPaletteId: "verde", defaultFontSetId: "serif",
});

const mOrigen = manifestFixture([
  sectionSpec("cover", "cover", [
    textSpec("cover.title", "coverTitle"),
    textSpec("cover.old", "coverSubtitle"),          // renameBlock → cover.new
    textSpec("cover.legacy", "coverButtonLabel"),    // moveIntoGroup → event.cards.title
    textSpec("cover.dropped", "decorative"),         // removeBlock → attic
    textSpec("cover.olvidado", "sectionIntro"),      // SIN operación en el plan → attic igual (§6.3)
  ], { required: true }),
  sectionSpec("story", "story", [
    richTextSpec("story.body", "storyBody"),         // changeBlockType richTextToText
    listTextSpec("story.tags", "storyTitle"),        // changeBlockType listTextToText
    textSpec("conv.aRico", "storyImage"),            // changeBlockType textToRichText
    textSpec("conv.aLista", "celebrantsMessage"),    // changeBlockType textToListText
    textSpec("conv.vacioRico", "familyIntro"),       // textToRichText sobre "" → párrafo sin spans
    textSpec("conv.vacioLista", "galleryIntro"),     // textToListText sobre "" → lista vacía
  ]),
  sectionSpec("gifts", "giftTable", [
    groupSpec("gifts.list", "giftOptions", [textSpec("title", "giftOptionTitle"), textSpec("detail", "giftOptionDetail")], { max: 4 }),
  ]),
  sectionSpec("menu", "amenities", [
    groupSpec("menu.items", "amenityList", [textSpec("name", "amenityName")], { max: 4 }),  // flattenGroup
  ]),
  sectionSpec("extra", "suggestions", [textSpec("extra.note", "suggestionDetail")]),        // removeSection
], { version: "1.0.0" });

const mDestino = manifestFixture([
  sectionSpec("cover", "cover", [
    textSpec("cover.title", "coverTitle"),
    textSpec("cover.new", "coverSubtitle"),
    textSpec("cover.added", "decorative"),           // addBlock: tomará su default en la composición
  ], { required: true }),
  sectionSpec("relato", "story", [                   // renameSection story → relato
    textSpec("story.body", "storyBody", { maxLength: 30, multiline: true }),  // ahora `text`, y trunca
    textSpec("story.tags", "storyTitle"),
    richTextSpec("conv.aRico", "storyImage"),
    listTextSpec("conv.aLista", "celebrantsMessage"),
    richTextSpec("conv.vacioRico", "familyIntro"),
    listTextSpec("conv.vacioLista", "galleryIntro"),
  ]),
  sectionSpec("gifts", "giftTable", [
    groupSpec("gifts.list", "giftOptions", [textSpec("title", "giftOptionTitle"), textSpec("detail", "giftOptionDetail")], { max: 2 }),  // shrinkGroup
  ]),
  sectionSpec("menu", "amenities", [textSpec("menu.note", "amenityDetail")]),   // flattenGroup destino
  sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [textSpec("title", "eventTitle")], { max: 6 }),  // moveIntoGroup destino
  ]),
], { version: "2.0.0" });

const pkgOrigen: TemplatePackage = { manifest: mOrigen, theme: temaOrigen, defaults: defaultsFixture(mOrigen, {}) };
const pkgDestino: TemplatePackage = { manifest: mDestino, theme: temaDestino, defaults: defaultsFixture(mDestino, { "cover.added": textValue("Nuevo por defecto") }) };

const plan: MigrationPlan = {
  templateSlug: "fixture-tpl", from: "1.0.0", to: "2.0.0",
  ops: [
    { op: "renameBlock", from: "cover.old", to: "cover.new" },
    { op: "removeBlock", id: "cover.dropped" },
    { op: "addBlock", id: "cover.added" },
    { op: "renameSection", from: "story", to: "relato" },
    { op: "renamePalette", from: "olive", to: "verde" },
    { op: "renameFontSet", from: "clasica", to: "serif" },
    { op: "changeBlockType", id: "story.body", converterId: "richTextToText" },
    { op: "changeBlockType", id: "story.tags", converterId: "listTextToText" },
    { op: "changeBlockType", id: "conv.aRico", converterId: "textToRichText" },
    { op: "changeBlockType", id: "conv.aLista", converterId: "textToListText" },
    { op: "changeBlockType", id: "conv.vacioRico", converterId: "textToRichText" },
    { op: "changeBlockType", id: "conv.vacioLista", converterId: "textToListText" },
    { op: "moveIntoGroup", blockId: "cover.legacy", groupId: "event.cards", itemBlockId: "title" },
    { op: "flattenGroup", groupId: "menu.items", itemBlockId: "name", toBlockId: "menu.note" },
    { op: "shrinkGroup", groupId: "gifts.list", max: 2 },
    { op: "removeSection", key: "extra" },
  ],
};

const antes: InvitationDocument = documentFixture(mOrigen, temaOrigen, {
  content: {
    "cover.title": textValue("Ana & Luis"),
    "cover.old": textValue("Nos casamos"),
    "cover.legacy": textValue("Confirma tu asistencia"),
    "cover.dropped": textValue("adorno viejo"),
    "cover.olvidado": textValue("nadie lo migró"),
    "story.body": richTextValue(["Nos conocimos un verano en la costa y no nos separamos"]),
    "story.tags": listTextValue(["viaje", "playa"]),
    "conv.aRico": textValue("Un párrafo suelto"),
    "conv.aLista": textValue("Una sola entrada"),
    "conv.vacioRico": textValue(""),
    "conv.vacioLista": textValue(""),
    "gifts.list": groupValue([
      groupItem(ulid("gift1"), { title: textValue("Sobre"), detail: textValue("En la recepción") }),
      groupItem(ulid("gift2"), { title: textValue("Mesa"), detail: textValue("Tienda X") }),
      groupItem(ulid("gift3"), { title: textValue("Viaje"), detail: textValue("Fondo común") }),
      groupItem(ulid("gift4"), { title: textValue("Otro"), detail: textValue("Sorpresa") }),
    ]),
    "menu.items": groupValue([
      groupItem(ulid("menu1"), { name: textValue("Cena de tres tiempos") }),
      groupItem(ulid("menu2"), { name: textValue("Barra libre") }),
    ]),
    "extra.note": textValue("Hotel recomendado"),
  },
});

const r = migrate(antes, pkgOrigen, pkgDestino, plan);
if (!r.ok) throw new Error(`el par sintético NO migra: ${JSON.stringify(r.error)}`);
const dosVeces = migrate(antes, pkgOrigen, pkgDestino, plan);
if (JSON.stringify(r) !== JSON.stringify(dosVeces)) throw new Error("migrate() no es pura (01 §6.3)");
const cubiertas = new Set(plan.ops.map(o => o.op));
for (const op of REQUIRED_OPS) if (!cubiertas.has(op as never)) throw new Error(`el par sintético no ejercita ${op}`);

const DIR_MIGRATE = "fixture-tpl/1.0.0-to-2.0.0";
if (existsSync(OUT + "fixture-tpl")) rmSync(OUT + "fixture-tpl", { recursive: true });
writeDir(DIR_MIGRATE, {
  ...paquete(DIR_MIGRATE, "from", pkgOrigen),
  ...paquete(DIR_MIGRATE, "to", pkgDestino),
  "plan.json": plan,
  "antes.json": antes,
  "despues-esperado.json": r.doc,
  "reporte-esperado.json": r.report,
});

// =============================================================================================
// 2b. Segundo par: 1.0.0 → 1.1.0 con un plan cuyas operaciones NO encuentran contenido que mover.
//     Fija que un plan aplicado sobre un documento vacío es `lossless` y no fabrica nada (R5).
// =============================================================================================
const temaMinor: ThemeSpec = themeFixture({
  palettes: [
    { id: "olive", name: loc("Olivo"), tokens: { bg: "#FFFFFF", surface: "#F5F5F0", ink: "#222222", accent: "#556B2F", accentInk: "#FFFFFF", muted: "#999999" } },
    { id: "verde", name: loc("Verde"), tokens: { bg: "#FFFFFF", surface: "#F2F6F0", ink: "#1E2A1E", accent: "#3E6B2F", accentInk: "#FFFFFF", muted: "#8A968A" } },
  ],
  fontSets: [
    { id: "clasica", name: loc("Clásica"), heading: { family: "Playfair Display", weights: [400], source: "bundled" }, body: { family: "Lora", weights: [400], source: "bundled" } },
    { id: "serif", name: loc("Serif"), heading: { family: "Lora", weights: [400], source: "bundled" }, body: { family: "Lora", weights: [400], source: "bundled" } },
  ],
});
const mMinor = manifestFixture([
  sectionSpec("cover", "cover", [
    textSpec("cover.title", "coverTitle"),
    textSpec("cover.new", "coverSubtitle"),
    textSpec("cover.added", "decorative"),
    textSpec("menu.note", "amenityDetail"),
  ], { required: true }),
  sectionSpec("story", "story", [textSpec("story.body", "storyBody"), listTextSpec("story.tags", "storyTitle")]),
  sectionSpec("gifts", "giftTable", [
    groupSpec("gifts.list", "giftOptions", [textSpec("title", "giftOptionTitle"), textSpec("detail", "giftOptionDetail")], { max: 4 }),
  ]),
  sectionSpec("menu", "amenities", [
    groupSpec("menu.items", "amenityList", [textSpec("name", "amenityName")], { max: 4 }),
  ]),
  sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [textSpec("title", "eventTitle")], { max: 6 }),
  ]),
  sectionSpec("extra", "suggestions", [textSpec("extra.note", "suggestionDetail")]),
], { version: "1.1.0" });
const pkgMinor: TemplatePackage = { manifest: mMinor, theme: temaMinor, defaults: defaultsFixture(mMinor, {}) };
const pkgOrigenMinor: TemplatePackage = { manifest: mOrigen, theme: temaMinor, defaults: defaultsFixture(mOrigen, {}) };

const planMinor: MigrationPlan = {
  templateSlug: "fixture-tpl", from: "1.0.0", to: "1.1.0",
  ops: [
    { op: "addBlock", id: "cover.added" },
    { op: "renameBlock", from: "cover.old", to: "cover.new" },          // sin contenido: no mueve nada
    { op: "changeBlockType", id: "story.body", converterId: "richTextToText" }, // sin contenido
    { op: "moveIntoGroup", blockId: "cover.legacy", groupId: "event.cards", itemBlockId: "title" }, // sin contenido
    { op: "flattenGroup", groupId: "menu.items", itemBlockId: "name", toBlockId: "menu.note" },     // grupo ausente
    { op: "shrinkGroup", groupId: "gifts.list", max: 2 },               // grupo ausente
    { op: "renamePalette", from: "rosa", to: "verde" },                 // no casa con doc.theme
    { op: "renameFontSet", from: "moderna", to: "serif" },              // no casa con doc.theme
  ],
};
const antesMinor: InvitationDocument = documentFixture(mOrigen, temaMinor, { content: {} });
const rMinor = migrate(antesMinor, pkgOrigenMinor, pkgMinor, planMinor);
if (!rMinor.ok) throw new Error(`el par 1.1.0 NO migra: ${JSON.stringify(rMinor.error)}`);
if (!rMinor.report.lossless) throw new Error("el par 1.1.0 debería ser lossless");

const DIR_MINOR = "fixture-tpl/1.0.0-to-1.1.0";
writeDir(DIR_MINOR, {
  ...paquete(DIR_MINOR, "from", pkgOrigenMinor),
  ...paquete(DIR_MINOR, "to", pkgMinor),
  "plan.json": planMinor,
  "antes.json": antesMinor,
  "despues-esperado.json": rMinor.doc,
  "reporte-esperado.json": rMinor.report,
});

// =============================================================================================
// 3. Los cinco MigrationError — `errors.cases.json`, autocontenido
// =============================================================================================
const mMini = manifestFixture([sectionSpec("cover", "cover", [
  textSpec("a.uno", "coverTitle"), richTextSpec("a.rico", "storyBody"),
  groupSpec("a.lista", "giftOptions", [textSpec("title", "giftOptionTitle")], { max: 4 }),
])], { version: "1.0.0" });
const mMini2 = manifestFixture([sectionSpec("cover", "cover", [
  textSpec("a.uno", "coverTitle"), textSpec("a.dos", "coverSubtitle"), textSpec("a.rico", "storyBody"),
  groupSpec("a.lista", "giftOptions", [textSpec("title", "giftOptionTitle")], { max: 1 }),   // cardinalidad reducida
])], { version: "2.0.0" });
const pkgMini: TemplatePackage = { manifest: mMini, theme: temaOrigen, defaults: defaultsFixture(mMini, {}) };
const pkgMini2: TemplatePackage = { manifest: mMini2, theme: temaOrigen, defaults: defaultsFixture(mMini2, {}) };
const docMini = documentFixture(mMini, temaOrigen, { content: { "a.uno": textValue("uno"), "a.rico": richTextValue(["texto"]) } });

type ErrCase = { name: string; plan: MigrationPlan; antes: InvitationDocument; expectError: unknown };
function errCase(name: string, p: MigrationPlan, doc: InvitationDocument): ErrCase {
  const res = migrate(doc, pkgMini, pkgMini2, p);
  if (res.ok) throw new Error(`${name}: esperaba error y migró bien`);
  return { name, plan: p, antes: doc, expectError: res.error };
}
const errores: ErrCase[] = [
  errCase("MIG_PLAN_VERSION_MISMATCH: el plan no va de 1.0.0 a 2.0.0",
    { templateSlug: "fixture-tpl", from: "1.0.0", to: "1.5.0", ops: [] }, docMini),
  errCase("MIG_TARGET_BLOCK_UNKNOWN: renameBlock a un id que el destino no declara",
    { templateSlug: "fixture-tpl", from: "1.0.0", to: "2.0.0", ops: [{ op: "renameBlock", from: "a.uno", to: "a.fantasma" }] }, docMini),
  errCase("MIG_TARGET_BLOCK_EXISTS: renameBlock sobre un id que ya tiene contenido",
    { templateSlug: "fixture-tpl", from: "1.0.0", to: "2.0.0", ops: [{ op: "renameBlock", from: "a.rico", to: "a.uno" }] }, docMini),
  errCase("MIG_CONVERTER_UNSUPPORTED: textToRichText sobre un valor que no es text",
    { templateSlug: "fixture-tpl", from: "1.0.0", to: "2.0.0", ops: [{ op: "changeBlockType", id: "a.rico", converterId: "textToRichText" }] }, docMini),
  // 01 §6.3, caso literal: "el `max` de un grupo baja y el plan no trae `shrinkGroup` ⇒ el documento
  // migrado violaría I-04 y `migrate` devuelve MIG_RESULT_INVALID". Por eso ADR-028 exige que el diff
  // estructural esté cubierto por el plan ANTES de registrar la versión.
  errCase("MIG_RESULT_INVALID: la cardinalidad del grupo baja y el plan no trae shrinkGroup (I-04)",
    { templateSlug: "fixture-tpl", from: "1.0.0", to: "2.0.0", ops: [] },
    documentFixture(mMini, temaOrigen, {
      content: { "a.lista": groupValue([groupItem(ulid("uno1"), { title: textValue("A") }), groupItem(ulid("dos2"), { title: textValue("B") })]) },
    })),
];
const CODIGOS = ["MIG_PLAN_VERSION_MISMATCH", "MIG_TARGET_BLOCK_UNKNOWN", "MIG_TARGET_BLOCK_EXISTS", "MIG_CONVERTER_UNSUPPORTED", "MIG_RESULT_INVALID"];
for (const c of CODIGOS) if (!errores.some(e => (e.expectError as { code: string }).code === c)) throw new Error(`falta caso de ${c}`);
write(OUT + "errors.cases.json", {
  _comentario: "Los cinco MigrationError de 01 §6.1, sobre un par de paquetes mínimo emitido aquí como dato.",
  from: pkgMini, to: pkgMini2, casos: errores,
});

// =============================================================================================
// 4. `switchTemplate` — 01 §6.4 (lo ejecuta `:choose-template`)
// =============================================================================================
const FOTO = assetId("retrato");
const mSwitchA = manifestFixture([
  sectionSpec("cover", "cover", [
    textSpec("a.coverTitle", "coverTitle"),
    imageSpec("a.coverImage", "coverImage"),
    dateSpec("a.coverDate", "coverDate"),
    textSpec("a.sectionTitle", "sectionTitle"),        // NO singleton → attic
  ], { required: true }),
  sectionSpec("family", "family", [
    textSpec("a.parentA1", "parentA1"),
    groupSpec("a.cards", "eventCards", [textSpec("title", "eventTitle")]),  // grupo → SIEMPRE al attic
  ]),
], { slug: "plantilla-a", version: "1.0.0" });
const mSwitchB = manifestFixture([
  sectionSpec("portada", "cover", [
    textSpec("b.titulo", "coverTitle"),                // mismo rol singleton y mismo type → transporta
    textSpec("b.imagen", "coverImage"),                // mismo rol pero OTRO type → NO transporta
    dateSpec("b.fecha", "coverDate"),                  // transporta
    textSpec("b.otroTitulo", "sectionTitle"),
  ], { required: true, variants: ["clasica", "moderna"], defaultVariant: "moderna" }),
  sectionSpec("familia", "family", [textSpec("b.parentA1", "parentA1")]),
  sectionSpec("pie", "footer", [textSpec("b.nota", "footerNote")], { defaultVisible: false }),
], { slug: "plantilla-b", version: "3.1.0" });
const pkgSwitchA: TemplatePackage = { manifest: mSwitchA, theme: temaOrigen, defaults: defaultsFixture(mSwitchA, {}) };
const pkgSwitchB: TemplatePackage = { manifest: mSwitchB, theme: temaDestino, defaults: defaultsFixture(mSwitchB, {}) };
const antesSwitch = documentFixture(mSwitchA, temaOrigen, {
  content: {
    "a.coverTitle": textValue("Ana & Luis"),
    "a.coverImage": imageValue(FOTO, { alt: "portada" }),
    "a.coverDate": dateValue("2027-04-10"),
    "a.sectionTitle": textValue("Nuestra historia"),
    "a.parentA1": textValue("Sra. Ruiz"),
    "a.cards": groupValue([groupItem(ulid("card1"), { title: textValue("Ceremonia") })]),
  },
});
const sw = switchTemplate(antesSwitch, pkgSwitchA, pkgSwitchB);
const sw2 = switchTemplate(antesSwitch, pkgSwitchA, pkgSwitchB);
if (JSON.stringify(sw) !== JSON.stringify(sw2)) throw new Error("switchTemplate() no es determinista");

const DIR_SWITCH = "switch/plantilla-a-to-plantilla-b";
if (existsSync(OUT + "switch")) rmSync(OUT + "switch", { recursive: true });
writeDir(DIR_SWITCH, {
  ...paquete(DIR_SWITCH, "from", pkgSwitchA),
  ...paquete(DIR_SWITCH, "to", pkgSwitchB),
  "antes.json": antesSwitch,
  "despues-esperado.json": sw.doc,
  "reporte-esperado.json": sw.report,
});

// =============================================================================================
// 5. Índice — Kotlin no puede enumerar subdirectorios del classpath con un glob simple
// =============================================================================================
write(OUT + "index.json", {
  _comentario:
    "Índice de los casos con estructura de directorio. `migrate` lleva plan.json; `switch` no. Cada " +
    "directorio trae los DOS paquetes completos (from-*/to-*), el documento de partida y el resultado " +
    "esperado, de modo que Kotlin puede ejecutar migrate()/switchTemplate() sin conocer el generador.",
  migrate: [DIR_MIGRATE, DIR_MINOR],
  switch: [DIR_SWITCH],
});

console.log(
  `golden/migrations: op-shapes.cases.json (${shapes.length} casos), errors.cases.json (${errores.length} casos), ` +
  `2 pares antes/después (${DIR_MIGRATE} con las 11 operaciones, ${DIR_MINOR} sin contenido que mover) ` +
  `y 1 caso de switchTemplate (${DIR_SWITCH})`,
);
