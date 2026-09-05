// frontend/templates/scripts/art/render.mjs
//
// Tubería SVG → PNG → WebP y sus dos controles de calidad: el inventario (dimensiones y peso de
// cada archivo) y el contraste WCAG 2.2 AA medido SOBRE LOS PÍXELES REALES de la imagen, no sobre
// una intención.
//
// Por qué esta tubería y no otra: en este entorno no hay acceso a bancos de imágenes (Unsplash,
// Wikimedia y picsum devuelven 000 tras el proxy; medido por el orquestador de la fase 3), así que
// toda la imaginería se genera. `@resvg/resvg-js` rasteriza el SVG autoral con las tipografías
// reales de cada `theme.json`, y `sharp` lo lleva a WebP, que es uno de los tres tipos de imagen
// que acepta `POST …/assets` (`handoffs/2-5.md`; el SVG se RECHAZA a propósito, ADR-2-5-04).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { luminancia, ratio, r2 } from './color.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const TEMPLATES = path.resolve(AQUI, '../..');
const FUENTES = path.join(TEMPLATES, 'node_modules/@expo-google-fonts');

/**
 * Tipografías reales de los `fontSets` de `theme.json`, en TTF (resvg no lee woff2). Vienen de
 * `@expo-google-fonts/*`, que empaqueta los mismos archivos de Google Fonts bajo OFL-1.1. Solo se
 * usan para RASTERIZAR el arte: ningún archivo de fuente entra en el paquete de plantilla.
 */
export const FUENTES_TTF = [
  'cormorant-garamond/300Light/CormorantGaramond_300Light.ttf',
  'cormorant-garamond/400Regular/CormorantGaramond_400Regular.ttf',
  'cormorant-garamond/400Regular_Italic/CormorantGaramond_400Regular_Italic.ttf',
  'cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf',
  'playfair-display/400Regular/PlayfairDisplay_400Regular.ttf',
  'playfair-display/400Regular_Italic/PlayfairDisplay_400Regular_Italic.ttf',
  'playfair-display/700Bold/PlayfairDisplay_700Bold.ttf',
].map((f) => path.join(FUENTES, f));

for (const f of FUENTES_TTF) {
  if (!fs.existsSync(f)) {
    throw new Error(
      `falta la tipografía ${path.relative(TEMPLATES, f)}.\n` +
        `Ejecuta:  npm install --prefix frontend/templates`,
    );
  }
}

/** SVG → PNG con resvg. `loadSystemFonts:false` es lo que hace el resultado reproducible. */
export function rasterizar(svg, ancho) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: ancho },
    font: { loadSystemFonts: false, fontFiles: FUENTES_TTF, defaultFontFamily: 'Cormorant Garamond' },
    shapeRendering: 2,
    textRendering: 1,
    imageRendering: 0,
  });
  return r.render().asPng();
}

/** PNG → WebP con `sharp`. `effort: 6` y calidad fija: mismos bytes en cada ejecución. */
/**
 * PNG → WebP. `ancho` (opcional) REMUESTREA antes de codificar: una lámina se dibuja a la
 * resolución que hace falta para rasterizar bien el trazo, no a la que hace falta para servirla.
 * Lo añadió 3-9 al medir el LCP de la portada — ver el comentario de `piezas()` en `build-art.mjs`.
 */
export const aWebp = (png, calidad, ancho) =>
  (ancho ? sharp(png).resize({ width: ancho }) : sharp(png))
    .webp({ quality: calidad, effort: 6, smartSubsample: true })
    .toBuffer();

/**
 * Contraste real: ratio WCAG 2.x mínimo entre `tinta` y CADA píxel de la zona.
 * Se toma el mínimo, no la media: el texto puede caer en cualquier punto de la zona y `04 §17.1`
 * no admite "en promedio pasa". Las zonas van en fracciones del lienzo `[x0, y0, x1, y1]`.
 */
export async function contrasteEnZona(png, tinta, zona) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const x0 = Math.max(0, Math.floor(zona[0] * W)), x1 = Math.min(W, Math.ceil(zona[2] * W));
  const y0 = Math.max(0, Math.floor(zona[1] * H)), y1 = Math.min(H, Math.ceil(zona[3] * H));
  let peor = Infinity, peorPx = null, suma = 0, cuenta = 0;
  const Lt = luminancia(tinta);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * C;
      const px = [data[i], data[i + 1], data[i + 2]];
      const Lp = luminancia(px);
      const rr = (Math.max(Lt, Lp) + 0.05) / (Math.min(Lt, Lp) + 0.05);
      suma += rr; cuenta++;
      if (rr < peor) { peor = rr; peorPx = { x, y, rgb: px }; }
    }
  }
  return { minimo: peor, media: suma / cuenta, peorPx, pixeles: cuenta };
}

/** Ratio entre dos colores planos (para las parejas de la paleta). */
export const contrasteDeTokens = ratio;

// ------------------------------------------------------------------------------------- inventario

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const KB = (b) => (b / 1024).toFixed(1) + ' KB';

/**
 * Escribe un archivo sólo si su contenido cambia; en modo `--check` no escribe y acusa la deriva.
 * Devuelve `true` si el archivo en disco ya era idéntico.
 */
export function escribir(destino, bytes, soloComprobar) {
  const igual = fs.existsSync(destino) && Buffer.compare(fs.readFileSync(destino), bytes) === 0;
  if (soloComprobar) return igual;
  if (!igual) {
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, bytes);
  }
  return igual;
}

/** Acumula el inventario y lo imprime como tabla al cerrar. */
export class Inventario {
  constructor(raiz) { this.raiz = raiz; this.filas = []; this.avisos = []; }

  add(fila) { this.filas.push(fila); }
  aviso(t) { this.avisos.push(t); }

  imprimir(limiteKB = 250) {
    const anchoRuta = Math.max(24, ...this.filas.map((f) => f.ruta.length));
    console.log('');
    console.log('  ' + 'archivo'.padEnd(anchoRuta) + '  ' + 'px'.padEnd(11) + '  ' + 'WebP'.padStart(9) + '   contraste (zona de texto)');
    console.log('  ' + '-'.repeat(anchoRuta + 2 + 11 + 2 + 9 + 3 + 34));
    let total = 0, gordos = 0;
    for (const f of this.filas) {
      total += f.bytes;
      const marca = f.bytes > limiteKB * 1024 ? ' *' : '';
      if (marca) gordos++;
      const c = f.contraste
        ? f.contraste.map((z) => `${z.nombre} ${r2(z.minimo).toFixed(2)}:1 ${z.minimo >= z.umbral ? 'AA' : 'FALLA'}`).join('  ')
        : '—';
      console.log(
        '  ' + f.ruta.padEnd(anchoRuta) + '  ' + `${f.w}x${f.h}`.padEnd(11) + '  ' + (KB(f.bytes) + marca).padStart(9) + '   ' + c,
      );
    }
    console.log('  ' + '-'.repeat(anchoRuta + 2 + 11 + 2 + 9 + 3 + 34));
    console.log(`  ${this.filas.length} imágenes · ${KB(total)} en total` + (gordos ? `  (* ${gordos} por encima de ${limiteKB} KB, declarado a propósito)` : ''));
    for (const a of this.avisos) console.log('  AVISO: ' + a);
  }

  fallosDeContraste() {
    return this.filas.flatMap((f) => (f.contraste ?? []).filter((z) => z.minimo < z.umbral).map((z) => ({ ruta: f.ruta, ...z })));
  }
}
