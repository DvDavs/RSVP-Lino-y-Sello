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
export const PALETA_AA = {
  'boda-clasica': {
    // accentInk/accent 2.78 → 4.60 · accent/bg 2.62 → 4.33 (matiz 0°, saturación 36 %, sin cambios)
    blush: { accent: '#B35B5B' },
    // muted/bg 3.00 → 3.08: pasaba justo en el umbral, sin margen para un redondeo
    olive: { muted: '#888F76' },
  },
  'xv-jardin': {
    // accentInk/accent 2.89 → 4.59 · accent/bg 2.74 → 4.34 · muted/bg 2.54 → 3.10
    garden: { accent: '#607E47', muted: '#7D956E' },
    // accentInk/accent 3.39 → 4.62 · accent/bg 3.16 → 4.30 · muted/bg 2.52 → 3.08
    lilac: { accent: '#8765B3', muted: '#9886AC' },
  },
};

/** Las cinco parejas de `04 §17.1`, con su umbral. */
export const PAREJAS = [
  ['ink/bg', 'ink', 'bg', 4.5], ['ink/surface', 'ink', 'surface', 4.5],
  ['accentInk/accent', 'accentInk', 'accent', 4.5], ['muted/bg', 'muted', 'bg', 3.0],
  ['accent/bg', 'accent', 'bg', 3.0],
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

