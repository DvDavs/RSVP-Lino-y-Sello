// frontend/templates/scripts/art/paleta-aa.mjs
//
// Corrección y comprobación de contraste de las paletas de `theme.json`. Vive aparte porque la usan
// los DOS generadores: `build-art.mjs` (que pinta con los colores corregidos) y `build-packages.mjs`
// (que los cose al paquete registrable). Si sólo la aplicara uno, el arte y el tema del paquete
// dirían cosas distintas.

import { ratio, r2 } from './color.mjs';

/**
 * CORRECCIÓN DE PALETA POR WCAG 2.2 AA (ADR-3-2d-04).
 *
 * Las paletas de `diseno/ejemplos/*​/theme.json` incumplen las parejas de `04 §17.1`. Medido con
 * `art/color.mjs` (misma fórmula que `packages/sections/src/theme/contrast.ts` y que su espejo
 * Kotlin) y confirmado de forma independiente por el orquestador de la fase 3:
 *
 *   boda-clasica/blush   accentInk/accent 2.78:1  ·  accent/bg 2.62:1   (exigen 4.5 y 3.0)
 *   boda-clasica/olive   muted/bg 3.00:1                                 (justo en el umbral)
 *   xv-jardin/garden     accentInk/accent 2.89:1  ·  muted/bg 2.54:1  ·  accent/bg 2.74:1
 *   xv-jardin/lilac      accentInk/accent 3.39:1  ·  muted/bg 2.52:1
 *
 * `I-31_PALETTE_CONTRAST_BELOW_AA` está declarada pero NO implementada (ADR-1R-F-06 sigue
 * "propuesta"), así que hoy nada impide registrar una plantilla que incumpla AA: este gate es el
 * único control. Y `contratos.md §8` exige WCAG 2.2 AA, que es requisito duro, no preferencia.
 *
 * La corrección OSCURECE por la misma rampa de tono y NADA MÁS: se conservan el matiz y la
 * saturación HSL exactos del color original y sólo baja la luminosidad, hasta el valor MÁS CLARO que
 * cumple el umbral con margen (+0.08). Mezclar hacia negro, que fue el primer intento, cumplía igual
 * pero desaturaba — "blush" se volvía un palo de rosa apagado. Con el ajuste en HSL, `blush` sigue
 * siendo rosa (matiz 0°, saturación 36 %), `garden` sigue siendo verde jardín (93°, 28 %) y `lilac`
 * sigue siendo lila (266°, 34 %). `ink`, `bg`, `surface` y `accentInk` no se tocan.
 *
 * Se elige lo que cumple AA aunque el color quede más oscuro que el del boceto original: WCAG 2.2 AA
 * es requisito duro de `contratos.md §8`, no una preferencia estética.
 *
 * Se aplica AQUÍ y no en `diseno/ejemplos/`: ese árbol es contrato de la fase 1 y su `theme.json`
 * está replicado en `frontend/packages/schema/golden/templates/boda-clasica-1.0.0/theme.json`, que
 * es de otro agente y cuyos golden se regeneran, no se editan a mano (ADR-1R-D-09). Propagarlo allí
 * es trabajo del dueño de ese paquete; queda en `preguntas-abiertas.md`.
 */
/**
 * SEGUNDA RONDA — D3 del bloque 3-3b: `muted` en las CINCO paletas.
 *
 * El umbral de `04 §17.1` para `muted/bg` es 3.0 porque está escrito para "texto secundario
 * GRANDE" (≥ 18,66 px en negrita o ≥ 24 px). `packages/sections` no cumple esa premisa: usa
 * `--inv-color-muted` en texto de tamaño normal — `CelebrantSection.module.css` en `.kicker`,
 * `.dateRow` y `.quote`, y `blocks/blocks.module.css` en `.muted`, `.personNote`,
 * `.locationAddress` y `.boolean`. Para ese texto rige **WCAG 1.4.3, que exige 4,5:1**, y las
 * cinco paletas lo incumplían. Medido [V] sobre la invitación publicada real con
 * `@axe-core/playwright`: UNA violación `color-contrast` de impacto `serious`, 4 nodos, todos con
 * `muted` — lo que rompe ADR-024 ("cero violaciones críticas o serias en el render público").
 *
 * Ratios antes → después (fórmula de `04 §17.1`, `art/color.mjs`):
 *
 *   boda-clasica/blush   muted/bg 3.12 → 4.62  ·  muted/surface 3.31 → 4.90
 *   boda-clasica/olive   muted/bg 3.09 → 4.63  ·  muted/surface 3.37 → 5.05
 *   boda-clasica/navy    muted/bg 3.31 → 4.61  ·  muted/surface 3.58 → 4.99
 *   xv-jardin/garden     muted/bg 3.11 → 4.61  ·  muted/surface 3.28 → 4.86
 *   xv-jardin/lilac      muted/bg 3.09 → 4.60  ·  muted/surface 3.31 → 4.94
 *
 * Misma regla que la primera ronda: se conservan matiz y saturación HSL y sólo baja la luminosidad,
 * hasta el valor MÁS CLARO que llega a 4,5:1 contra `bg` Y contra `surface` (los dos fondos sobre
 * los que las secciones pintan `muted`), con el margen justo para que un redondeo no lo tumbe.
 * `#7B6E6B` para `blush` es el valor que propuso el bloque 3-3; los otros cuatro se calcularon con
 * el mismo criterio. Ninguna otra pareja cambia.
 */
export const PALETA_AA = {
  'boda-clasica': {
    // accentInk/accent 2.78 → 4.91 · accent/bg 2.62 → 4.63 (matiz 0°, saturación 36-37 %)
    // muted 3.12 → 4.62 sobre bg y 3.31 → 4.90 sobre surface (matiz 11°, saturación 9 %)
    blush: { accent: '#B05555', muted: '#7B6E6B' },
    // accent/bg 4.22 → 4.65 · accent/surface 4.61 → 5.07 (matiz 80°, saturación 25 %)
    // muted 3.09 → 4.63 sobre bg y 3.37 → 5.05 sobre surface (matiz 75-77°, saturación 10 %)
    olive: { accent: '#657446', muted: '#6C715D' },
    // `navy` ya cumplía en `accent` (8.11 sobre bg): sólo cambia `muted`.
    // muted 3.31 → 4.61 sobre bg y 3.58 → 4.99 sobre surface (matiz 219°, saturación 15 %)
    navy: { muted: '#647087' },
  },
  'xv-jardin': {
    // accentInk/accent 2.89 → 4.90 · accent/bg 2.74 → 4.64 (matiz 92-93°, saturación 28 %)
    // muted 3.11 → 4.61 sobre bg y 3.28 → 4.86 sobre surface (matiz 96-97°, saturación 16 %)
    garden: { accent: '#5D7944', muted: '#647757' },
    // accentInk/accent 3.39 → 4.97 · accent/bg 3.16 → 4.63 (matiz 266°, saturación 34 %)
    // muted 3.09 → 4.60 sobre bg y 3.31 → 4.94 sobre surface (matiz 268°, saturación 19 %)
    lilac: { accent: '#835FB0', muted: '#7D6798' },
  },
};

/**
 * PIGMENTO DEL ARTE — la única costura que D3 abre, y hay que entender por qué existe.
 *
 * `build-art.mjs` pintaba las láminas con la paleta corregida entera, `muted` incluido, para que
 * "el arte y el tema del paquete no digan cosas distintas" (ADR-3-2d-04). Al oscurecer `muted` por
 * WCAG 1.4.3, las hojas botánicas —que se tintan con `muted`— se oscurecieron con él y DOS zonas
 * de texto del arte de `boda-clasica` cayeron por debajo del umbral. Medido [V], salida literal de
 * `node scripts/build-art.mjs`:
 *
 *   FALLA AA: 1.0.0/assets/preview.webp zona "texto"  3.89:1 < 4.5:1 (peor píxel 383,677  rgb 149,138,134)
 *   FALLA AA: demo/cover.webp           zona "título" 4.20:1 < 4.5:1 (peor píxel 1394,261 rgb 166,140,139)
 *
 * Es decir: arreglar el contraste del TEXTO rompía el contraste del ARTE, porque un mismo valor
 * hacía dos trabajos que no tienen nada que ver. `muted` es un token de COLOR DE TEXTO — su valor
 * lo dicta WCAG 1.4.3 contra `bg`/`surface`; el tinte de una hoja decorativa es PIGMENTO — su valor
 * lo dicta la legibilidad de la tinta ENCIMA de él, que 3-2d midió y garantizó zona por zona.
 * Acoplarlos convierte cada corrección de accesibilidad del texto en un repintado del arte.
 *
 * Aquí se separan, y el pigmento se queda EXACTAMENTE en el valor con el que 3-2d midió: las 28
 * imágenes siguen siendo byte a byte las mismas (`build-art.mjs --check` sale sin deriva) y sus
 * zonas seguras conservan las cifras publicadas en `handoffs/3-2d.md §4`. Sólo `theme.json` lleva
 * el `muted` nuevo. Lo que se ve: la línea botánica queda un pelo más clara que el texto apagado,
 * en un dibujo decorativo al 45-72 % de opacidad. Registrado como ADR-3-3b-04.
 */
export const PIGMENTO_ARTE = {
  'boda-clasica': {
    blush: { accent: '#B35B5B', muted: '#9A8A86' },
    olive: { accent: '#6B7B4A', muted: '#888F76' },
    navy: { muted: '#7C889E' },
  },
  'xv-jardin': {
    garden: { accent: '#607E47', muted: '#7D956E' },
    lilac: { accent: '#8765B3', muted: '#9886AC' },
  },
};

/** Devuelve los tokens con los que se PINTA (no los que se publican en `theme.json`). */
export function pigmentoArte(slug, paletaId, tokens) {
  return { ...tokens, ...(PIGMENTO_ARTE[slug]?.[paletaId] ?? {}) };
}

/**
 * Las cinco parejas de `04 §17.1`, con su umbral, MÁS las dos de D3 (bloque 3-3b).
 *
 * Las dos últimas no relajan nada: ENDURECEN. `04 §17.1` sólo mide `muted` contra `bg` y con el
 * umbral de texto grande (3.0); las secciones lo usan en texto normal y también sobre `surface`,
 * así que la compuerta comprobaba menos de lo que el render necesita, y por eso una paleta que la
 * pasaba seguía dando una violación `serious` de `axe` en la invitación publicada. Añadirlas aquí
 * es lo que hace que el defecto no pueda volver: `themeAA` aborta la construcción del paquete si
 * alguna baja del umbral. Propuesto como ADR-3-3b-03 en `memoria/decisiones.md`, para que
 * `04 §17.1` y la invariante `I-31` reservada se enmienden en el mismo sentido.
 */
export const PAREJAS = [
  ['ink/bg', 'ink', 'bg', 4.5], ['ink/surface', 'ink', 'surface', 4.5],
  ['accentInk/accent', 'accentInk', 'accent', 4.5], ['muted/bg', 'muted', 'bg', 3.0],
  ['accent/bg', 'accent', 'bg', 3.0],
  // WCAG 1.4.3 (texto normal) sobre los dos fondos en los que las secciones pintan `muted` y
  // `accent`. `accent` entra por lo mismo que `muted`: `04 §17.1` le pone 3.0 pensándolo como
  // "componente de interfaz" (1.4.11), pero las secciones lo usan como COLOR DE TEXTO —
  // `blocks.module.css .link`, `EventSection` (la hora del itinerario), `GallerySection .hashtag`—
  // y ahí manda 1.4.3. Medido [V] con `@axe-core/playwright` sobre la invitación publicada: 9 nodos
  // `serious` a 4,33:1, todos `accent #B35B5B` sobre `bg #FDF7F5`, en texto de 13 a 20 px.
  ['muted/bg (1.4.3)', 'muted', 'bg', 4.5], ['muted/surface (1.4.3)', 'muted', 'surface', 4.5],
  ['accent/bg (1.4.3)', 'accent', 'bg', 4.5], ['accent/surface (1.4.3)', 'accent', 'surface', 4.5],
];

/** Aplica la corrección y COMPRUEBA. Si algo queda por debajo del umbral, no se construye nada. */
export function themeAA(slug, theme, silencioso = false) {
  let malas = 0;
  for (const pal of theme.palettes) {
    const parche = PALETA_AA[slug]?.[pal.id];
    const antes = { ...pal.tokens };
    if (parche) Object.assign(pal.tokens, parche);
    const linea = PAREJAS.map(([nombre, a, b, umbral]) => {
      const rA = ratio(antes[a], antes[b]);
      const rD = ratio(pal.tokens[a], pal.tokens[b]);
      if (rD < umbral) malas++;
      const cambio = r2(rA).toFixed(2) === r2(rD).toFixed(2) ? r2(rD).toFixed(2) : `${r2(rA).toFixed(2)}→${r2(rD).toFixed(2)}`;
      return `${nombre} ${cambio}${rD >= umbral ? '' : ' FALLA'}`;
    }).join(' · ');
    if (!silencioso) console.log(`   paleta "${pal.id}"${parche ? ` (corregida: ${Object.entries(parche).map(([k, v]) => `${k} ${antes[k]}→${v}`).join(', ')})` : ''}`);
    if (!silencioso) console.log(`      ${linea}`);
  }
  if (malas > 0) {
    console.error(`   ${malas} pareja(s) de token por debajo de WCAG 2.2 AA tras la corrección: revisa PALETA_AA.`);
    process.exit(3);
  }
  return theme;
}

