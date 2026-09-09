// frontend/templates/scripts/build-packages.mjs
//
// Construye los PAQUETES REGISTRABLES de `frontend/templates/<slug>/<version>/` a partir de los
// ejemplos de forma de `docs/rediseno-plantillas/diseno/ejemplos/<slug>-<version>/`.
//
// Por qué existe (preguntas-abiertas.md, fase 2 · 2-3): los ejemplos del diseño declaran digestos de
// RELLENO (`aa00…01`, `bb00…01`) y `02 §4` paso 2 exige que `sha256`/`bytes`/`contentType` de cada
// `AssetEntry` coincidan con el archivo realmente subido (`422 TPL_PACKAGE_ASSET_MISMATCH`). Este
// script mide los assets de verdad y reescribe SÓLO `assets[]` y `previewImage` del manifiesto;
// todo lo demás del ejemplo se copia sin tocar, para que el paquete siga siendo el mismo diseño.
//
// CAMBIO DEL BLOQUE 3-2d: ya NO dibuja. Los assets los genera `build-art.mjs`
// (SVG autoral → `@resvg/resvg-js` → `sharp` → WebP), que sabe de dirección de arte y de contraste;
// este script se queda con lo que siempre fue suyo: leer la carpeta `assets/`, calcular `sha256`,
// `bytes` y `contentType` de cada archivo REAL y coserlos al manifiesto. El codificador PNG en Node
// puro de la versión anterior (`png.mjs`) queda retirado: producía láminas de un solo trazo y era
// 333 líneas de rasterizador que `resvg` hace mejor. Ver ADR-3-2d-02.
//
// Origen y licencia de las imágenes: OBRA PROPIA generada por `build-art.mjs`. No hay imágenes de
// terceros ni bancos de imágenes de por medio (en este entorno ni siquiera son alcanzables), así que
// no hay ninguna licencia que cumplir. Las tipografías con las que se compone el texto de la
// miniatura son OFL-1.1 y sólo se usan para rasterizar: no viaja ningún archivo de fuente.
//
// Determinista: dos ejecuciones producen los mismos bytes. Eso es lo que hace que volver a registrar
// el mismo paquete sea el `200 {result:'noop_same_hash'}` de ADR-008 y no una versión nueva.
//
// Uso:  node frontend/templates/scripts/build-art.mjs        (primero: genera assets/)
//       node frontend/templates/scripts/build-packages.mjs
//       node frontend/templates/scripts/build-packages.mjs --check   (no escribe; falla si hay deriva)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { themeAA } from './art/paleta-aa.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const EJEMPLOS = path.join(RAIZ, 'docs/rediseno-plantillas/diseno/ejemplos');
const DESTINO = path.join(RAIZ, 'frontend/templates');
const SOLO_COMPROBAR = process.argv.includes('--check');

/** `AssetEntry.contentType` es un enum cerrado (`packages/schema/src/manifest.ts:45-50`). */
const TIPOS = {
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
};

// I-09 (ADR-3B-I09-01) — ALIAS DE ASSET Y ARTE DE DEMOSTRACIÓN DENTRO DEL PAQUETE.
//
// `defaults.json` referencia sus imágenes por `assetId`, pero el `assetId` real lo acuña el servidor
// en el registro (`TemplateRegistrationService.kt`, `"as_" + ulid`), así que un literal escrito a
// mano no resolvía: `cover.image` salía `provenance:"empty"` y `rsvp.background`, que es
// `source:"fixed"`, quedaba inalcanzable por cualquier vía. Desde I-09 el manifiesto puede DECLARAR
// el alias de cada archivo (`AssetEntry.id`) y el backend lo añade al `AssetIndex` apuntando a la
// misma fila de `tpl_asset`. Aquí se cosen las dos mitades:
//
//   · `demo` — las láminas de `demo/<paleta por defecto>/` que el paquete PUBLICA como suyas, para
//     que la invitación recién creada no salga sin una sola foto. Se copian a `assets/` tal cual las
//     dejó `build-art.mjs` (mismo escenario, misma paleta, mismos bytes): este script no dibuja.
//   · `alias` — `assets/<archivo> → assetId`, y ES EL MISMO literal que usa `defaults.json` del
//     ejemplo. La comprobación de abajo falla si alguno se descuelga.
const PLANTILLAS = [
  {
    ejemplo: 'boda-clasica-1.0.0', slug: 'boda-clasica', version: '1.0.0', previewImage: 'assets/preview.webp',
    demo: ['cover.webp', 'portrait-a.webp', 'portrait-b.webp', 'gallery-1.webp', 'gallery-2.webp', 'story-1.webp'],
    alias: {
      'assets/cover.webp': 'as_01J8DEM000000000000000C0V1',      // cover.image     (aspect portrait)
      'assets/portrait-a.webp': 'as_01J8DEM000000000000000N0V1', // couple.groomPhoto (square)
      'assets/portrait-b.webp': 'as_01J8DEM000000000000000N0V2', // couple.bridePhoto (square)
      'assets/gallery-1.webp': 'as_01J8DEM0000000000000000GA1',  // gallery.photos[0] (free)
      'assets/gallery-2.webp': 'as_01J8DEM0000000000000000GA2',  // gallery.photos[1] (free)
      'assets/story-1.webp': 'as_01J8DEM000000000000000H1S1',    // story.milestones[0] (landscape)
      'assets/rsvp-bg.webp': 'as_01J8DEM000000000000000RSV1',    // rsvp.background   (fixed, wide)
    },
  },
  {
    ejemplo: 'xv-jardin-1.0.0', slug: 'xv-jardin', version: '1.0.0', previewImage: 'assets/preview.webp',
    demo: ['cover.webp', 'portrait-a.webp'],
    alias: {
      'assets/cover.webp': 'as_01J8YQYX1HD63EACDQ55S8368N',      // cover.image    (aspect portrait)
      'assets/portrait-a.webp': 'as_01J8R6MAHKEW2GFM9QG29Z4N21', // honoree.photo  (square)
    },
  },
];

/** Todos los `assetId` que aparecen en un `defaults.json`, a cualquier profundidad. */
function assetIdsDe(raiz) {
  const ids = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n === null || typeof n !== 'object') return;
    if (typeof n.assetId === 'string') ids.add(n.assetId);
    Object.values(n).forEach(walk);
  };
  walk(raiz);
  return [...ids].sort();
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
let deriva = 0;

function escribir(destino, contenido) {
  const nuevo = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, 'utf8');
  const igual = fs.existsSync(destino) && Buffer.compare(fs.readFileSync(destino), nuevo) === 0;
  if (SOLO_COMPROBAR) {
    if (!igual) { console.error(`DERIVA: ${path.relative(RAIZ, destino)}`); deriva++; }
    return;
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, nuevo);
}

for (const t of PLANTILLAS) {
  const origen = path.join(EJEMPLOS, t.ejemplo);
  const dir = path.join(DESTINO, t.slug, t.version);
  const dirAssets = path.join(dir, 'assets');
  console.log('');

  const theme = themeAA(t.slug, JSON.parse(fs.readFileSync(path.join(origen, 'theme.json'), 'utf8')));
  const paletaId = theme.defaultPaletteId;
  const paleta = theme.palettes.find((p) => p.id === paletaId).tokens;
  console.log(`== ${t.slug}@${t.version} — paleta por defecto "${paletaId}" (${paleta.bg} / ${paleta.accent}) ==`);

  if (!fs.existsSync(dirAssets)) {
    console.error(`   FALTA ${path.relative(RAIZ, dirAssets)}: ejecuta antes \`node frontend/templates/scripts/build-art.mjs\``);
    process.exit(2);
  }

  // I-09 — el arte de demostración que el paquete publica como suyo. Los bytes son EXACTAMENTE los
  // que `build-art.mjs` dejó en `demo/<paleta por defecto>/`: aquí solo se copian, para que el
  // paquete pueda referenciarlos desde `defaults.json` por su alias.
  const dirDemo = path.join(DESTINO, t.slug, 'demo', paletaId);
  for (const nombre of t.demo ?? []) {
    const origen = path.join(dirDemo, nombre);
    if (!fs.existsSync(origen)) {
      console.error(`   FALTA ${path.relative(RAIZ, origen)}: ejecuta antes \`node frontend/templates/scripts/build-art.mjs\``);
      process.exit(2);
    }
    escribir(path.join(dirAssets, nombre), fs.readFileSync(origen));
  }

  // `assets[]` sale de la carpeta REAL, en orden alfabético para que el manifiesto sea estable.
  // Cualquier archivo que esté aquí y no se declare haría fallar el registro con
  // `TPL_PACKAGE_UNEXPECTED_FILE` (`01 §2.1`), así que se declaran todos, sin excepción.
  const entradas = [];
  for (const nombre of fs.readdirSync(dirAssets).sort()) {
    const ext = path.extname(nombre).toLowerCase();
    const contentType = TIPOS[ext];
    if (!contentType) {
      console.error(`   RECHAZADO assets/${nombre}: extensión "${ext}" fuera del enum de AssetEntry.contentType`);
      process.exit(2);
    }
    const bytes = fs.readFileSync(path.join(dirAssets, nombre));
    const ruta = `assets/${nombre}`;
    const alias = (t.alias ?? {})[ruta];
    // `id` va PRIMERO y solo si existe: un paquete sin alias emite el mismo objeto de siempre.
    entradas.push({ ...(alias ? { id: alias } : {}), path: ruta, sha256: sha256(bytes), contentType, bytes: bytes.length });
    console.log(`   ${ruta.padEnd(23)} ${String(bytes.length).padStart(8)} B  ${contentType.padEnd(11)} sha256:${sha256(bytes).slice(0, 16)}…  ${alias ?? '(sin alias)'}`);
  }
  if (!entradas.some((e) => e.path === t.previewImage)) {
    console.error(`   previewImage "${t.previewImage}" no está entre los assets del paquete (I-08)`);
    process.exit(2);
  }

  const manifiesto = JSON.parse(fs.readFileSync(path.join(origen, 'template.json'), 'utf8'));
  manifiesto.previewImage = t.previewImage;
  manifiesto.assets = entradas;
  escribir(path.join(dir, 'template.json'), JSON.stringify(manifiesto, null, 2) + '\n');
  escribir(path.join(dir, 'theme.json'), JSON.stringify(theme, null, 2) + '\n');
  const defaults = JSON.parse(fs.readFileSync(path.join(origen, 'defaults.json'), 'utf8'));
  // I-09 — la compuerta: un `assetId` de `defaults.json` que ningún `AssetEntry.id` declare NO
  // resuelve, y el bloque sale `provenance:"empty"` sin que nadie se entere. Aquí se entera.
  const declarados = entradas.map((e) => e.id).filter(Boolean);
  const huerfanos = assetIdsDe(defaults.content).filter((id) => !declarados.includes(id));
  if (huerfanos.length > 0) {
    console.error(`   defaults.json referencia assetId que el manifiesto no declara: ${huerfanos.join(', ')}`);
    process.exit(2);
  }
  if (declarados.length !== new Set(declarados).size) {
    console.error(`   dos assets del manifiesto declaran el mismo id`);
    process.exit(2);
  }
  escribir(path.join(dir, 'defaults.json'), JSON.stringify(defaults, null, 2) + '\n');
  console.log(`   template.json / theme.json / defaults.json  →  ${path.relative(RAIZ, dir)}`);
  if ((manifiesto.migrationsFrom ?? []).length > 0) {
    console.error(`   AVISO: migrationsFrom no vacío; falta copiar migrations/ (01 §2.1)`);
  }

  // `package_hash` cubre el paquete ENTERO (ADR-1R-D-03): manifiesto + theme + defaults + assets.
  // Se imprime una huella equivalente para poder cotejar a ojo qué se está registrando.
  const partes = [
    JSON.stringify(manifiesto), JSON.stringify(theme), JSON.stringify(defaults),
    ...entradas.map((e) => e.sha256),
  ];
  console.log(`   huella local del paquete (no es el package_hash del backend): sha256:${sha256(Buffer.from(partes.join('|'))).slice(0, 32)}…`);
}

// =================================================================================================
// VERSIONES DERIVADAS (bloque 4-0A de la fase 4) — subir un paquete ya publicado a la siguiente
// versión semver SIN volver a dibujar nada y SIN teclear un solo `sha256`.
//
// Por qué existe (handoffs/3-para-fase-4.md §4): `boda-clasica` cambió de contenido en I-09, así que
// una base con la `1.0.0` ANTIGUA responde `409 TPL_VERSION_HASH_MISMATCH` al re-registrarse — que es
// el comportamiento correcto (ADR-008: una versión publicada nunca se pisa), no un fallo. La salida
// no es pisar la versión: es publicar una nueva.
//
// Por qué DERIVA de `frontend/templates/<slug>/<desde>/` y no de `diseno/ejemplos/` como el bucle de
// arriba: el ejemplo de diseño describe la `1.0.0` y `diseno/**` es área de sólo lectura para este
// bloque. Además, derivar del paquete ya construido garantiza por construcción que la versión nueva
// contiene EXACTAMENTE los mismos bytes de arte (`build-art.mjs` necesita `@resvg/resvg-js` y
// `sharp`, dependencias nativas que este entorno no tiene instaladas — ADR-3B-I09-02 lo midió), y
// que el diff estructural contra la anterior es vacío salvo que alguien lo cambie a propósito.
//
// Lo que hace, en orden:
//   1. copia `assets/` byte a byte;
//   2. reescribe `template.json` con `version` = destino y `migrationsFrom` = [origen], y vuelve a
//      MEDIR `sha256`/`bytes` de cada archivo real (P5: nunca se teclean);
//   3. reescribe `defaults.json` con `templateVersion` = destino (lo exige
//      `TemplatePackageParser.comprobarDefaults`, `TPL_PACKAGE_DEFAULTS_MISMATCH`);
//   4. copia `theme.json` sin tocar;
//   5. calcula el DIFF ESTRUCTURAL con el mismo algoritmo del backend
//      (`migration/StructuralDiffCalculator.kt`) y emite `migrations/<desde>-to-<hasta>.json` con un
//      `MigrationPlan` que lo cubra (ADR-028). Diff vacío ⇒ `ops: []`;
//   6. calcula el `package_hash` REAL de las dos versiones con la fórmula de `01 §2.1`, para poder
//      cotejarlo con el que devuelve el registro sin tener que levantar el backend.
//
// Uso:  node frontend/templates/scripts/build-packages.mjs            (construye)
//       node frontend/templates/scripts/build-packages.mjs --check    (falla si hay deriva)

//
// `arteRegenerado` (4-9C) — CUANDO LA VERSIÓN NUEVA EXISTE JUSTAMENTE PARA CAMBIAR UN ASSET.
//
// La derivación normal copia los assets byte a byte porque la versión nueva publica el mismo arte.
// `boda-clasica@1.0.2` es el caso contrario: nace porque `preview.webp` llevaba HORNEADO EN PÍXELES
// el nombre de una hacienda de bodas real, y el arreglo es una imagen distinta (ADR-4-9C-01). Esas
// rutas NO se copian de `desde`: las escribe `build-art.mjs` directamente en `hasta`
// (`PLANTILLAS[].versionArte` allí), y aquí sólo se comprueba que estén y se MIDEN para el
// manifiesto. Lo demás —los seis assets de demostración— sí se copia de `desde`, así que la versión
// nueva sigue siendo idéntica a la anterior en todo lo que nadie decidió cambiar.
//
// Las dos listas se mantienen a mano y se vigilan entre sí: la comprobación de más abajo falla si
// `build-art.mjs` no ha dejado el archivo, que es exactamente el orden que documenta su cabecera
// (`build-art.mjs` primero, `build-packages.mjs` después).
const DERIVADAS = [
  { slug: 'boda-clasica', desde: '1.0.0', hasta: '1.0.1' },
  { slug: 'boda-clasica', desde: '1.0.1', hasta: '1.0.2', arteRegenerado: ['assets/preview.webp'] },
];

/** `canonicalJson` de `01 §5.5`, idéntico a `packages/schema/src/compose.ts:228` y a `CanonicalJson.kt`. */
function canonicalJson(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort()
    .map((k) => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}';
}

/**
 * `package_hash` **exactamente** como `01 §2.1` y `schema/PackageHasher.kt`: una línea
 * `"<ruta>\t<sha256hex>"` por archivo, ordenadas por la codificación UTF-8 de la ruta, unidas con
 * `\n` (sin `\n` final). Los `.json` se hashean canonicalizados; los assets, por sus bytes literales.
 */
function packageHash(archivos) {
  const orden = (a, b) => Buffer.compare(Buffer.from(a.ruta, 'utf8'), Buffer.from(b.ruta, 'utf8'));
  const lineas = [...archivos].sort(orden).map((f) => {
    const contenido = f.json !== undefined ? Buffer.from(canonicalJson(f.json), 'utf8') : f.bytes;
    return `${f.ruta}\t${sha256(contenido)}`;
  });
  return 'sha256:' + sha256(Buffer.from(lineas.join('\n'), 'utf8'));
}

/** Lee un paquete de disco tal y como lo verá el registro. */
function leerPaquete(dir) {
  const json = (n) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
  const archivos = [
    { ruta: 'template.json', json: json('template.json') },
    { ruta: 'theme.json', json: json('theme.json') },
    { ruta: 'defaults.json', json: json('defaults.json') },
  ];
  const dirAssets = path.join(dir, 'assets');
  if (fs.existsSync(dirAssets)) {
    for (const n of fs.readdirSync(dirAssets).sort()) {
      archivos.push({ ruta: `assets/${n}`, bytes: fs.readFileSync(path.join(dirAssets, n)) });
    }
  }
  const dirMig = path.join(dir, 'migrations');
  if (fs.existsSync(dirMig)) {
    for (const n of fs.readdirSync(dirMig).sort()) {
      archivos.push({ ruta: `migrations/${n}`, json: JSON.parse(fs.readFileSync(path.join(dirMig, n), 'utf8')) });
    }
  }
  return { manifiesto: archivos[0].json, theme: archivos[1].json, defaults: archivos[2].json, archivos };
}

/** `blockId → BlockSpec` de todos los bloques de primer nivel (los `itemBlocks` de un grupo no cuentan). */
function bloquesDe(manifiesto) {
  const r = new Map();
  for (const s of manifiesto.sections) for (const b of s.blocks) r.set(b.id, { ...b, sectionKey: s.key });
  return r;
}

/**
 * Espejo exacto de `StructuralDiffCalculator.kt`: sólo mira lo que puede ROMPER un documento ya
 * escrito (lo que desaparece o se estrecha). Añadir un bloque, una sección, una variante o una
 * paleta no entra en el diff: R2 le da su default y R1c lo coloca en su sitio.
 */
function diffEstructural(anterior, nueva) {
  const antes = bloquesDe(anterior.manifiesto);
  const ahora = bloquesDe(nueva.manifiesto);
  const removedBlocks = []; const retypedBlocks = []; const narrowedGroups = [];
  for (const id of [...antes.keys()].sort()) {
    const a = antes.get(id); const b = ahora.get(id);
    if (!b) { removedBlocks.push(id); continue; }
    if (a.type !== b.type) { retypedBlocks.push({ id, from: a.type, to: b.type }); continue; }
    if (a.type === 'group' && b.max < a.max) narrowedGroups.push({ id, from: a.max, to: b.max });
  }
  const seccionesAhora = new Map(nueva.manifiesto.sections.map((s) => [s.key, s]));
  const removedSections = []; const removedVariants = [];
  for (const s of [...anterior.manifiesto.sections].sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0))) {
    const n = seccionesAhora.get(s.key);
    if (!n) { removedSections.push(s.key); continue; }
    for (const v of [...s.variants].sort()) if (!n.variants.includes(v)) removedVariants.push({ sectionKey: s.key, variant: v });
  }
  const ids = (xs) => xs.map((x) => x.id);
  const removedPalettes = ids(anterior.theme.palettes).filter((id) => !ids(nueva.theme.palettes).includes(id)).sort();
  const removedFontSets = ids(anterior.theme.fontSets).filter((id) => !ids(nueva.theme.fontSets).includes(id)).sort();
  return { removedBlocks, removedSections, retypedBlocks, narrowedGroups, removedPalettes, removedFontSets, removedVariants };
}

const diffVacio = (d) => Object.values(d).every((x) => x.length === 0);

/**
 * `MigrationPlan` MÍNIMO que cubre el diff, con las 11 operaciones del catálogo cerrado de `01 §6.2`
 * y con la misma noción de "cubierto" que `MigrationPlanCoverageChecker.kt`.
 *
 * Sólo se derivan mecánicamente las tres que no exigen una decisión de autor: `removeSection`
 * (que además cubre los bloques de su sección), `removeBlock` y `shrinkGroup`. Un bloque que cambia
 * de tipo necesita que un humano elija `converterId`, y una paleta o una variante retiradas necesitan
 * un destino: para esos el generador **falla nombrando el elemento** en vez de inventar una
 * operación. P1: nada se descarta en silencio, tampoco aquí.
 */
function planDeMigracion(slug, desde, hasta, anterior, diff) {
  const ops = [];
  const seccionesRetiradas = new Set(diff.removedSections);
  for (const key of diff.removedSections) ops.push({ op: 'removeSection', key });
  const seccionDeBloque = new Map([...bloquesDe(anterior.manifiesto)].map(([id, b]) => [id, b.sectionKey]));
  for (const id of diff.removedBlocks) {
    if (seccionesRetiradas.has(seccionDeBloque.get(id))) continue;   // la removeSection ya lo cubre
    ops.push({ op: 'removeBlock', id });
  }
  for (const g of diff.narrowedGroups) ops.push({ op: 'shrinkGroup', groupId: g.id, max: g.to });
  const aMano = [
    ...diff.retypedBlocks.map((r) => `retypedBlock ${r.id} (${r.from}→${r.to}): elige converterId y escribe changeBlockType`),
    ...diff.removedPalettes.map((p) => `removedPalette ${p}: escribe renamePalette con la paleta destino`),
    ...diff.removedFontSets.map((f) => `removedFontSet ${f}: escribe renameFontSet con el set destino`),
    ...diff.removedVariants
      .filter((v) => !seccionesRetiradas.has(v.sectionKey))
      .map((v) => `removedVariant ${v.sectionKey}.${v.variant}: el catálogo de 11 ops no remapea variantes (hueco conocido, MigrationPlanCoverageChecker.kt); sólo se cubre retirando o renombrando la sección`),
  ];
  if (aMano.length > 0) {
    console.error(`   el diff ${desde} → ${hasta} tiene elementos que NO se pueden derivar sin decidir:`);
    for (const l of aMano) console.error(`     · ${l}`);
    process.exit(2);
  }
  return { templateSlug: slug, from: desde, to: hasta, ops };
}

for (const d of DERIVADAS) {
  const dirDesde = path.join(DESTINO, d.slug, d.desde);
  const dirHasta = path.join(DESTINO, d.slug, d.hasta);
  console.log('');
  console.log(`== ${d.slug}: ${d.desde} → ${d.hasta} (versión derivada) ==`);
  if (!fs.existsSync(path.join(dirDesde, 'template.json'))) {
    console.error(`   FALTA ${path.relative(RAIZ, dirDesde)}: la versión de origen no está construida`);
    process.exit(2);
  }
  const anterior = leerPaquete(dirDesde);

  // 1. assets. Los que la versión nueva NO cambia se copian byte a byte de `desde` (no se dibuja
  //    nada); los de `arteRegenerado` ya los dejó `build-art.mjs` en `hasta` y aquí sólo se exige
  //    que estén. `origenAsset` es la MISMA función que usa el paso 2 para medir, así que
  //    `--check` mide lo mismo que escribe la corrida real: no hay verdes falsos.
  const arteRegenerado = new Set(d.arteRegenerado ?? []);
  const origenAsset = (ruta) => path.join(arteRegenerado.has(ruta) ? dirHasta : dirDesde, ruta);
  for (const nombre of fs.readdirSync(path.join(dirDesde, 'assets')).sort()) {
    const ruta = `assets/${nombre}`;
    if (arteRegenerado.has(ruta)) {
      if (!fs.existsSync(origenAsset(ruta))) {
        console.error(`   FALTA ${path.relative(RAIZ, origenAsset(ruta))}: lo escribe \`build-art.mjs\` ` +
          `(PLANTILLAS[].versionArte = "${d.hasta}"); ejecútalo antes que este script`);
        process.exit(2);
      }
      continue;
    }
    escribir(path.join(dirHasta, ruta), fs.readFileSync(origenAsset(ruta)));
  }
  for (const ruta of arteRegenerado) {
    if (!anterior.manifiesto.assets.some((e) => e.path === ruta)) {
      console.error(`   arteRegenerado declara "${ruta}", que no es un asset de ${d.slug}@${d.desde}`);
      process.exit(2);
    }
  }

  // 2. manifiesto: versión nueva, `migrationsFrom` y `assets[]` MEDIDOS de los archivos reales.
  const manifiesto = JSON.parse(JSON.stringify(anterior.manifiesto));
  manifiesto.version = d.hasta;
  manifiesto.migrationsFrom = [d.desde];
  manifiesto.assets = anterior.manifiesto.assets.map((e) => {
    const bytes = fs.readFileSync(origenAsset(e.path));
    return { ...e, sha256: sha256(bytes), bytes: bytes.length };
  });
  escribir(path.join(dirHasta, 'template.json'), JSON.stringify(manifiesto, null, 2) + '\n');

  // 3-4. `theme.json` tal cual; `defaults.json` sólo cambia la versión que declara.
  escribir(path.join(dirHasta, 'theme.json'), JSON.stringify(anterior.theme, null, 2) + '\n');
  const defaults = JSON.parse(JSON.stringify(anterior.defaults));
  defaults.templateVersion = d.hasta;
  escribir(path.join(dirHasta, 'defaults.json'), JSON.stringify(defaults, null, 2) + '\n');

  // 5. diff estructural + plan de migración (ADR-028).
  const nueva = { manifiesto, theme: anterior.theme, defaults };
  const diff = diffEstructural(anterior, nueva);
  const plan = planDeMigracion(d.slug, d.desde, d.hasta, anterior, diff);
  const nombrePlan = `${d.desde}-to-${d.hasta}.json`;
  escribir(path.join(dirHasta, 'migrations', nombrePlan), JSON.stringify(plan, null, 2) + '\n');
  const resumen = Object.entries(diff).filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}=${v.length}`).join(' ');
  console.log(`   diff estructural contra ${d.desde}: ${diffVacio(diff) ? 'VACÍO' : resumen}`);
  console.log(`   migrations/${nombrePlan}: ${plan.ops.length} operación(es)`);
  if (!diffVacio(diff) && manifiesto.version.split('.')[0] === anterior.manifiesto.version.split('.')[0]) {
    console.error('   AVISO: el diff NO es vacío y el bump no es mayor: el registro lo rechazará con');
    console.error('          422 TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR (TemplateRegistrar.kt:196-203), aunque el plan lo cubra.');
  }

  // 6. `package_hash` real de las dos versiones (`01 §2.1`).
  const nuevos = [
    { ruta: 'template.json', json: manifiesto },
    { ruta: 'theme.json', json: anterior.theme },
    { ruta: 'defaults.json', json: defaults },
    { ruta: `migrations/${nombrePlan}`, json: plan },
    ...anterior.archivos.filter((f) => f.ruta.startsWith('assets/')),
  ];
  console.log(`   package_hash ${d.slug}@${d.desde} = ${packageHash(anterior.archivos)}`);
  console.log(`   package_hash ${d.slug}@${d.hasta} = ${packageHash(nuevos)}`);
  console.log(`   ${path.relative(RAIZ, dirHasta)}`);
}

if (SOLO_COMPROBAR && deriva > 0) {
  console.error(`\n${deriva} archivo(s) con deriva: vuelve a ejecutar sin --check.`);
  process.exit(1);
}
console.log(SOLO_COMPROBAR ? '\nSin deriva.' : '\nPaquetes construidos.');
