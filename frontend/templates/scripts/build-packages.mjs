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

if (SOLO_COMPROBAR && deriva > 0) {
  console.error(`\n${deriva} archivo(s) con deriva: vuelve a ejecutar sin --check.`);
  process.exit(1);
}
console.log(SOLO_COMPROBAR ? '\nSin deriva.' : '\nPaquetes construidos.');
