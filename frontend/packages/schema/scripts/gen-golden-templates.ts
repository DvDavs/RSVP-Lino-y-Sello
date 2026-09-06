// packages/schema/scripts/gen-golden-templates.ts — golden/templates/<slug>-<version>/
// Ejecuta compose() DE VERDAD sobre los dos ejemplos completos de diseno/ejemplos/ (contratos.md §3)
// y escribe su salida como golden (ADR-1R-D-09: el golden ES la salida de compose, nunca se teclea).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import { InvitationDocument } from "../src/document.ts";
import { compose, type TemplatePackage } from "../src/compose.ts";
import type { AssetIndex, BusinessSnapshot } from "../src/composed.ts";
import {
  textSpec, richTextSpec, sectionSpec, themeFixture, manifestFixture, defaultsFixture,
  documentFixture, textValue, richTextValueMarcado, loc,
} from "./fixtures.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const EJEMPLOS = HERE + "../../../../docs/rediseno-plantillas/diseno/ejemplos/";
const OUT = HERE + "../golden/templates/";

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

/**
 * URL de CDN determinista a partir del assetId: la misma regla usada para producir los
 * `compuesto.json` de referencia de la ronda 1R (verificado por igualdad byte a byte más abajo).
 *
 * **CONVENCIÓN DE FIXTURE, NO REGLA DE PRODUCCIÓN** (objeción O-06 de `bitacora/2-0a-REV.md`). En
 * producción `AssetUrlResolver` construye `"{templates2.assets.public-base-url}/{s3_key}"` a partir de
 * la columna `s3_key` de `tpl_asset` (`02 §10.4`): deriva de un dato almacenado, no del `assetId`.
 * Por eso el `AssetIndex` resultante se emite como DATO (`assets.json`) en cada carpeta de golden: así
 * el lado Kotlin reproduce `compuesto.json` sin conocer —ni poder copiar— esta convención (remedio
 * real que la revisión dejó pendiente; ADR-2-2-02).
 */
const cdnUrl = (id: string): string => `https://cdn.invitaciones.evolutiondev.mx/a/${id.slice(3)}.webp`;

/** Recorre content/defaults (incluidos los items de grupo) y recoge todo assetId referenciado. */
function collectAssetIds(...roots: unknown[]): Set<string> {
  const ids = new Set<string>();
  const walk = (n: unknown) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n === null || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (typeof o.assetId === "string") ids.add(o.assetId);
    for (const v of Object.values(o)) walk(v);
  };
  roots.forEach(walk);
  return ids;
}

function buildAssetIndex(ids: Set<string>): AssetIndex {
  const idx: AssetIndex = {};
  for (const id of [...ids].sort()) idx[id] = { url: cdnUrl(id) };   // ordenado: el golden es dato estable
  return idx;
}

type CaseDef = { dir: string; business: BusinessSnapshot };

const CASES: CaseDef[] = [
  {
    dir: "boda-clasica-1.0.0",
    // Valores literales de docs/rediseno-plantillas/diseno/ejemplos/boda-clasica-1.0.0/NOTAS.md
    // ("BusinessSnapshot asumido"). Es el que produjo el compuesto.json ya verificado en la ronda 1R.
    business: {
      invitationId: 4821, date: "2026-12-12", time: "16:30", hashtag: "#CamilaYAntonio2026",
      coverPhotoUrl: null, childrenAllowed: true, youngAllowed: true, eventKind: "wedding",
      planTier: 2, timezone: "America/Mexico_City",
    },
  },
  {
    dir: "xv-jardin-1.0.0",
    // NOTAS.md de este ejemplo no fija un BusinessSnapshot explícito. Se reconstruye el único
    // campo que el manifiesto realmente consume (cover.date, source:business) a partir de la
    // fecha que ya aparece en compuesto.json (2026-11-14); el resto son valores conservadores
    // sin efecto observable (ningún otro bloque de esta plantilla es `source:"business"`).
    // Registrado como supuesto en memoria/preguntas-abiertas.md (2-0a).
    business: {
      invitationId: 5190, date: "2026-11-14", time: null, hashtag: null,
      coverPhotoUrl: null, childrenAllowed: true, youngAllowed: true, eventKind: "quince",
      planTier: 2, timezone: "America/Mexico_City",
    },
  },
];

/** Lee las entradas de un ejemplo de `diseno/ejemplos/` y las compone con el `compose()` real. */
function componerEjemplo(dir: string, business: BusinessSnapshot) {
  const src = EJEMPLOS + dir + "/";
  const manifest = TemplateManifest.parse(readJson(src + "template.json"));
  const theme = ThemeSpec.parse(readJson(src + "theme.json"));
  const defaults = DefaultsFile.parse(readJson(src + "defaults.json"));
  const doc = InvitationDocument.parse(readJson(src + "documento.json"));
  const assets = buildAssetIndex(collectAssetIds(doc.content, defaults.content));
  const pkg: TemplatePackage = { manifest, theme, defaults };
  return { src, manifest, theme, defaults, doc, assets, result: compose(pkg, doc, business, assets, doc.meta.locale) };
}

/** Rutas JSON en las que dos valores difieren (para poder REVISAR el diff, ADR-1R-D-09). */
function rutasQueCambian(a: unknown, b: unknown, ruta = "$"): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  const objeto = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (objeto(a) && objeto(b)) {
    const claves = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return claves.flatMap((k) => rutasQueCambian(a[k], b[k], `${ruta}.${k}`));
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.flatMap((v, i) => rutasQueCambian(v, b[i], `${ruta}[${i}]`));
  }
  return [`${ruta}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
}

/**
 * REGENERA la referencia `diseno/ejemplos/<dir>/compuesto.json` desde el `compose()` real.
 *
 * `genGoldenTemplates()` compara su salida contra esa referencia y ABORTA si difiere: es la única
 * comprobación independiente de que `compose()` no ha derivado, y por eso el camino normal NO la
 * reescribe. Pero cuando lo que cambia es una ENTRADA legítima del ejemplo (`theme.json`,
 * `defaults.json`, `documento.json`), la referencia tiene que volver a generarse — ADR-1R-D-09 dice
 * literalmente "se regenera y se revisa el diff", no "es inmutable". Esta función es ese camino, y
 * es EXPLÍCITO (`--actualizar-referencia`): imprime ruta por ruta lo que cambia para que el diff se
 * pueda revisar, en vez de dejar que un golden se reescriba solo y la compuerta se mire al espejo.
 *
 * Uso: `tsx scripts/gen-golden-templates.ts --actualizar-referencia` y después `gen:golden`.
 */
export function regenEjemplosCompuesto(): { dir: string; cambios: string[] }[] {
  const salida: { dir: string; cambios: string[] }[] = [];
  for (const { dir, business } of CASES) {
    const { src, result } = componerEjemplo(dir, business);
    const anterior: unknown = readJson(src + "compuesto.json");
    const cambios = rutasQueCambian(anterior, JSON.parse(JSON.stringify(result.composed)));
    if (cambios.length > 0) writeJson(src + "compuesto.json", result.composed);
    salida.push({ dir, cambios });
  }
  return salida;
}

export function genGoldenTemplates(): { dir: string; matched: boolean }[] {
  const results: { dir: string; matched: boolean }[] = [];
  for (const { dir, business } of CASES) {
    const { src, manifest, theme, defaults, doc, assets, result } = componerEjemplo(dir, business);

    // Autoverificación ANTES de escribir nada (revisión 2-0a-REV, objeción O-01): el golden de
    // referencia de la ronda 1R (`diseno/ejemplos/**/compuesto.json`) es inmutable y es la única
    // prueba independiente de que el AssetIndex y el BusinessSnapshot de arriba son correctos.
    // Si `compose()` regresara, escribir primero y avisar después dejaría el golden REESCRITO con
    // la salida errónea y `compose.templates.test.ts` seguiría en verde comparándose consigo mismo.
    // Por eso se lanza y no se escribe: ADR-1R-D-09 exige que el golden sea la salida verificada.
    const referencia = readFileSync(src + "compuesto.json", "utf8");
    const propio = JSON.stringify(result.composed, null, 2) + "\n";
    if (referencia !== propio)
      throw new Error(
        `golden/templates/${dir}: compose() ya NO reproduce diseno/ejemplos/${dir}/compuesto.json ` +
        `byte a byte. No se ha escrito ningún golden. Corrige compose()/AssetIndex/BusinessSnapshot, ` +
        `nunca el golden (ADR-1R-D-09).`);
    const matched = true;

    const outDir = OUT + dir + "/";
    mkdirSync(outDir, { recursive: true });
    writeJson(outDir + "template.json", manifest);
    writeJson(outDir + "theme.json", theme);
    writeJson(outDir + "defaults.json", defaults);
    writeJson(outDir + "documento.json", doc);
    writeJson(outDir + "business.json", business);
    writeJson(outDir + "assets.json", assets);   // O-06: el AssetIndex es DATO del golden, no un .ts
    writeJson(outDir + "compuesto.json", result.composed);
    writeJson(outDir + "reporte.json", result.report);

    results.push({ dir, matched });
  }
  return results;
}

// ---------------------------------------------------------------------------------------------
// Caso SINTETIZADO — `richtext-marcas-1.0.0` (I-01).
//
// Los dos golden de arriba vienen de `diseno/ejemplos/`, y **ninguno de sus documentos lleva un solo
// `marks`**: hasta la fase 3-B `marks` sólo aparecía en `golden/blocks/richText.cases.json`, que es un
// fichero de casos de ESQUEMA y no pasa jamás por `DomainJson.encode`. Resultado medido (H-ADV-01):
// poner negrita o cursiva en el editor devolvía `500 TPL_INTERNAL` con 2 390 pruebas en verde.
//
// Este caso no puede salir de `diseno/ejemplos/` (esa carpeta es la referencia INMUTABLE de la ronda
// 1R y su `compuesto.json` no se toca), así que se SINTETIZA con los constructores de `fixtures.ts`
// y se compone con el `compose()` real. ADR-1R-D-09 prohíbe *escribir* golden a mano, no
// *sintetizarlos* — es el mismo camino que `gen-golden-compose.ts` y `gen-golden-migrations.ts`.
//
// Cubre las tres procedencias de un `richText` con marcas: `user` (story.body, en `content`),
// `default` (story.note, sólo en `defaults.json`) y un span con `href` además de `marks`.
// ---------------------------------------------------------------------------------------------
const DIR_MARCAS = "richtext-marcas-1.0.0";

/**
 * Paleta del golden SINTETIZADO, corregida a WCAG 2.2 AA (bloque 4-0C).
 *
 * `themeFixture()` trae `muted: "#999999"`, que mide 2,85:1 sobre `bg #FFFFFF` y 2,60:1 sobre
 * `surface #F5F5F0` — por debajo incluso del 3,0 de `04 §17.1`, y muy por debajo del 4,5 que
 * WCAG 1.4.3 exige a `muted` como color de TEXTO normal (ADR-3-3b-03). Este `theme.json` es uno de
 * los cinco que `test/paleta-contraste.contract.test.ts` mide, así que un golden con esa paleta
 * dejaría la compuerta en rojo o la obligaría a hacer excepciones.
 *
 * Se corrige con el MISMO método que las cinco paletas reales (ADR-3-2d-04 + ADR-3-3b-03): mismo
 * matiz y misma saturación HSL (aquí un gris neutro: matiz 0°, saturación 0 %), sólo baja la
 * luminosidad, hasta el valor MÁS CLARO que cumple con margen +0,08 contra los DOS fondos.
 * Medido con `frontend/templates/scripts/art/color.mjs`: `#707070` = 4,528 sobre `surface` (falla el
 * margen), `#6F6F6F` = 4,595 sobre `surface` y 5,025 sobre `bg` (cumple). Ningún otro token cambia.
 *
 * Se corrige AQUÍ y no en `themeFixture()` a propósito: el valor por defecto de la fixture está
 * ESPEJADO a mano en el lado Kotlin (`src/test/.../composition/Fx.kt:127`, `InvariantPathTest.kt:126`,
 * `ManifestNormalizacionTest.kt:125`), que es territorio prohibido en esta fase; cambiarlo rompería
 * la paridad de `golden/compose/**` sin poder arreglar el espejo. Queda en `preguntas-abiertas.md`.
 */
const PALETA_MARCAS_AA = [{
  id: "olive", name: loc("Olivo"),
  tokens: { bg: "#FFFFFF", surface: "#F5F5F0", ink: "#222222", accent: "#556B2F", accentInk: "#FFFFFF", muted: "#6F6F6F" },
}];

export function genGoldenMarcas(): string {
  const theme = themeFixture({ palettes: PALETA_MARCAS_AA });
  const manifest = manifestFixture(
    [
      sectionSpec("cover", "cover", [
        textSpec("cover.title", "coverTitle", { maxLength: 80, required: true }),
      ], { required: true }),
      sectionSpec("story", "story", [
        richTextSpec("story.body", "storyBody"),
        richTextSpec("story.note", "sectionIntro"),
      ]),
    ],
    { slug: "richtext-marcas", version: "1.0.0" },
  );

  const defaults = defaultsFixture(manifest, {
    "cover.title": textValue("Camila & Antonio"),
    // Escalón `default` (R2) con marcas: el codificador lo ve también por `defaults.json`.
    "story.note": richTextValueMarcado([
      [{ text: "Escribe aquí vuestra historia. " }, { text: "En cursiva", marks: ["italic"] }, { text: "." }],
    ]),
  });

  const documento = documentFixture(manifest, theme, {
    content: {
      "cover.title": textValue("Camila & Antonio"),
      // Escalón `user` (R2): exactamente la forma que emite el editor al teclear `**negrita**`
      // y `*cursiva*` (`apps/web/lib/rich-text.ts:43`), más un span con las dos marcas y otro con href.
      "story.body": richTextValueMarcado([
        [
          { text: "Nos conocimos en " },
          { text: "Oaxaca", marks: ["bold"] },
          { text: " un martes " },
          { text: "cualquiera", marks: ["italic"] },
          { text: "." },
        ],
        [
          { text: "Las dos marcas a la vez", marks: ["bold", "italic"] },
          { text: " y un enlace ", marks: [] },
          { text: "al mapa", href: "https://maps.example.com/oaxaca" },
        ],
        [],
      ]),
    },
  });

  const business: BusinessSnapshot = {
    invitationId: 9301, date: "2027-05-22", time: "18:00", hashtag: "#CamilaYAntonio",
    coverPhotoUrl: null, childrenAllowed: true, youngAllowed: true, eventKind: "generic",
    planTier: 1, timezone: "America/Mexico_City",
  };
  const assets: AssetIndex = {};   // este caso no referencia ningún asset: el foco es `marks`.

  // Las entradas se validan con el Zod real ANTES de componer: un golden sintetizado que no pase el
  // esquema sería un golden inválido, y aquí no hay `compuesto.json` de referencia que lo delate.
  const manifestOk = TemplateManifest.parse(manifest);
  const themeOk = ThemeSpec.parse(theme);
  const defaultsOk = DefaultsFile.parse(defaults);
  const docOk = InvitationDocument.parse(documento);

  const pkg: TemplatePackage = { manifest: manifestOk, theme: themeOk, defaults: defaultsOk };
  const r = compose(pkg, docOk, business, assets, docOk.meta.locale);
  const dos = compose(pkg, docOk, business, assets, docOk.meta.locale);
  if (JSON.stringify(r) !== JSON.stringify(dos)) throw new Error(`${DIR_MARCAS}: compose() no es idempotente`);

  const outDir = OUT + DIR_MARCAS + "/";
  mkdirSync(outDir, { recursive: true });
  writeJson(outDir + "template.json", manifestOk);
  writeJson(outDir + "theme.json", themeOk);
  writeJson(outDir + "defaults.json", defaultsOk);
  writeJson(outDir + "documento.json", docOk);
  writeJson(outDir + "business.json", business);
  writeJson(outDir + "assets.json", assets);
  writeJson(outDir + "compuesto.json", r.composed);
  writeJson(outDir + "reporte.json", r.report);
  return DIR_MARCAS;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--actualizar-referencia")) {
    for (const { dir, cambios } of regenEjemplosCompuesto()) {
      console.log(`diseno/ejemplos/${dir}/compuesto.json: ${cambios.length === 0 ? "sin cambios" : `REGENERADO, ${cambios.length} ruta(s):`}`);
      for (const c of cambios) console.log(`    ${c}`);
    }
  }
  const r = genGoldenTemplates();
  for (const { dir, matched } of r) {
    console.log(`golden/templates/${dir}: ${matched ? "coincide byte a byte con diseno/ejemplos" : "NO coincide con diseno/ejemplos (ver consola)"}`);
  }
  console.log(`golden/templates/${genGoldenMarcas()}: sintetizado (richText con marks, I-01)`);
}
