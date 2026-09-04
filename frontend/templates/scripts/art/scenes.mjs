// frontend/templates/scripts/art/scenes.mjs
//
// Las composiciones. Cada función devuelve `{ svg, w, h, zonas }`, donde `zonas` son las regiones
// sobre las que una sección puede pintar texto y que, por tanto, `build-art.mjs` mide contra
// WCAG 2.2 AA con la tinta (`tokens.ink`) de la plantilla (`04 §17.1`).
//
// Las dos plantillas comparten la tubería y NO comparten el lenguaje visual (ver
// `diseno/arte-plantillas.md`):
//   · boda-clasica → papelería grabada: botánica de CONTORNO, simetría axial, marco de doble
//     filete, volutas de filigrana, arco de medio punto, textura de papel de algodón.
//   · xv-jardin    → jardín de acuarela: MASAS de color, guirnaldas asimétricas en diagonal,
//     peonías y eucalipto rellenos, celosía, arco ojival, sin marco rectangular.

import {
  linearGradient, radialGradient, blurFilter, paperFilter, washFilter, softShadow,
  branch, tendril, leafSolid, leafRound, leafOutline, flower, fillerDots, flourish, rule, doubleFrame,
  archPath, ogeePath, wreath, trellis, textLine, blobPath, doc, prng, mix, lighten, darken, num as n,
} from './svg.mjs';

// ---------------------------------------------------------------------------- fondos compartidos

/**
 * Lavado de acuarela: mancha irregular, desenfocada y con el borde desplazado por ruido.
 * `ESCALA_LAVADO` y `OPACIDAD_LAVADO` corrigen de una vez el defecto de la primera versión — los
 * lavados salían tan grandes y tan opacos que se leían como manchas desenfocadas y se comían la
 * composición. Un lavado tiene que dar COLOR al papel, no ser el motivo.
 */
const ESCALA_LAVADO = 0.62;
const OPACIDAD_LAVADO = 0.62;
const wash = (id, cx, cy, r, color, op, semilla, aplanado = 1) =>
  `<path d="${blobPath(cx, cy, r * ESCALA_LAVADO, { jitter: 0.34, aplanado, semilla })}" fill="${color}" fill-opacity="${(op * OPACIDAD_LAVADO).toFixed(3)}" filter="url(#${id})"/>`;

/** Cuatro lavados menudos repartidos por los bordes: color sin protagonismo. */
function lavadosDeBorde(w, h, p, semilla, fuerza = 1) {
  const rnd = prng(semilla);
  let s = '';
  const puntos = [[0.03, 0.30], [0.97, 0.62], [0.22, 1.02], [0.80, -0.02], [0.99, 0.16], [0.01, 0.80]];
  for (let i = 0; i < puntos.length; i++) {
    const [fx, fy] = puntos[i];
    const c = i % 2 === 0 ? p.accent : mix(p.accent, p.muted, 0.55);
    s += wash('fWash', w * fx, h * fy, w * (0.13 + rnd() * 0.10), c, (0.12 + rnd() * 0.10) * fuerza, 0, 0.9);
  }
  return s;
}

/**
 * Cielo de fondo común: degradado multiparada + tres lavados + resplandor claro donde va el texto.
 * Es lo que evita el "rectángulo de color plano": en ningún punto del lienzo hay dos píxeles
 * contiguos con exactamente el mismo valor.
 */
function fondo(w, h, p, o) {
  const { surface, bg, accent, muted } = p;
  const { direccion = 'v', claroEn = [0.5, 0.30], fuerza = 0.34, semilla = 7 } = o ?? {};
  const g =
    direccion === 'v'
      ? linearGradient('gFondo', 0.12, 0, 0.88, 1, [
          [0, surface], [0.26, lighten(bg, 0.35)], [0.55, bg],
          [0.78, mix(bg, accent, fuerza * 0.62)], [0.93, mix(bg, accent, fuerza)], [1, mix(bg, accent, fuerza * 1.18)],
        ])
      : linearGradient('gFondo', 0, 0.05, 1, 0.95, [
          [0, surface], [0.20, lighten(bg, 0.3)], [0.48, bg],
          [0.74, mix(bg, accent, fuerza * 0.62)], [1, mix(bg, accent, fuerza * 1.1)],
        ]);
  const defs =
    g +
    radialGradient('gClaro', claroEn[0], claroEn[1], 0.55, [[0, surface, 0.88], [0.50, surface, 0.45], [1, surface, 0]]) +
    radialGradient('gVineta', 0.5, 0.48, 0.78, [[0.60, '#000000', 0], [1, mix(p.ink, accent, 0.45), 0.14]]) +
    blurFilter('fBlur', Math.max(w, h) * 0.045) +
    washFilter('fWash', { semilla: semilla, escala: Math.max(w, h) * 0.03, blur: Math.max(w, h) * 0.012 }) +
    // charco de pigmento de una flor: mismo principio que `fWash`, a escala de pincel
    washFilter('fWashF', { semilla: semilla + 5, freq: 0.02, escala: Math.max(w, h) * 0.012, blur: Math.max(w, h) * 0.008 }) +
    paperFilter('fPapel', { semilla, alfa: 0.062, tinta: p.ink, freq: 0.9 });
  return { defs, cuerpo: `<rect width="${w}" height="${h}" fill="url(#gFondo)"/>` };
}

const vineta = (w, h) => `<rect width="${w}" height="${h}" fill="url(#gVineta)"/>`;
const claro = (w, h) => `<rect width="${w}" height="${h}" fill="url(#gClaro)"/>`;
const papel = (w, h) => `<rect width="${w}" height="${h}" filter="url(#fPapel)"/>`;

// =============================================================================== BODA — papelería

/**
 * Ramo de contorno simétrico: tres pares de ramas que abren desde un punto, con olivas y zarcillos.
 * La simetría axial es deliberada — es lo que distingue la papelería grabada de una composición
 * de jardín — pero cada hoja lleva su propia perturbación, así que ningún par es idéntico.
 */
function ramoLinea(cx, cy, esc, p, { op = 0.85, invertido = false, semilla = 31 } = {}) {
  const s = invertido ? -1 : 1;
  const g = Math.max(0.7, esc);
  // Tinta botánica: el acento SOLO no se ve a tamaño de miniatura — el contacto de hoja lo dejó en
  // evidencia. La línea se dibuja con el acento tirado hacia la tinta, que es justo lo que hace una
  // plancha grabada: el pigmento del trazo es más oscuro que el del lavado que lo rodea.
  const linea = mix(p.accent, p.ink, 0.30);
  const hoja2 = mix(linea, p.muted, 0.45);
  let out = '';
  let k = semilla;
  for (const lado of [-1, 1]) {
    // Rama larga: nace SEPARADA del eje, no del mismo punto que las demás. Hacerlas nacer todas
    // del centro producía un nudo de trazos justo donde más se mira.
    const o = [cx + lado * 26 * esc, cy];
    const punta = [cx + lado * 372 * esc, cy - s * 78 * esc];
    out += branch(
      o, [cx + lado * 140 * esc, cy - s * 40 * esc], [cx + lado * 276 * esc, cy - s * 100 * esc], punta,
      { hojas: 9, largo: 84 * esc, ancho: 32 * esc, color: linea, color2: hoja2, op: Math.min(1, op * 1.15), estilo: 'line',
        trazo: 2.5 * g, tallo: 2.4 * g, apertura: 44, merma: 0.5, semilla: (k += 7),
        bayas: 3, bayaR: 6 * esc, bayaColor: mix(linea, p.ink, 0.2), bayaOp: 0.62 },
    );
    out += tendril(punta[0], punta[1], 1.05 * esc, lado < 0 ? 194 : -14, hoja2, 2 * g, op * 0.72, 1.4, lado);
    // Rama corta, más abierta y por debajo: da grosor a la guirnalda sin cruzarse con la larga.
    out += branch(
      [cx + lado * 62 * esc, cy + s * 26 * esc], [cx + lado * 150 * esc, cy + s * 44 * esc],
      [cx + lado * 236 * esc, cy + s * 52 * esc], [cx + lado * 300 * esc, cy + s * 34 * esc],
      { hojas: 7, largo: 62 * esc, ancho: 24 * esc, color: hoja2, op: op * 0.95, estilo: 'line',
        trazo: 2.1 * g, tallo: 2 * g, apertura: 56, merma: 0.4, semilla: (k += 7) },
    );
  }
  // Un solo brote central, vertical y corto: cierra la simetría sin añadir un cruce.
  out += branch(
    [cx, cy + s * 10 * esc], [cx - 14 * esc, cy - s * 74 * esc], [cx + 16 * esc, cy - s * 150 * esc], [cx, cy - s * 208 * esc],
    { hojas: 6, largo: 54 * esc, ancho: 20 * esc, color: linea, op: op * 0.88, estilo: 'line',
      trazo: 2 * g, tallo: 1.9 * g, apertura: 58, merma: 0.55, semilla: k + 3 },
  );
  return out;
}

/**
 * Ornamento de esquina: una ramita en diagonal hacia dentro del marco, rematada en zarcillo.
 * Sustituye a la voluta abstracta del primer borrador, que se leía como un corchete suelto:
 * la esquina tiene que hablar el MISMO idioma botánico que el resto de la lámina.
 */
function esquina(esc, p, op, semilla) {
  const E = esc;
  return (
    branch([0, 0], [112 * E, 4 * E], [186 * E, 58 * E], [226 * E, 150 * E],
      { hojas: 6, largo: 54 * E, ancho: 19 * E, color: p.accent, color2: p.muted, op, estilo: 'line',
        trazo: 1.5 * Math.max(0.7, E), tallo: 1.3 * Math.max(0.7, E), apertura: 52, merma: 0.55, semilla }) +
    branch([0, 0], [70 * E, 40 * E], [116 * E, 96 * E], [128 * E, 166 * E],
      { hojas: 4, largo: 40 * E, ancho: 14 * E, color: p.muted, op: op * 0.72, estilo: 'line',
        trazo: 1.2 * Math.max(0.7, E), tallo: 1.1 * Math.max(0.7, E), apertura: 58, merma: 0.5, semilla: semilla + 5 }) +
    tendril(226 * E, 150 * E, 0.7 * E, 74, p.muted, 1.2 * Math.max(0.7, E), op * 0.6, 1.4)
  );
}

/** Las cuatro esquinas del marco, giradas para mirar siempre hacia el centro de la lámina. */
const volutas = (w, h, inset, esc, p, op = 0.6) => {
  const d = inset + 20;
  const pon = (x, y, ang, s) => `<g transform="translate(${n(x)},${n(y)}) rotate(${n(ang)})">${esquina(esc, p, op, s)}</g>`;
  return pon(d, d, 0, 11) + pon(w - d, d, 90, 23) + pon(w - d, h - d, 180, 37) + pon(d, h - d, 270, 53);
};

// ================================================================================ XV — acuarela

/** Racimo de jardín: peonías de acuarela, eucalipto relleno y nube de novia. Asimétrico. */
function racimoAcuarela(cx, cy, esc, p, semilla, { giro = 0, densidad = 1, wash = 'fWashF' } = {}) {
  const hondo = darken(p.accent, 0.26);
  const medio = mix(p.accent, p.ink, 0.10);
  const claroF = lighten(p.accent, 0.52);
  const petalo = p.floral ?? mix(p.accent, '#FFFFFF', 0.35);
  let s = `<g transform="translate(${n(cx)},${n(cy)}) rotate(${n(giro)}) scale(${n(esc)})">`;
  // follaje al fondo, en cuatro direcciones y en tres verdes distintos
  s += branch([0, 0], [-120, -70], [-270, -70], [-390, -18], { hojas: 9, largo: 76, ancho: 35, color: medio, color2: hondo, op: 0.58, estilo: 'solid', apertura: 44, merma: 0.5, tallo: 2.2, tallOp: 0.5, semilla: semilla + 11 });
  s += branch([0, 0], [110, -90], [230, -132], [352, -110], { hojas: 9, largo: 72, ancho: 33, color: p.accent, color2: mix(p.accent, p.muted, 0.6), op: 0.52, estilo: 'solid', apertura: 50, merma: 0.5, tallo: 2.2, tallOp: 0.45, semilla: semilla + 13 });
  s += branch([0, 0], [-40, -140], [-30, -260], [24, -344], { hojas: 10, largo: 56, ancho: 34, color: mix(p.accent, '#FFFFFF', 0.22), op: 0.6, estilo: 'round', apertura: 62, merma: 0.4, tallo: 2, tallOp: 0.45, semilla: semilla + 17 });
  s += branch([0, 0], [80, 60], [190, 92], [286, 74], { hojas: 9, largo: 52, ancho: 30, color: mix(p.accent, '#FFFFFF', 0.10), op: 0.55, estilo: 'round', apertura: 58, merma: 0.4, tallo: 2, tallOp: 0.45, semilla: semilla + 19 });
  s += branch([0, 0], [-140, 30], [-230, 96], [-300, 168], { hojas: 6, largo: 60, ancho: 26, color: hondo, op: 0.42, estilo: 'solid', apertura: 52, merma: 0.5, tallo: 1.8, tallOp: 0.4, semilla: semilla + 23 });
  // flores: una grande, dos medianas, dos pequeñas — nunca alineadas ni del mismo tono
  s += flower(-18, -46, 138, { base: petalo, centro: hondo, semilla: semilla + 1, op: 0.66, giro: 8, washId: wash, petalos: 9, coronas: 4 });
  s += flower(-182, -6, 92, { base: lighten(petalo, 0.16), centro: mix(hondo, petalo, 0.45), semilla: semilla + 2, op: 0.60, giro: 34, washId: wash, petalos: 8 });
  s += flower(130, -102, 80, { base: darken(petalo, 0.10), centro: hondo, semilla: semilla + 3, op: 0.56, giro: 61, washId: wash, petalos: 9 });
  if (densidad > 0.6) {
    s += flower(56, 66, 56, { base: lighten(petalo, 0.28), centro: mix(hondo, '#FFFFFF', 0.2), semilla: semilla + 4, op: 0.55, giro: 12, coronas: 2 });
    s += flower(-112, 84, 46, { base: petalo, centro: hondo, semilla: semilla + 5, op: 0.52, giro: 47, coronas: 2 });
  }
  s += fillerDots(196, -186, 124, { cuenta: 16, color: claroF, op: 0.72, semilla: semilla + 6, punto: 5 });
  s += fillerDots(-258, -126, 98, { cuenta: 12, color: claroF, op: 0.62, semilla: semilla + 7, punto: 4.4 });
  return s + '</g>';
}

// ============================================================================ escenas por familia

/**
 * Portada, retrato 1600×2240. La mitad superior queda deliberadamente clara y limpia: es donde
 * la sección `cover` pinta el `coverTitle`, y esa zona se mide contra AA.
 */
export function portada(p, familia) {
  const w = 1600, h = 2240;
  const f = fondo(w, h, p, familia === 'boda'
    ? { direccion: 'v', claroEn: [0.5, 0.26], fuerza: 0.38, semilla: 21 }
    : { direccion: 'd', claroEn: [0.46, 0.30], fuerza: 0.30, semilla: 41 });
  let b = f.cuerpo;

  if (familia === 'boda') {
    b += wash('fWash', w * 0.16, h * 0.95, w * 0.44, p.accent, 0.34, 0, 0.72);
    b += wash('fWash', w * 0.93, h * 0.80, w * 0.36, mix(p.accent, p.ink, 0.10), 0.24, 0, 0.8);
    b += wash('fWash', w * 0.52, h * 1.02, w * 0.50, mix(p.accent, p.ink, 0.16), 0.20, 0, 0.6);
    b += lavadosDeBorde(w, h, p, 3301, 0.9);
    b += claro(w, h);
    b += `<g opacity="0.95">${doubleFrame(w, h, 86, mix(p.muted, p.ink, 0.25), 0.62)}</g>`;
    b += volutas(w, h, 86, 0.70, p, 0.52);
    // Guirnalda baja, simétrica y AMPLIA: ocupa casi todo el ancho de la lámina y deja la mitad
    // superior libre para el título. Es el peso visual de la portada.
    b += ramoLinea(w / 2, h * 0.862, 1.86, p, { op: 0.84 });
    b += ramoLinea(w / 2, h * 0.906, 0.88, p, { op: 0.42, semilla: 97 });
    for (const lado of [-1, 1]) {
      b += branch([w / 2, h * 0.128], [w / 2 + lado * w * 0.06, h * 0.118], [w / 2 + lado * w * 0.12, h * 0.116], [w / 2 + lado * w * 0.175, h * 0.129],
        { hojas: 8, largo: 52, ancho: 19, color: mix(p.accent, '#FFFFFF', 0.52), color2: mix(p.muted, '#FFFFFF', 0.5),
          op: 0.8, estilo: 'line', trazo: 1.6, tallo: 1.5, apertura: 48, merma: 0.5, semilla: 1201 + lado });
    }
    b += rule(w / 2, h * 0.618, w * 0.30, p.muted, 0.55, 1.4);
    // dos ramitas menudas que enmarcan el filete, sin tocar el texto
    b += branch([w / 2 - w * 0.19, h * 0.618], [w / 2 - w * 0.24, h * 0.606], [w / 2 - w * 0.29, h * 0.60], [w / 2 - w * 0.33, h * 0.612],
      { hojas: 5, largo: 34, ancho: 12, color: p.accent, op: 0.55, estilo: 'line', trazo: 1.1, tallo: 1, apertura: 52, merma: 0.5 });
    b += branch([w / 2 + w * 0.19, h * 0.618], [w / 2 + w * 0.24, h * 0.606], [w / 2 + w * 0.29, h * 0.60], [w / 2 + w * 0.33, h * 0.612],
      { hojas: 5, largo: 34, ancho: 12, color: p.accent, op: 0.55, estilo: 'line', trazo: 1.1, tallo: 1, apertura: 52, merma: 0.5 });
  } else {
    b += wash('fWash', w * 0.10, h * 0.90, w * 0.44, p.accent, 0.26, 0, 0.8);
    b += wash('fWash', w * 0.95, h * 0.20, w * 0.34, mix(p.accent, p.floral ?? p.accent, 0.6), 0.20, 0, 0.9);
    b += wash('fWash', w * 0.86, h * 0.96, w * 0.36, mix(p.accent, p.ink, 0.12), 0.16, 0, 0.7);
    b += lavadosDeBorde(w, h, p, 3307, 0.9);
    // celosía de jardín recortada dentro del arco ojival
    const arco = ogeePath(w * 0.125, h * 0.150, w * 0.875, h * 0.915);
    b += `<clipPath id="cArco"><path d="${arco}"/></clipPath>`;
    b += `<path d="${arco}" fill="${p.ink}" fill-opacity="0.05" filter="url(#fBlur)"/>`;
    b += `<g clip-path="url(#cArco)"><path d="${arco}" fill="${p.surface}" fill-opacity="0.86"/>` +
      trellis(w * 0.125, h * 0.52, w * 0.875, h * 0.915, 82, p.muted, 0.115, 2) + `</g>`;
    b += claro(w, h);
    b += `<path d="${arco}" fill="none" stroke="${p.muted}" stroke-opacity="0.55" stroke-width="2.6"/>`;
    b += `<path d="${ogeePath(w * 0.144, h * 0.169, w * 0.856, h * 0.897)}" fill="none" stroke="${p.muted}" stroke-opacity="0.30" stroke-width="1.2"/>`;
    // Guirnaldas asimétricas, TODAS por debajo de la zona del título: cualquier hoja saturada
    // dentro de ella hunde el contraste por debajo de AA (medido: 3.00:1 en la primera versión,
    // con el racimo en 0.175 de alto). El arte cede, no el umbral.
    b += racimoAcuarela(w * 0.33, h * 0.868, 1.34, p, 101, { giro: -8 });
    b += racimoAcuarela(w * 0.912, h * 0.740, 0.74, p, 307, { giro: 26, densidad: 0.6 });
    b += racimoAcuarela(w * 0.055, h * 0.675, 0.42, p, 211, { giro: -46, densidad: 0.3 });
    // Corona de clave, dentro de la zona del título pero en un tinte pálido a propósito.
    for (const lado of [-1, 1]) {
      b += branch([w / 2, h * 0.212], [w / 2 + lado * w * 0.07, h * 0.199], [w / 2 + lado * w * 0.145, h * 0.197], [w / 2 + lado * w * 0.205, h * 0.216],
        { hojas: 9, largo: 62, ancho: 27, color: mix(p.accent, '#FFFFFF', 0.50), color2: mix(p.muted, '#FFFFFF', 0.48),
          op: 0.72, estilo: 'solid', apertura: 46, merma: 0.45, tallo: 2.2, tallOp: 0.4, semilla: 1451 + lado });
    }
    b += rule(w / 2, h * 0.60, w * 0.26, p.muted, 0.5, 1.3);
  }
  b += papel(w, h) + vineta(w, h);
  // zona del título: mitad superior, dentro del margen de seguridad
  return { svg: doc(w, h, f.defs, b), w, h, zonas: [{ nombre: 'título', rect: [0.12, 0.09, 0.88, 0.55], umbral: 4.5 }] };
}

/** Fondo de RSVP, apaisado 1920×1080. El centro queda limpio: ahí van título, fecha y nota. */
export function fondoRsvp(p, familia) {
  const w = 1920, h = 1080;
  const f = fondo(w, h, p, familia === 'boda'
    ? { direccion: 'd', claroEn: [0.5, 0.46], fuerza: 0.30, semilla: 33 }
    : { direccion: 'd', claroEn: [0.5, 0.44], fuerza: 0.26, semilla: 53 });
  let b = f.cuerpo;
  if (familia === 'boda') {
    b += wash('fWash', w * 0.06, h * 0.86, w * 0.24, p.accent, 0.24, 0, 1);
    b += wash('fWash', w * 0.96, h * 0.14, w * 0.22, mix(p.accent, p.muted, 0.4), 0.20, 0, 1);
    b += claro(w, h);
    // Las ramas se quedan en los bordes: el centro (la zona medida) no lleva ni una hoja.
    b += branch([-30, h * 0.98], [w * 0.06, h * 0.82], [w * 0.12, h * 0.70], [w * 0.185, h * 0.64],
      { hojas: 10, largo: 66, ancho: 23, color: p.accent, color2: p.muted, op: 0.66, estilo: 'line', trazo: 1.5, tallo: 1.4, apertura: 48, merma: 0.5, semilla: 71, bayas: 3, bayaR: 4, bayaColor: p.muted, bayaOp: 0.45 });
    b += branch([-20, h * 0.62], [w * 0.04, h * 0.48], [w * 0.09, h * 0.32], [w * 0.145, h * 0.16],
      { hojas: 8, largo: 52, ancho: 18, color: p.muted, op: 0.52, estilo: 'line', trazo: 1.3, tallo: 1.2, apertura: 54, merma: 0.5, semilla: 73 });
    b += branch([w + 30, h * 0.04], [w * 0.94, h * 0.20], [w * 0.89, h * 0.32], [w * 0.815, h * 0.38],
      { hojas: 10, largo: 66, ancho: 23, color: p.accent, color2: p.muted, op: 0.66, estilo: 'line', trazo: 1.5, tallo: 1.4, apertura: 48, merma: 0.5, semilla: 79, bayas: 3, bayaR: 4, bayaColor: p.muted, bayaOp: 0.45 });
    b += branch([w + 20, h * 0.42], [w * 0.96, h * 0.56], [w * 0.91, h * 0.72], [w * 0.855, h * 0.86],
      { hojas: 8, largo: 52, ancho: 18, color: p.muted, op: 0.52, estilo: 'line', trazo: 1.3, tallo: 1.2, apertura: 54, merma: 0.5, semilla: 83 });
    b += `<g opacity="0.9">${doubleFrame(w, h, 54, p.muted, 0.34)}</g>`;
  } else {
    b += wash('fWash', w * 0.04, h * 0.90, w * 0.26, p.accent, 0.24, 0, 1);
    b += wash('fWash', w * 0.98, h * 0.10, w * 0.24, mix(p.accent, p.floral ?? p.accent, 0.6), 0.20, 0, 1);
    b += claro(w, h);
    b += racimoAcuarela(w * 0.085, h * 0.92, 0.70, p, 401, { giro: -22, densidad: 0.7 });
    b += racimoAcuarela(w * 0.935, h * 0.085, 0.64, p, 503, { giro: 160, densidad: 0.7 });
    b += racimoAcuarela(w * 0.025, h * 0.16, 0.32, p, 607, { giro: 84, densidad: 0.3 });
  }
  b += papel(w, h) + vineta(w, h);
  return { svg: doc(w, h, f.defs, b), w, h, zonas: [{ nombre: 'centro', rect: [0.20, 0.14, 0.80, 0.86], umbral: 4.5 }] };
}

/** Separador de sección, apaisado 1600×420. Ornamento puro; no lleva texto encima. */
export function separador(p, familia) {
  const w = 1600, h = 420;
  const f = fondo(w, h, p, { direccion: 'd', claroEn: [0.5, 0.5], fuerza: 0.16, semilla: familia === 'boda' ? 61 : 71 });
  let b = f.cuerpo + claro(w, h);
  if (familia === 'boda') {
    b += rule(w / 2, h * 0.56, w * 0.52, p.muted, 0.6, 1.5);
    b += ramoLinea(w / 2, h * 0.52, 0.55, p, { op: 0.75, invertido: true });
    b += flourish(w * 0.20, h * 0.56, 0.42, 0, p.muted, 1.6, 0.5);
    b += flourish(w * 0.80, h * 0.56, 0.42, 180, p.muted, 1.6, 0.5);
  } else {
    b += racimoAcuarela(w * 0.5, h * 0.86, 0.46, p, 811, { giro: 0, densidad: 0.9 });
    b += `<g opacity="0.9">` + wreath(w / 2, h * 0.5, h * 0.30, { color: p.accent, color2: mix(p.accent, '#FFFFFF', 0.3), largo: 40, ancho: 17, op: 0.4, estilo: 'solid', hojas: 9, abertura: 40 }) + `</g>`;
    b += rule(w / 2, h * 0.5, w * 0.20, p.muted, 0.45, 1.2);
  }
  b += papel(w, h);
  return { svg: doc(w, h, f.defs, b), w, h, zonas: [] };
}

/**
 * Estudio de galería, 1200×1500. Seis por plantilla, coherentes entre sí y distintos uno a uno:
 * cambian la composición, el encuadre, la semilla del lavado y la mezcla de la paleta.
 */
export function galeria(p, familia, i) {
  const w = 1200, h = 1500;
  const mezclas = [0.0, 0.18, 0.34, 0.10, 0.26, 0.42];
  const q = { ...p, accent: mix(p.accent, i % 2 ? p.muted : p.ink, mezclas[i] * 0.55) };
  const f = fondo(w, h, q, { direccion: i % 2 ? 'd' : 'v', claroEn: [0.5, 0.38], fuerza: 0.20 + mezclas[i] * 0.5, semilla: 900 + i * 13 });
  let b = f.cuerpo;
  b += wash('fWash', w * (0.14 + 0.7 * ((i * 0.37) % 1)), h * (0.80 + 0.14 * ((i * 0.61) % 1)), w * 0.42, q.accent, 0.22 + 0.06 * (i % 3), 0, 0.85);
  b += wash('fWash', w * (0.86 - 0.6 * ((i * 0.53) % 1)), h * 0.16, w * 0.30, mix(q.accent, q.muted, 0.5), 0.18, 0, 0.9);
  b += claro(w, h);

  if (familia === 'boda') {
    const cx = w / 2, r = w * 0.34;
    const linea = mix(q.accent, q.ink, 0.30);
    const linea2 = mix(linea, q.muted, 0.45);
    if (i === 0) {           // tallo único, vertical, muy tranquilo
      b += branch([cx, h * 0.90], [cx - 40, h * 0.68], [cx + 46, h * 0.42], [cx - 12, h * 0.16],
        { hojas: 13, largo: 76, ancho: 27, color: linea, op: 0.85, estilo: 'line', trazo: 2.3, tallo: 2.2, apertura: 46, merma: 0.55 });
    } else if (i === 1) {    // dos tallos cruzados, atados
      for (const s of [-1, 1]) {
        b += branch([cx + s * 12, h * 0.86], [cx + s * 150, h * 0.66], [cx + s * 120, h * 0.36], [cx + s * 210, h * 0.16],
          { hojas: 11, largo: 66, ancho: 23, color: s < 0 ? linea : linea2, op: 0.82, estilo: 'line', trazo: 2.1, tallo: 2.0, apertura: 50, merma: 0.5 });
      }
      b += `<path d="M${n(cx - 62)},${n(h * 0.845)} q62,26 124,0" fill="none" stroke="${q.muted}" stroke-opacity="0.8" stroke-width="4"/>`;
    } else if (i === 2) {    // corona de contorno
      b += wreath(cx, h * 0.48, r * 1.12, { color: linea, color2: q.muted, largo: 96, ancho: 35, op: 0.95, estilo: 'line', hojas: 14, abertura: 26 });
      b += rule(cx, h * 0.48, w * 0.16, q.muted, 0.5, 1.2);
    } else if (i === 3) {    // arco de medio punto con ramita
      const a = archPath(w * 0.22, h * 0.14, w * 0.78, h * 0.86);
      b += `<path d="${a}" fill="${q.surface}" fill-opacity="0.44" stroke="${q.muted}" stroke-opacity="0.5" stroke-width="2.2"/>`;
      b += branch([cx - 8, h * 0.80], [cx - 70, h * 0.62], [cx + 30, h * 0.44], [cx - 20, h * 0.27],
        { hojas: 10, largo: 54, ancho: 19, color: linea, op: 0.8, estilo: 'line', trazo: 2.0, tallo: 1.9, apertura: 50, merma: 0.55 });
    } else if (i === 4) {    // tres hojas sueltas, estudio botánico
      b += leafOutline(w * 0.30, h * 0.62, 330, 118, -62, linea, 2.6, 0.85);
      b += leafOutline(w * 0.52, h * 0.72, 276, 96, -78, linea2, 2.2, 0.8);
      b += leafOutline(w * 0.70, h * 0.58, 232, 82, -50, linea, 2.1, 0.7);
      b += rule(cx, h * 0.86, w * 0.28, q.muted, 0.5, 1.2);
    } else {                 // volutas enfrentadas
      b += flourish(w * 0.34, h * 0.56, 1.15, -20, linea, 2.4, 0.7);
      b += flourish(w * 0.66, h * 0.56, 1.15, 200, linea, 2.4, 0.7);
      b += rule(cx, h * 0.56, w * 0.10, q.muted, 0.55, 1.3);
      b += branch([cx, h * 0.78], [cx - 30, h * 0.72], [cx + 30, h * 0.68], [cx, h * 0.62],
        { hojas: 5, largo: 40, ancho: 14, color: linea2, op: 0.6, estilo: 'line', trazo: 1.8, tallo: 1.7, apertura: 54, merma: 0.5 });
    }
    b += `<g opacity="0.9">${doubleFrame(w, h, 44, mix(q.muted, q.ink, 0.2), 0.55)}</g>`;
  } else {
    const cx = w / 2;
    if (i === 0) {           // racimo grande centrado
      b += racimoAcuarela(cx, h * 0.66, 1.32, q, 1201, { giro: -6 });
    } else if (i === 1) {    // una sola flor, de cerca
      b += flower(cx, h * 0.50, w * 0.30, { base: mix(q.floral ?? q.accent, '#FFFFFF', 0.2), centro: darken(q.accent, 0.25), semilla: 1301, op: 0.5, coronas: 4, petalos: 9 });
      b += fillerDots(cx + w * 0.28, h * 0.30, w * 0.16, { cuenta: 14, color: lighten(q.accent, 0.5), op: 0.65, semilla: 1307, punto: 6 });
    } else if (i === 2) {    // guirnalda en arco
      b += wreath(cx, h * 0.52, w * 0.30, { color: q.accent, color2: mix(q.accent, '#FFFFFF', 0.35), largo: 66, ancho: 30, op: 0.5, estilo: 'solid', hojas: 12, abertura: 26 });
      b += flower(cx, h * 0.52 + w * 0.30, w * 0.11, { base: q.floral ?? q.accent, centro: darken(q.accent, 0.28), semilla: 1409, op: 0.5 });
    } else if (i === 3) {    // abanico de eucalipto
      for (let k = -2; k <= 2; k++) {
        b += branch([cx, h * 0.88], [cx + k * 90, h * 0.70], [cx + k * 150, h * 0.44], [cx + k * 168, h * 0.20],
          { hojas: 9, largo: 58, ancho: 48, color: mix(q.accent, '#FFFFFF', 0.10 + 0.08 * Math.abs(k)), op: 0.48, estilo: 'round', apertura: 60, merma: 0.45, tallo: 2, tallOp: 0.4 });
      }
    } else if (i === 4) {    // arco ojival de jardín
      const a = ogeePath(w * 0.20, h * 0.12, w * 0.80, h * 0.88);
      b += `<clipPath id="cG4"><path d="${a}"/></clipPath>`;
      b += `<g clip-path="url(#cG4)"><path d="${a}" fill="${q.surface}" fill-opacity="0.82"/>` + trellis(w * 0.20, h * 0.45, w * 0.80, h * 0.88, 62, q.muted, 0.20, 2) + `</g>`;
      b += `<path d="${a}" fill="none" stroke="${q.muted}" stroke-opacity="0.55" stroke-width="2.4"/>`;
      b += racimoAcuarela(w * 0.30, h * 0.86, 0.56, q, 1511, { giro: -14, densidad: 0.6 });
    } else {                 // lluvia de pétalos
      const rnd = prng(1613);
      for (let k = 0; k < 34; k++) {
        const x = rnd() * w, y = rnd() * h, s = 22 + rnd() * 52;
        b += leafSolid(x, y, s, s * 0.62, rnd() * 360, mix(q.floral ?? q.accent, '#FFFFFF', rnd() * 0.5), 0.20 + rnd() * 0.30);
      }
      b += flower(cx, h * 0.60, w * 0.18, { base: q.floral ?? q.accent, centro: darken(q.accent, 0.25), semilla: 1619, op: 0.45 });
    }
  }
  b += papel(w, h) + vineta(w, h);
  return { svg: doc(w, h, f.defs, b), w, h, zonas: [] };
}

/**
 * Retrato de celebrante, cuadrado 1000×1000. NO hay fotografía real y no se finge que la haya:
 * es un medallón de papelería con la inicial compuesta en la tipografía de la propia plantilla.
 * La inicial no aporta información nueva — el nombre de la persona va SIEMPRE en texto al lado,
 * en el bloque `person` de la misma sección (`04 §17.4`).
 */
export function retrato(p, familia, { inicial, variante }) {
  const w = 1000, h = 1000;
  const f = fondo(w, h, p, { direccion: variante === 'a' ? 'v' : 'd', claroEn: [0.5, 0.42], fuerza: 0.26, semilla: variante === 'a' ? 77 : 79 });
  let b = f.cuerpo;
  b += wash('fWash', w * (variante === 'a' ? 0.16 : 0.84), h * 0.88, w * 0.36, p.accent, 0.24, 0, 0.9);
  b += claro(w, h);
  const cx = w / 2, cy = h * 0.47, r = w * 0.315;
  b += `<circle cx="${n(cx)}" cy="${n(cy + 10)}" r="${n(r)}" fill="${p.ink}" fill-opacity="0.07" filter="url(#fSombra)"/>`;
  b += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="url(#gMedallon)"/>`;
  b += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${p.muted}" stroke-opacity="0.6" stroke-width="2.4"/>`;
  b += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r - 14)}" fill="none" stroke="${p.muted}" stroke-opacity="0.35" stroke-width="1"/>`;

  if (familia === 'boda') {
    b += wreath(cx, cy, r + 34, { color: p.accent, color2: p.muted, largo: 58, ancho: 20, op: 0.7, estilo: 'line', hojas: variante === 'a' ? 11 : 13, abertura: variante === 'a' ? 34 : 22 });
    b += flourish(cx - r - 38, cy + r * 0.72, 0.5, -34, p.muted, 1.6, 0.5);
    b += flourish(cx + r + 38, cy + r * 0.72, 0.5, 214, p.muted, 1.6, 0.5);
  } else {
    b += wreath(cx, cy, r + 40, { color: p.accent, color2: mix(p.accent, '#FFFFFF', 0.35), largo: 56, ancho: 26, op: 0.5, estilo: 'solid', hojas: 12, abertura: variante === 'a' ? 30 : 46 });
    b += flower(cx - r * (variante === 'a' ? 0.92 : -0.92), cy + r * 0.86, w * 0.085, { base: p.floral ?? p.accent, centro: darken(p.accent, 0.25), semilla: variante === 'a' ? 1709 : 1721, op: 0.5 });
    b += fillerDots(cx + r * (variante === 'a' ? 0.95 : -0.95), cy - r * 0.80, w * 0.10, { cuenta: 11, color: lighten(p.accent, 0.45), op: 0.6, semilla: 1733, punto: 5 });
  }
  b += rule(cx, cy + r * 0.60, r * 0.72, p.muted, 0.5, 1.2);
  b += textLine(cx, cy + r * 0.30, inicial, {
    familia: familia === 'boda' ? 'Cormorant Garamond' : 'Playfair Display',
    tam: r * 1.02, color: p.ink, op: 0.62, peso: familia === 'boda' ? 300 : 400, italic: familia === 'boda',
  });
  b += papel(w, h) + vineta(w, h);
  const defs = f.defs +
    radialGradient('gMedallon', 0.5, 0.36, 0.72, [[0, p.surface, 0.95], [0.62, mix(p.surface, p.bg, 0.6), 0.9], [1, mix(p.bg, p.accent, 0.18), 0.92]]) +
    softShadow('fSombra', 16, 8);
  return { svg: doc(w, h, defs, b), w, h, zonas: [] };
}

/** Imagen apaisada de relato, 1600×900 (bloque `storyImage`, `aspect: landscape`). */
export function relato(p, familia, i) {
  const w = 1600, h = 900;
  const f = fondo(w, h, p, { direccion: i % 2 ? 'v' : 'd', claroEn: [i % 2 ? 0.34 : 0.66, 0.42], fuerza: 0.26, semilla: 1801 + i * 7 });
  let b = f.cuerpo;
  b += wash('fWash', w * (i % 2 ? 0.9 : 0.1), h * 0.9, w * 0.30, p.accent, 0.24, 0, 0.9);
  b += claro(w, h);
  const s = i % 2 ? -1 : 1, x0 = i % 2 ? w + 40 : -40;
  if (familia === 'boda') {
    b += branch([x0, h * 1.02], [x0 + s * w * 0.14, h * 0.72], [x0 + s * w * 0.30, h * 0.60], [x0 + s * w * 0.44, h * 0.40],
      { hojas: 12, largo: 68, ancho: 24, color: p.accent, op: 0.72, estilo: 'line', trazo: 1.6, tallo: 1.5, apertura: 48, merma: 0.5 });
    b += branch([x0, h * 0.40], [x0 + s * w * 0.09, h * 0.26], [x0 + s * w * 0.18, h * 0.14], [x0 + s * w * 0.28, h * 0.06],
      { hojas: 8, largo: 50, ancho: 17, color: p.muted, op: 0.55, estilo: 'line', trazo: 1.3, tallo: 1.2, apertura: 54, merma: 0.5 });
    b += rule(w / 2, h * 0.86, w * 0.22, p.muted, 0.45, 1.2);
  } else {
    b += racimoAcuarela(x0 + s * w * 0.16, h * 0.88, 0.72, p, 1901 + i * 11, { giro: s * -16, densidad: 0.8 });
  }
  b += `<g opacity="0.8">${doubleFrame(w, h, 38, p.muted, 0.3)}</g>` + papel(w, h) + vineta(w, h);
  return { svg: doc(w, h, f.defs, b), w, h, zonas: [] };
}

/** Imagen de código de vestimenta, retrato 1000×1400 (`dressCodeImage`, `aspect: portrait`). */
export function vestimenta(p, familia, variante) {
  const w = 1000, h = 1400;
  const f = fondo(w, h, p, { direccion: 'v', claroEn: [0.5, 0.34], fuerza: 0.24, semilla: variante === 'a' ? 2101 : 2111 });
  let b = f.cuerpo;
  b += wash('fWash', w * (variante === 'a' ? 0.18 : 0.82), h * 0.9, w * 0.36, p.accent, 0.22, 0, 0.9);
  b += claro(w, h);
  const a = archPath(w * 0.19, h * 0.11, w * 0.81, h * 0.89);
  b += `<path d="${a}" fill="${p.surface}" fill-opacity="0.5" stroke="${p.muted}" stroke-opacity="0.55" stroke-width="2.4"/>`;
  b += `<path d="${archPath(w * 0.215, h * 0.132, w * 0.785, h * 0.868)}" fill="none" stroke="${p.muted}" stroke-opacity="0.3" stroke-width="1"/>`;
  if (variante === 'a') {
    b += branch([w / 2, h * 0.80], [w / 2 - 70, h * 0.64], [w / 2 + 60, h * 0.46], [w / 2 - 20, h * 0.28],
      { hojas: 11, largo: 58, ancho: 20, color: p.accent, op: 0.78, estilo: 'line', trazo: 1.5, tallo: 1.4, apertura: 48, merma: 0.55 });
  } else {
    b += wreath(w / 2, h * 0.50, w * 0.20, { color: p.accent, color2: p.muted, largo: 50, ancho: 18, op: 0.72, estilo: 'line', hojas: 11, abertura: 28 });
    b += rule(w / 2, h * 0.50, w * 0.12, p.muted, 0.5, 1.2);
  }
  b += papel(w, h) + vineta(w, h);
  return { svg: doc(w, h, f.defs, b), w, h, zonas: [] };
}

/**
 * Miniatura del catálogo, retrato 800×1120 (`previewImage`, `01 §2.2`). Es una invitación en
 * pequeño: lleva texto de MUESTRA compuesto con la tipografía real del `fontSet` por defecto, para
 * que el cliente vea cómo se verá la suya. El nombre de la plantilla lo pone el catálogo en texto
 * al lado de la miniatura, así que la imagen no transporta información que no esté también escrita.
 */
export function miniatura(p, familia, muestra) {
  const w = 800, h = 1120;
  const heading = familia === 'boda' ? 'Cormorant Garamond' : 'Playfair Display';
  const f = fondo(w, h, p, { direccion: familia === 'boda' ? 'v' : 'd', claroEn: [0.5, 0.30], fuerza: 0.34, semilla: familia === 'boda' ? 2301 : 2311 });
  let b = f.cuerpo;

  if (familia === 'boda') {
    b += wash('fWash', w * 0.13, h * 0.95, w * 0.44, p.accent, 0.32, 0, 0.75);
    b += wash('fWash', w * 0.93, h * 0.82, w * 0.34, mix(p.accent, p.ink, 0.10), 0.24, 0, 0.85);
    b += claro(w, h);
    b += `<g opacity="0.95">${doubleFrame(w, h, 44, p.muted, 0.5)}</g>`;
    b += volutas(w, h, 44, 0.42, p, 0.62);
    b += ramoLinea(w / 2, h * 0.882, 0.66, p, { op: 0.82 });
    b += rule(w / 2, h * 0.605, w * 0.34, p.muted, 0.6, 1.3);
  } else {
    b += wash('fWash', w * 0.08, h * 0.90, w * 0.42, p.accent, 0.26, 0, 0.85);
    b += wash('fWash', w * 0.95, h * 0.16, w * 0.32, mix(p.accent, p.floral ?? p.accent, 0.6), 0.20, 0, 0.9);
    const a = ogeePath(w * 0.13, h * 0.10, w * 0.87, h * 0.90);
    b += `<clipPath id="cMini"><path d="${a}"/></clipPath>`;
    b += `<path d="${a}" fill="${p.ink}" fill-opacity="0.05" filter="url(#fBlur)"/>`;
    b += `<g clip-path="url(#cMini)"><path d="${a}" fill="${p.surface}" fill-opacity="0.88"/>` + trellis(w * 0.13, h * 0.52, w * 0.87, h * 0.90, 48, p.muted, 0.115, 1.6) + `</g>`;
    b += claro(w, h);
    b += `<path d="${a}" fill="none" stroke="${p.muted}" stroke-opacity="0.55" stroke-width="2"/>`;
    b += racimoAcuarela(w * 0.28, h * 0.86, 0.62, p, 2401, { giro: -8 });
    b += racimoAcuarela(w * 0.94, h * 0.115, 0.30, p, 2411, { giro: 158, densidad: 0.4 });
    b += rule(w / 2, h * 0.615, w * 0.26, p.muted, 0.5, 1.2);
  }

  const remate = papel(w, h) + vineta(w, h);
  let t = '';
  t += textLine(w / 2, h * 0.33, muestra.titulo, { familia: heading, tam: familia === 'boda' ? 108 : 84, color: p.ink, op: 0.92, peso: 400 });
  t += textLine(w / 2, h * 0.405, muestra.subtitulo, { familia: heading, tam: 34, color: p.ink, op: 0.62, esp: 5.5, italic: true });
  t += textLine(w / 2, h * 0.53, muestra.fecha, { familia: heading, tam: 40, color: p.ink, op: 0.78, esp: 7, peso: familia === 'boda' ? 600 : 700 });
  t += textLine(w / 2, h * 0.688, muestra.lugar, { familia: heading, tam: 28, color: p.ink, op: 0.6, esp: 3 });
  return {
    svg: doc(w, h, f.defs, b + t + remate), w, h,
    // El contraste se mide SOBRE EL FONDO SIN EL TEXTO: si se midiera sobre la imagen final, el
    // propio texto (que es la tinta) daría ratio 1:1 contra sí mismo y la comprobación no diría nada.
    svgMedida: doc(w, h, f.defs, b + remate),
    zonas: [{ nombre: 'texto', rect: [0.14, 0.24, 0.86, 0.72], umbral: 4.5 }],
  };
}
