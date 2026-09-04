// frontend/templates/scripts/build-contact-sheet.mjs
//
// Contacto de hoja: una rejilla de 1440×900 con TODAS las imágenes de una plantilla, cada una
// etiquetada con su nombre, sus dimensiones y su peso. Es la lámina que el orquestador le envía al
// dueño, así que se compone con la tipografía y la paleta de la propia plantilla.
//
//   node frontend/templates/scripts/build-contact-sheet.mjs
//
// Sale en `docs/rediseno-plantillas/evidencia/fase-3/arte/<slug>-contacto.png`.
// PNG y no WebP a propósito: es evidencia para mirar y adjuntar, no un asset servido a un navegador.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { rasterizar } from './art/render.mjs';
import { doc, linearGradient, radialGradient, textLine, rule, esc, num as n } from './art/svg.mjs';
import { mix, lighten, ratio, r2 } from './art/color.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.resolve(AQUI, '..');
const RAIZ = path.resolve(TEMPLATES, '../..');
const SALIDA = path.join(RAIZ, 'docs/rediseno-plantillas/evidencia/fase-3/arte');

const W = 1440, H = 900;
const MARGEN = 34, CABECERA = 96, HUECO = 14, ETIQUETA = 34;

const PLANTILLAS = [
  { slug: 'boda-clasica', heading: 'Cormorant Garamond', titulo: 'Boda clásica · boda-clasica@1.0.0',
    lema: 'Papelería grabada · botánica de contorno · simetría axial · marco de doble filete' },
  { slug: 'xv-jardin', heading: 'Playfair Display', titulo: 'XV Jardín · xv-jardin@1.0.0',
    lema: 'Jardín de acuarela · masas de color · guirnaldas asimétricas · arco ojival y celosía' },
];

const KB = (b) => (b / 1024).toFixed(0) + ' KB';

/** Todas las imágenes de la plantilla: primero las del paquete, luego las de la demostración. */
function inventario(slug) {
  const l = [];
  for (const [dir, prefijo] of [[path.join(TEMPLATES, slug, '1.0.0/assets'), 'paquete'], [path.join(TEMPLATES, slug, 'demo'), 'demo']]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith('.webp')) continue;
      l.push({ ruta: path.join(dir, f), nombre: f, grupo: prefijo, bytes: fs.statSync(path.join(dir, f)).size });
    }
  }
  return l;
}

/** Elige el número de columnas que da la celda más grande sin salirse del alto. */
function rejilla(cuenta) {
  let mejor = null;
  for (const cols of [4, 5, 6, 7]) {
    const filas = Math.ceil(cuenta / cols);
    const cw = (W - MARGEN * 2 - HUECO * (cols - 1)) / cols;
    const disp = (H - CABECERA - MARGEN - HUECO * (filas - 1)) / filas;
    const ch = disp - ETIQUETA;
    if (ch < 70) continue;
    const area = Math.min(cw, ch * 0.8) * ch;
    if (!mejor || area > mejor.area) mejor = { cols, filas, cw, ch, area };
  }
  return mejor;
}

for (const t of PLANTILLAS) {
  const theme = JSON.parse(fs.readFileSync(path.join(TEMPLATES, t.slug, '1.0.0/theme.json'), 'utf8'));
  const p = theme.palettes.find((x) => x.id === theme.defaultPaletteId).tokens;
  const items = inventario(t.slug);
  const g = rejilla(items.length);
  if (!g) throw new Error(`${t.slug}: no cabe una rejilla legible para ${items.length} imágenes`);

  const total = items.reduce((s, i) => s + i.bytes, 0);
  const metas = await Promise.all(items.map((i) => sharp(i.ruta).metadata()));

  // --- capa de fondo, cabecera, marcos y etiquetas (SVG → PNG) ---------------------------------
  const defs =
    linearGradient('gH', 0, 0, 0, 1, [[0, '#FFFFFF'], [0.55, lighten(p.bg, 0.5)], [1, mix(p.bg, p.accent, 0.10)]]) +
    radialGradient('gV', 0.5, 0.0, 0.9, [[0, '#FFFFFF', 0.9], [1, '#FFFFFF', 0]]);
  let b = `<rect width="${W}" height="${H}" fill="url(#gH)"/><rect width="${W}" height="${H}" fill="url(#gV)"/>`;
  b += textLine(MARGEN, 46, t.titulo, { familia: t.heading, tam: 34, color: p.ink, op: 0.94, anchor: 'start' });
  b += textLine(MARGEN, 72, t.lema, { familia: t.heading, tam: 18, color: p.ink, op: 0.62, anchor: 'start', italic: true });
  const resumen = `${items.length} imágenes · ${KB(total)} en WebP · paleta "${theme.defaultPaletteId}" ` +
    `(${p.bg} · ${p.accent} · ${p.ink}) · generadas por frontend/templates/scripts/build-art.mjs`;
  b += textLine(W - MARGEN, 46, resumen, { familia: t.heading, tam: 15.5, color: p.ink, op: 0.72, anchor: 'end' });
  b += textLine(W - MARGEN, 70, `contraste ink/bg ${r2(ratio(p.ink, p.bg)).toFixed(2)}:1 · ink/surface ${r2(ratio(p.ink, p.surface)).toFixed(2)}:1 (WCAG 2.2 AA exige 4.5:1)`,
    { familia: t.heading, tam: 15.5, color: p.ink, op: 0.55, anchor: 'end' });
  b += `<line x1="${MARGEN}" y1="84" x2="${W - MARGEN}" y2="84" stroke="${p.muted}" stroke-opacity="0.5" stroke-width="1"/>`;

  const celdas = [];
  items.forEach((it, k) => {
    const c = k % g.cols, f = Math.floor(k / g.cols);
    const x = MARGEN + c * (g.cw + HUECO);
    const y = CABECERA + f * (g.ch + ETIQUETA + HUECO);
    celdas.push({ x, y, w: g.cw, h: g.ch, it, meta: metas[k] });
    b += `<rect x="${n(x)}" y="${n(y)}" width="${n(g.cw)}" height="${n(g.ch)}" fill="#FFFFFF" fill-opacity="0.55" stroke="${p.muted}" stroke-opacity="0.35" stroke-width="1"/>`;
    // Marca de "asset del paquete": un cuadradito dibujado, no un glifo. Las tipografías de las
    // plantillas no tienen U+25AA y resvg pinta un tofu.
    const sangria = it.grupo === 'paquete' ? 13 : 0;
    if (sangria) b += `<rect x="${n(x + 1)}" y="${n(y + g.ch + 7)}" width="8" height="8" fill="${p.accent}" fill-opacity="0.85"/>`;
    b += textLine(x + 1 + sangria, y + g.ch + 16, it.nombre, { familia: t.heading, tam: 14.5, color: p.ink, op: 0.9, anchor: 'start' });
    b += textLine(x + g.cw - 1, y + g.ch + 16, KB(it.bytes), { familia: t.heading, tam: 14.5, color: p.ink, op: 0.72, anchor: 'end' });
    b += textLine(x + 1, y + g.ch + 30, `${metas[k].width}×${metas[k].height}`, { familia: t.heading, tam: 12.5, color: p.ink, op: 0.5, anchor: 'start' });
  });
  b += `<rect x="${MARGEN}" y="${H - 20}" width="9" height="9" fill="${p.accent}" fill-opacity="0.85"/>`;
  b += textLine(MARGEN + 15, H - 11, '= asset del paquete de plantilla (viaja en el package_hash);   sin marca = asset de la invitación de demostración, subido por POST …/assets',
    { familia: t.heading, tam: 13.5, color: p.ink, op: 0.6, anchor: 'start' });

  const fondo = rasterizar(doc(W, H, defs, b), W);

  // --- composición de las miniaturas -----------------------------------------------------------
  const capas = [];
  for (const c of celdas) {
    const dw = Math.max(1, Math.round(c.w - 8)), dh = Math.max(1, Math.round(c.h - 8));
    const mini = await sharp(c.it.ruta)
      .resize({ width: dw, height: dh, fit: 'inside', withoutEnlargement: false })
      .png().toBuffer();
    const m = await sharp(mini).metadata();
    capas.push({
      input: mini,
      left: Math.round(c.x + (c.w - m.width) / 2),
      top: Math.round(c.y + (c.h - m.height) / 2),
    });
  }
  const destino = path.join(SALIDA, `${t.slug}-contacto.png`);
  fs.mkdirSync(SALIDA, { recursive: true });
  await sharp(fondo).composite(capas).png({ compressionLevel: 9 }).toFile(destino);
  const bytes = fs.statSync(destino).size;
  console.log(`${path.relative(RAIZ, destino)}  ${W}×${H}  ${KB(bytes)}  ${items.length} imágenes en rejilla ${g.cols}×${g.filas}`);
}
void esc;
