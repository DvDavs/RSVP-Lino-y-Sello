// frontend/templates/scripts/build-packages.mjs
//
// Construye los PAQUETES REGISTRABLES de `frontend/templates/<slug>/<version>/` a partir de los
// ejemplos de forma de `docs/rediseno-plantillas/diseno/ejemplos/<slug>-<version>/`.
//
// Por qué existe (preguntas-abiertas.md, fase 2 · 2-3): los ejemplos del diseño declaran digestos de
// RELLENO (`aa00…01`, `bb00…01`) y `02 §4` paso 2 exige que `sha256`/`bytes`/`contentType` de cada
// `AssetEntry` coincidan con el archivo realmente subido (`422 TPL_PACKAGE_ASSET_MISMATCH`). Este
// script genera los assets de verdad y reescribe SÓLO `assets[]` y `previewImage` del manifiesto;
// todo lo demás del ejemplo se copia sin tocar, para que el paquete siga siendo el mismo diseño.
//
// Origen y licencia de las imágenes: OBRA PROPIA generada por este script con `png.mjs` (Node puro,
// sin dependencias). No hay imágenes de terceros ni bancos de imágenes de por medio, así que no hay
// ninguna licencia que cumplir. Los colores salen de la paleta por defecto del `theme.json` de cada
// plantilla, para que la miniatura del catálogo case con lo que el cliente verá.
//
// Determinista: dos ejecuciones producen los mismos bytes (ver cabecera de `png.mjs`). Eso es lo que
// hace que volver a registrar el mismo paquete sea el `200 {result:'noop_same_hash'}` de ADR-008 y
// no una versión nueva.
//
// Uso:  node frontend/templates/scripts/build-packages.mjs
//       node frontend/templates/scripts/build-packages.mjs --check   (no escribe; falla si hay deriva)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Canvas } from './png.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../..');
const EJEMPLOS = path.join(RAIZ, 'docs/rediseno-plantillas/diseno/ejemplos');
const DESTINO = path.join(RAIZ, 'frontend/templates');
const SOLO_COMPROBAR = process.argv.includes('--check');

// --------------------------------------------------------------------------------- dibujo botánico

/** Ramita: dos tallos curvos simétricos con hojas alternas. El motivo de una papelería de boda. */
function sprig(c, cx, cy, escala, accent, muted, k = 1) {
  const K = c.h / c.w; // corrige la anisotropía: X va en fracción de ancho, Y en fracción de alto
  for (const lado of [-1, 1]) {
    const p0 = [cx, cy];
    const p1 = [cx + lado * 0.075 * escala, cy - 0.052 * escala];
    const p2 = [cx + lado * 0.190 * escala, cy - 0.068 * escala];
    c.strokeQuad(p0, p1, p2, 1.5, muted, 0.50 * k);
    for (let i = 1; i <= 9; i++) {
      const t = i / 9.6;
      const m = 1 - t;
      const x = m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0];
      const y = m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1];
      // tangente del tallo, en píxeles, para orientar las hojas respecto a él
      const tx = (2 * m * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])) * c.w;
      const ty = (2 * m * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])) * c.h;
      const base = Math.atan2(ty, tx);
      const tam = (1.0 - t * 0.42) * 0.042 * escala;
      for (const arriba of [-1, 1]) {
        c.fillLeaf(x, y, tam, tam * 0.30, base + arriba * 0.72, accent, (0.30 + 0.12 * (1 - t)) * k);
      }
    }
    // hoja terminal, en la punta del tallo
    const puntaAng = Math.atan2((p2[1] - p1[1]) * c.h, (p2[0] - p1[0]) * c.w);
    c.fillLeaf(p2[0], p2[1], 0.030 * escala, 0.0090 * escala, puntaAng, accent, 0.34 * k);
  }
  void K;
}

/** Corona: dos arcos de hojas que cierran un círculo. El motivo de una invitación de XV. */
function wreath(c, cx, cy, r, escala, accent, muted) {
  const rx = r;
  const ry = (r * c.w) / c.h;
  for (const lado of [-1, 1]) {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const ang = Math.PI / 2 + lado * (0.30 + t * 2.12);
      const x = cx + Math.cos(ang) * rx;
      const y = cy + Math.sin(ang) * ry;
      // tangente del círculo en píxeles → las hojas siguen el aro, apuntando hacia arriba
      const tang = Math.atan2(Math.cos(ang) * ry * c.h * -lado, -Math.sin(ang) * rx * c.w * -lado);
      const tam = (0.52 + 0.48 * Math.sin(t * Math.PI)) * 0.075 * escala;
      c.fillLeaf(x, y, tam, tam * 0.21, tang - lado * 0.30, accent, 0.26 + 0.13 * Math.sin(t * Math.PI));
      c.fillLeaf(x, y, tam * 0.62, tam * 0.15, tang + lado * 0.46, muted, 0.18);
    }
  }
}

/**
 * Ventana en arco: el recurso más reconocible de la papelería de boda y de XV. Se resuelve como la
 * unión de un rectángulo y media elipse; la cobertura se calcula por campo de distancia, así que el
 * borde queda antialiaseado sin supermuestrear.
 */
function arch(c, x0, y0, x1, y1, fillHex, fillAlpha, strokeHex, strokeAlpha) {
  const X0 = x0 * c.w, X1 = x1 * c.w, Y0 = y0 * c.h, Y1 = y1 * c.h;
  const cx = (X0 + X1) / 2;
  const rx = (X1 - X0) / 2;
  const ry = rx * 1.05;
  const yc = Y0 + ry;
  const sdf = (px, py) => {
    if (py >= yc) {
      // rectángulo inferior
      const dx = Math.abs(px - cx) - rx;
      const dy = py - Y1;
      return Math.max(dx, dy);
    }
    const nx = (px - cx) / rx;
    const ny = (py - yc) / ry;
    return (Math.hypot(nx, ny) - 1) * Math.min(rx, ry);
  };
  const dentro = (px, py) => 1 - smooth(sdf(px, py), -0.8, 0.8);
  c.paintMask(fillHex, fillAlpha, dentro);
  return { sdf, dentro, cx: (x0 + x1) / 2, top: yc / c.h, y0, y1 };
}

const smooth = (x, a, b) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Filete horizontal con rombo al centro: el separador clásico de una invitación impresa. */
function rule(c, cy, ancho, color) {
  const x0 = 0.5 - ancho / 2;
  const x1 = 0.5 + ancho / 2;
  c.paintMask(color, 0.42, (px, py) => {
    const u = px / c.w;
    const dy = Math.abs(py - cy * c.h);
    if (u < x0 || u > x1) return 0;
    const borde = Math.min(u - x0, x1 - u) / 0.06;
    return (1 - Math.min(1, dy / 1.1)) * Math.min(1, borde);
  });
  const s = 0.010;
  c.paintMask(color, 0.55, (px, py) => {
    const u = px / c.w - 0.5;
    const v = (py / c.h - cy) * (c.h / c.w);
    const d = (Math.abs(u) + Math.abs(v) - s) * c.w;
    return 1 - Math.min(1, Math.max(0, d + 0.9) / 1.8);
  });
}

/** Doble filete de marco, el borde de papelería fina. */
function doubleFrame(c, inset, color) {
  c.strokeRoundRect(inset, inset * (c.w / c.h), 1 - inset, 1 - inset * (c.w / c.h), 0.012, 2.2, color, 0.40);
  const i2 = inset + 0.018;
  c.strokeRoundRect(i2, i2 * (c.w / c.h), 1 - i2, 1 - i2 * (c.w / c.h), 0.010, 1.1, color, 0.30);
}

// ------------------------------------------------------------------------------ las dos plantillas

/** Miniatura de catálogo, retrato 5:7 (`previewImage` de `01 §2.2`). */
function preview(paleta, motivo) {
  const { bg, surface, accent, ink, muted } = paleta;
  const c = new Canvas(800, 1120);
  c.linearGradient(0.15, 0, 0.85, 1, [
    [0.0, surface],
    [0.35, bg],
    [0.75, mezcla(bg, accent, 0.18)],
    [1.0, mezcla(bg, accent, 0.34)],
  ]);
  c.radialGlow(0.5, 0.14, 0.90, 0.40, surface, 0.55, 1.6);
  c.radialGlow(0.12, 0.90, 0.66, 0.32, accent, 0.18, 2.2);
  c.radialGlow(0.92, 0.74, 0.52, 0.26, accent, 0.13, 2.2);
  c.vignette(ink, 0.15, 0.58);

  doubleFrame(c, 0.058, muted);
  // sombra suave bajo el arco, para que la ventana se despegue del fondo
  c.radialGlow(0.5, 0.60, 0.42, 0.34, ink, 0.07, 2.6);
  const a = arch(c, 0.185, 0.170, 0.815, 0.845, surface, 0.66, muted, 0.34);
  // el interior del arco no es blanco plano: baja hacia el tinte de la paleta
  const yA = a.y0 * c.h, yB = a.y1 * c.h;
  c.paintMask(mezcla(bg, accent, 0.22), 0.30, (px, py) =>
    a.dentro(px, py) * Math.max(0, Math.min(1, (py - yA) / (yB - yA))) ** 1.6);
  // doble filo del arco: el de fuera marcado, el de dentro apenas insinuado
  c.paintMask(muted, 0.34, (px, py) => 1 - smooth(Math.abs(a.sdf(px, py)), 0.35, 1.55));
  c.paintMask(muted, 0.20, (px, py) => 1 - smooth(Math.abs(a.sdf(px, py) + 11), 0.35, 1.45));

  if (motivo === 'sprig') {
    sprig(c, 0.5, 0.318, 0.78, accent, muted);
    rule(c, 0.505, 0.30, muted);
    sprig(c, 0.5, 0.745, 0.52, accent, muted);
  } else {
    wreath(c, 0.5, 0.360, 0.130, 0.85, accent, muted);
    rule(c, 0.545, 0.30, muted);
    sprig(c, 0.5, 0.760, 0.50, accent, muted);
  }
  c.grain(0.0032, 1301);
  return c.toPng();
}

/** Fondo apaisado para una sección (RSVP / héroe): 16:9, muy suave, sin nada que compita con el texto. */
function background(paleta, semilla) {
  const { bg, surface, accent, ink, muted } = paleta;
  const c = new Canvas(1600, 900);
  c.linearGradient(0.0, 0.1, 1.0, 0.95, [
    [0.0, surface],
    [0.40, bg],
    [1.0, mezcla(bg, accent, 0.22)],
  ]);
  c.radialGlow(0.22, 0.20, 0.80, 0.85, surface, 0.50, 1.5);
  c.radialGlow(0.86, 0.82, 0.66, 0.80, accent, 0.18, 2.0);
  c.radialGlow(0.55, 0.50, 1.10, 1.10, mezcla(bg, accent, 0.10), 0.20, 2.4);
  // filigrana botánica muy tenue: dos ramas, no manchas — sigue leyéndose como papelería
  sprig(c, 0.10, 0.94, 2.30, accent, muted, 0.42);
  sprig(c, 0.93, 0.14, 1.70, accent, muted, 0.30);
  c.vignette(ink, 0.11, 0.62);
  c.grain(0.0028, semilla);
  return c.toPng();
}

function mezcla(hexA, hexB, t) {
  const a = hexA.replace('#', '').match(/../g).map((v) => parseInt(v, 16));
  const b = hexB.replace('#', '').match(/../g).map((v) => parseInt(v, 16));
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const PLANTILLAS = [
  {
    ejemplo: 'boda-clasica-1.0.0',
    slug: 'boda-clasica',
    version: '1.0.0',
    motivo: 'sprig',
    assets: [
      { nombre: 'preview.png', hacer: (p) => preview(p, 'sprig') },
      { nombre: 'rsvp-bg.png', hacer: (p) => background(p, 4703) },
    ],
    previewImage: 'assets/preview.png',
  },
  {
    ejemplo: 'xv-jardin-1.0.0',
    slug: 'xv-jardin',
    version: '1.0.0',
    motivo: 'wreath',
    assets: [{ nombre: 'preview.png', hacer: (p) => preview(p, 'wreath') }],
    previewImage: 'assets/preview.png',
  },
];

// ---------------------------------------------------------------------------------------- ejecución

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
let deriva = 0;

function escribir(destino, contenido) {
  const nuevo = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, 'utf8');
  const igual = fs.existsSync(destino) && Buffer.compare(fs.readFileSync(destino), nuevo) === 0;
  if (SOLO_COMPROBAR) {
    if (!igual) {
      console.error(`DERIVA: ${path.relative(RAIZ, destino)}`);
      deriva++;
    }
    return;
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, nuevo);
}

for (const t of PLANTILLAS) {
  const origen = path.join(EJEMPLOS, t.ejemplo);
  const dir = path.join(DESTINO, t.slug, t.version);
  const theme = JSON.parse(fs.readFileSync(path.join(origen, 'theme.json'), 'utf8'));
  const paletaId = theme.defaultPaletteId;
  const paleta = theme.palettes.find((p) => p.id === paletaId).tokens;

  console.log(`\n== ${t.slug}@${t.version} — paleta "${paletaId}" (${paleta.bg} / ${paleta.accent}) ==`);

  const entradas = [];
  for (const a of t.assets) {
    const bytes = a.hacer(paleta);
    escribir(path.join(dir, 'assets', a.nombre), bytes);
    entradas.push({
      path: `assets/${a.nombre}`,
      sha256: sha256(bytes),
      contentType: 'image/png',
      bytes: bytes.length,
    });
    console.log(`   assets/${a.nombre.padEnd(14)} ${String(bytes.length).padStart(8)} B  sha256:${sha256(bytes)}`);
  }

  const manifiesto = JSON.parse(fs.readFileSync(path.join(origen, 'template.json'), 'utf8'));
  manifiesto.previewImage = t.previewImage;
  manifiesto.assets = entradas;
  escribir(path.join(dir, 'template.json'), JSON.stringify(manifiesto, null, 2) + '\n');
  escribir(path.join(dir, 'theme.json'), JSON.stringify(theme, null, 2) + '\n');
  const defaults = JSON.parse(fs.readFileSync(path.join(origen, 'defaults.json'), 'utf8'));
  escribir(path.join(dir, 'defaults.json'), JSON.stringify(defaults, null, 2) + '\n');
  console.log(`   template.json / theme.json / defaults.json  →  ${path.relative(RAIZ, dir)}`);
  if ((manifiesto.migrationsFrom ?? []).length > 0) {
    console.error(`   AVISO: migrationsFrom no vacío; falta copiar migrations/ (01 §2.1)`);
  }
}

if (SOLO_COMPROBAR && deriva > 0) {
  console.error(`\n${deriva} archivo(s) con deriva: vuelve a ejecutar sin --check.`);
  process.exit(1);
}
console.log(SOLO_COMPROBAR ? '\nSin deriva.' : '\nPaquetes construidos.');
