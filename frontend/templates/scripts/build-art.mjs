// frontend/templates/scripts/build-art.mjs
//
// Genera TODA la imaginería de las dos plantillas. Determinista y reproducible: dos ejecuciones
// producen byte a byte los mismos archivos (`--check` falla si hay deriva), que es lo que hace que
// volver a registrar el mismo paquete sea el `200 {result:"noop_same_hash"}` de ADR-008 y no una
// versión nueva.
//
//   npm --prefix frontend/templates install        (una vez: @resvg/resvg-js, sharp, tipografías)
//   node frontend/templates/scripts/build-art.mjs            genera
//   node frontend/templates/scripts/build-art.mjs --check    no escribe; sale 1 si hay deriva
//
// Dónde cae cada cosa, y por qué:
//   · `<slug>/1.0.0/assets/`  ASSETS DEL PAQUETE. Van dentro del `package_hash`, los sube el
//     registro (`POST /master/templates2/versions`) y los sirve el backend. Aquí SÓLO lo que la
//     plantilla declara en su manifiesto: `preview.webp`, `rsvp-bg.webp`, `divider.webp`. Un
//     archivo de más en esta carpeta hace fallar el registro con `TPL_PACKAGE_UNEXPECTED_FILE`.
//   · `<slug>/demo/<paletteId>/`  ASSETS DE LA INVITACIÓN DE DEMOSTRACIÓN, UN JUEGO POR PALETA
//     (A6 del bloque 3-9; antes había uno solo, tintado con la paleta por defecto). NO entran en
//     el paquete: los sube `scripts/seed-demo.sh` por `POST /editor/invitations/{id}/assets`
//     (cuerpo binario crudo), que es el único camino por el que una imagen llega a ser
//     referenciable desde el documento (ver el diagnóstico de `bitacora/3-2d.md §5`). El sembrador
//     escoge la carpeta que casa con la paleta que aplica (`TPL_DEMO_PALETTE`).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rasterizar, aWebp, contrasteEnZona, escribir, Inventario, sha256 } from './art/render.mjs';
import { r2, ratio } from './art/color.mjs';
import { themeAA, PAREJAS, pigmentoArte } from './art/paleta-aa.mjs';
import * as E from './art/scenes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.resolve(AQUI, '..');
const RAIZ = path.resolve(TEMPLATES, '../..');
const EJEMPLOS = path.join(RAIZ, 'docs/rediseno-plantillas/diseno/ejemplos');
const SOLO_COMPROBAR = process.argv.includes('--check');

/** Lee el `theme.json` real de la plantilla, con la corrección de contraste ya aplicada. */
function temaDe(slug) {
  // Se lee el theme.json del ORIGEN y se le aplica la misma corrección de contraste que le aplica
  // `build-packages.mjs` (ADR-3-2d-04). Si el arte se pintara con los colores sin corregir, la lámina
  // y el tema del paquete dirían cosas distintas.
  return themeAA(slug, JSON.parse(fs.readFileSync(path.join(EJEMPLOS, `${slug}-1.0.0/theme.json`), 'utf8')), true);
}

/**
 * Los colores con los que se PINTA una paleta concreta.
 *
 * A6 del bloque 3-9 (objeción ALTA de `3-CV`, captura `O-07`) — EL SISTEMA PROMETÍA TRES PALETAS Y
 * SERVÍA UNA. Esta función leía sólo `theme.defaultPaletteId`, así que el generador producía UN
 * paquete de arte por plantilla, tintado con la paleta por defecto. Con `navy` elegida en el
 * editor, la invitación quedaba con trece imágenes ROSAS sobre un fondo azul frío. Ahora recibe la
 * paleta y `build-art.mjs` recorre TODAS las de cada `theme.json`.
 *
 * `pigmentoArte` sustituye SÓLO lo que se usa como tinte (hoy `accent` y `muted`, ver
 * `art/paleta-aa.mjs`): esos tokens los gobierna WCAG 1.4.3 para el TEXTO de las secciones, no la
 * legibilidad de la tinta encima del dibujo (ADR-3-3b-04). `theme` sale intacto: es el que se
 * comprueba y el que se publica.
 */
function paletaDe(slug, theme, paletaId) {
  const pal = theme.palettes.find((p) => p.id === paletaId);
  if (!pal) throw new Error(`${slug}: la paleta "${paletaId}" no existe en palettes[]`);
  return { id: pal.id, ...pigmentoArte(slug, pal.id, pal.tokens), theme };
}

const PLANTILLAS = [
  {
    slug: 'boda-clasica', familia: 'boda',
    // `floral` no es un token del tema: es un color derivado del acento, para las flores de XV.
    // En `boda-clasica` no hay flores rellenas, así que no se usa.
    muestra: { titulo: 'Ana & Diego', subtitulo: 'NUESTRA BODA', fecha: '18 · IV · 2027', lugar: 'Hacienda de San Gabriel · Morelos' },
    inicialA: 'D', inicialB: 'A',
  },
  {
    slug: 'xv-jardin', familia: 'xv',
    muestra: { titulo: 'Renata', subtitulo: 'MIS XV AÑOS', fecha: '09 · X · 2027', lugar: 'Jardín Los Fresnos · Puebla' },
    inicialA: 'R', inicialB: 'R',
  },
];

/**
 * Todas las piezas de una plantilla PARA UNA PALETA, con su destino, calidad WebP y presupuesto.
 *
 * A6 — DÓNDE CAE CADA COSA, Y POR QUÉ SÓLO EL ARTE DE DEMOSTRACIÓN ES POR PALETA:
 *
 *   · `<slug>/1.0.0/assets/` son ASSETS DEL PAQUETE: entran en el `package_hash`, el manifiesto
 *     declara EXACTAMENTE esas tres rutas y el registro rechaza cualquier archivo de más con
 *     `TPL_PACKAGE_UNEXPECTED_FILE` (`02 §4`). Un paquete es UNA versión de plantilla con UN juego
 *     de assets: meter tres variantes de cada uno exige cambiar el manifiesto, que es contrato de
 *     la fase 2. Se siguen generando con la paleta POR DEFECTO, que es además lo correcto para
 *     `preview.webp`: la miniatura del catálogo enseña la plantilla en su paleta de origen, antes
 *     de que el cliente elija ninguna.
 *   · `<slug>/demo/<paletteId>/` son los ASSETS DE LA INVITACIÓN DE DEMOSTRACIÓN, que se suben por
 *     `POST /editor/invitations/{id}/assets` (`scripts/seed-demo.sh`). Ahí no hay manifiesto que
 *     limite nada, así que se genera un juego por paleta y el sembrador escoge el que casa con la
 *     paleta que aplica. Son las TRECE imágenes que 3-CV vio rosas sobre un fondo azul (`O-07`).
 */
function piezas(t, p) {
  const A = (nombre) => path.join(TEMPLATES, t.slug, '1.0.0/assets', nombre);
  const D = (nombre) => path.join(TEMPLATES, t.slug, 'demo', p.id, nombre);
  const l = [];
  if (p.id === p.theme.defaultPaletteId) {
    l.push(
      { destino: A('preview.webp'), escena: () => E.miniatura(p, t.familia, t.muestra), q: 86, limite: 250 },
      { destino: A('rsvp-bg.webp'), escena: () => E.fondoRsvp(p, t.familia), q: 82, limite: 250 },
      { destino: A('divider.webp'), escena: () => E.separador(p, t.familia), q: 84, limite: 120 },
    );
  }
  l.push(
    // A1 del bloque 3-9 — LA PORTADA ES EL ELEMENTO LCP, Y PESABA 147 KB.
    // Con la portada convertida en papeleta (`CoverSection`, variante `full`), la lámina pasa a ser
    // el elemento más grande de la primera pantalla y por tanto el candidato a LCP. Medido [V] con
    // `@lhci/cli` (`throttlingMethod: devtools`, móvil, 4G real, 5 corridas) sobre la invitación
    // publicada: a 1600 px y 147 KB, la imagen empezaba a los 604 ms y terminaba a los 3 828 ms, y
    // el LCP salía **3 858 ms** contra un tope de 2 500 (`contratos §8`).
    // La lámina se DIBUJA a 1600 px porque a menos resolución el rasterizador estropea el trazo
    // fino del filete y de las hojas; se SIRVE a 1200, que es lo que de verdad hace falta: el hueco
    // mide 412×577 CSS en un teléfono y 643×900 en escritorio, así que 1200 px de ancho siguen
    // dando ~2,9× de densidad en móvil y ~1,9× en escritorio. Dibujar y servir no tienen por qué
    // ser la misma medida.
    { destino: D('cover.webp'), escena: () => E.portada(p, t.familia), q: 82, ancho: 1200, limite: 420 },
    { destino: D('portrait-a.webp'), escena: () => E.retrato(p, t.familia, { inicial: t.inicialA, variante: 'a' }), q: 84, limite: 250 },
    { destino: D('portrait-b.webp'), escena: () => E.retrato(p, t.familia, { inicial: t.inicialB, variante: 'b' }), q: 84, limite: 250 },
  );
  for (let i = 0; i < 6; i++) l.push({ destino: D(`gallery-${i + 1}.webp`), escena: () => E.galeria(p, t.familia, i), q: 82, limite: 250 });
  if (t.familia === 'boda') {
    l.push({ destino: D('story-1.webp'), escena: () => E.relato(p, t.familia, 0), q: 82, limite: 250 });
    l.push({ destino: D('story-2.webp'), escena: () => E.relato(p, t.familia, 1), q: 82, limite: 250 });
    l.push({ destino: D('dress-a.webp'), escena: () => E.vestimenta(p, t.familia, 'a'), q: 82, limite: 250 });
    l.push({ destino: D('dress-b.webp'), escena: () => E.vestimenta(p, t.familia, 'b'), q: 82, limite: 250 });
  }
  return l;
}

// --------------------------------------------------------------------------------------- ejecución

let deriva = 0, fallosAA = 0;
/**
 * Fallos de contraste de la PALETA (no del arte). Se informan a gritos pero NO rompen esta
 * ejecución: `theme.json` sale de `diseno/ejemplos/`, que es contrato de la fase 1 y no es mío.
 * Es exactamente lo que `I-31_PALETTE_CONTRAST_BELOW_AA` rechazará en el registro cuando el
 * orquestador acepte ADR-1R-F-06 (`04 §17.1`), así que conviene verlo ahora.
 */
const paletaMala = [];

for (const t of PLANTILLAS) {
  const theme = temaDe(t.slug);
  console.log(`\n== ${t.slug}@1.0.0 — ${theme.palettes.length} paleta(s), por defecto "${theme.defaultPaletteId}" ==`);

  // Contraste de la PALETA (las cinco parejas de `04 §17.1`). Es la comprobación que I-31 hará en
  // el registro cuando el orquestador acepte ADR-1R-F-06; aquí se deja a la vista desde ya.
  for (const pal of theme.palettes) {
    const k = pal.tokens;
    const linea = PAREJAS.map(([n2, ta, tb, u]) => {
      const r = ratio(k[ta], k[tb]);
      if (r < u) paletaMala.push({ slug: t.slug, paleta: pal.id, pareja: n2, a: k[ta], b: k[tb], ratio: r, umbral: u });
      return `${n2} ${r2(r).toFixed(2)}:1 ${r >= u ? 'OK' : 'FALLA'}`;
    }).join(' · ');
    console.log(`   paleta "${pal.id}"${pal.id === theme.defaultPaletteId ? ' (por defecto)' : ''}: ` + linea);
  }

  // A6 — UNA PASADA POR PALETA. `paletaDe` leía sólo `defaultPaletteId` y por eso el arte sólo
  // estaba afinado en una combinación: con `navy`, trece imágenes rosas sobre un fondo azul frío
  // (`O-07` de 3-CV). Las zonas de texto del arte se miden en TODAS, no sólo en la de por defecto:
  // el `process.exit(1)` de abajo protege ahora las cinco.
  for (const pal of theme.palettes) {
    const p = paletaDe(t.slug, theme, pal.id);
    console.log(`\n-- paleta "${p.id}" (bg ${p.bg} · superficie ${p.surface} · tinta ${p.ink} · acento ${p.accent} · apagado ${p.muted}) --`);

    const inv = new Inventario(RAIZ);
    const P = { ...p, floral: t.familia === 'xv' ? '#E7C7DE' : undefined };

    for (const pieza of piezas(t, P)) {
      const escena = pieza.escena();
      const png = rasterizar(escena.svg, escena.w);
      const webp = await aWebp(png, pieza.q, pieza.ancho);
      const igual = escribir(pieza.destino, webp, SOLO_COMPROBAR);
      if (SOLO_COMPROBAR && !igual) { console.error(`   DERIVA: ${path.relative(RAIZ, pieza.destino)}`); deriva++; }

      let contraste = null;
      if (escena.zonas.length > 0) {
        const pngMedida = escena.svgMedida ? rasterizar(escena.svgMedida, escena.w) : png;
        contraste = [];
        for (const z of escena.zonas) {
          const m = await contrasteEnZona(pngMedida, P.ink, z.rect);
          if (m.minimo < z.umbral) fallosAA++;
          contraste.push({ nombre: z.nombre, minimo: m.minimo, media: m.media, umbral: z.umbral, peorPx: m.peorPx });
        }
      }
      // El inventario declara la medida SERVIDA, no la dibujada: desde A1 de 3-9 la portada se
      // remuestrea antes de codificar y las dos dejaron de coincidir (ver `piezas()`).
      inv.add({
        ruta: path.relative(path.join(TEMPLATES, t.slug), pieza.destino),
        w: pieza.ancho ?? escena.w,
        h: pieza.ancho ? Math.round((escena.h * pieza.ancho) / escena.w) : escena.h,
        bytes: webp.length, sha256: sha256(webp), contraste,
      });
      if (webp.length > pieza.limite * 1024) inv.aviso(`${path.basename(pieza.destino)} pesa ${(webp.length / 1024).toFixed(1)} KB (presupuesto declarado ${pieza.limite} KB)`);
    }
    inv.imprimir(250);
    for (const f of inv.fallosDeContraste()) {
      console.error(`   FALLA AA: ${f.ruta} zona "${f.nombre}" ${r2(f.minimo).toFixed(2)}:1 < ${f.umbral}:1 ` +
        `(peor píxel ${f.peorPx.x},${f.peorPx.y} rgb ${f.peorPx.rgb.join(',')})`);
    }
  }
}

if (paletaMala.length > 0) {
  console.error(`\n  !! ${paletaMala.length} pareja(s) de token POR DEBAJO de WCAG 2.2 AA en los theme.json.`);
  console.error('     NO es un defecto del arte: son los colores del contrato (`diseno/ejemplos/*/theme.json`),');
  console.error('     y este generador no los toca. Es lo que I-31 (ADR-1R-F-06) rechazará en el registro.');
  console.error('     Ver `preguntas-abiertas.md` (pregunta ALTA de 3-2d) y ADR-3-2d-04.');
  for (const f of paletaMala) {
    console.error(`     ${f.slug}/${f.paleta} ${f.pareja}: ${f.a} sobre ${f.b} = ${r2(f.ratio).toFixed(2)}:1 (exige ${f.umbral}:1)`);
  }
}
if (SOLO_COMPROBAR && deriva > 0) { console.error(`\n${deriva} archivo(s) con deriva.`); process.exit(1); }
if (fallosAA > 0) { console.error(`\n${fallosAA} zona(s) de texto del ARTE por debajo del umbral: corrige el arte, no el umbral.`); process.exit(1); }
console.log(SOLO_COMPROBAR ? '\nSin deriva. Contraste AA en todas las zonas de texto del arte.' : '\nImaginería generada. Contraste AA en todas las zonas de texto del arte.');
