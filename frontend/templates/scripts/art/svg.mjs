// frontend/templates/scripts/art/svg.mjs
//
// Primitivas de dibujo SVG para la imaginería de las plantillas. Todo es geometría autoral
// (curvas de Bézier reales, degradados multiparada, lavados con desenfoque, textura de papel con
// `feTurbulence`); NO hay rectángulos de color plano ni ruido de relleno haciendo de imagen.
//
// Determinismo (requisito duro: `package_hash` es la clave de idempotencia del registro,
// ADR-008 + ADR-1R-D-03): jamás se usa `Math.random`. Toda variación sale de `prng(semilla)`,
// un mulberry32 de 32 bits, y de la semilla entera de `feTurbulence`, que el propio SVG 1.1
// define como determinista.

import { mix, lighten, darken } from './color.mjs';

// ------------------------------------------------------------------------------------ utilidades

/** PRNG determinista mulberry32. Dos ejecuciones con la misma semilla dan la misma secuencia. */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Redondeo a 2 decimales para que el SVG no arrastre 17 dígitos por coordenada. */
const n = (v) => (Math.round(v * 100) / 100).toString();
export const num = n;
const rad = (deg) => (deg * Math.PI) / 180;

/** Escapa texto para un nodo XML. */
export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ------------------------------------------------------------------------------------- degradados

/**
 * Degradado lineal multiparada. `paradas` es `[[offset, hex, opacidad?], …]`.
 * Coordenadas en objectBoundingBox (0..1), que es lo que hace la composición independiente
 * del tamaño final del lienzo.
 */
export function linearGradient(id, x1, y1, x2, y2, paradas) {
  const s = paradas
    .map(([o, c, a]) => `<stop offset="${n(o)}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${n(a)}"`}/>`)
    .join('');
  return `<linearGradient id="${id}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${s}</linearGradient>`;
}

/** Degradado radial multiparada, en objectBoundingBox. */
export function radialGradient(id, cx, cy, r, paradas, fx = cx, fy = cy) {
  const s = paradas
    .map(([o, c, a]) => `<stop offset="${n(o)}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${n(a)}"`}/>`)
    .join('');
  return `<radialGradient id="${id}" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fx="${n(fx)}" fy="${n(fy)}">${s}</radialGradient>`;
}

// ----------------------------------------------------------------------------------------- filtros

/** Desenfoque gaussiano puro, con región ampliada para que el halo no se recorte. */
export const blurFilter = (id, sd) =>
  `<filter id="${id}" x="-45%" y="-45%" width="190%" height="190%"><feGaussianBlur stdDeviation="${n(sd)}"/></filter>`;

/**
 * Textura de papel: ruido fractal llevado a un color de tinta cálido con alfa muy baja.
 * `alfa` es el alfa MÁXIMO del grano; por encima de 0.10 deja de leerse como papel y empieza a
 * leerse como ruido, que es exactamente lo que este generador tiene prohibido producir.
 */
export function paperFilter(id, { freq = 0.85, octavas = 5, semilla = 11, alfa = 0.075, tinta = '#000000' } = {}) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(tinta.replace('#', '').slice(i, i + 2), 16) / 255);
  return (
    `<filter id="${id}" x="0%" y="0%" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${n(freq)}" numOctaves="${octavas}" seed="${semilla}" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="` +
    `0 0 0 0 ${n(r)}  0 0 0 0 ${n(g)}  0 0 0 0 ${n(b)}  ${n(alfa * 2)} ${n(alfa * 2)} ${n(alfa * 2)} 0 ${n(-alfa * 2.2)}"/>` +
    `</filter>`
  );
}

/**
 * Borde de acuarela: desplaza el trazo con ruido de baja frecuencia y lo desenfoca un poco.
 * Es lo que separa una mancha de color de un lavado de acuarela de verdad — el borde deja de
 * ser una curva perfecta y empieza a sangrar como el pigmento sobre papel de algodón.
 */
export function washFilter(id, { freq = 0.011, escala = 46, semilla = 3, blur = 9 } = {}) {
  return (
    `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${n(freq)}" numOctaves="4" seed="${semilla}" result="t"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="t" scale="${n(escala)}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
    `<feGaussianBlur in="d" stdDeviation="${n(blur)}"/>` +
    `</filter>`
  );
}

/** Sombra suave y muy abierta, para despegar una tarjeta o un medallón del fondo. */
export const softShadow = (id, sd, dy) =>
  `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%">` +
  `<feOffset dy="${n(dy)}"/><feGaussianBlur stdDeviation="${n(sd)}"/></filter>`;

// -------------------------------------------------------------------------------------- geometría

/** Evalúa una Bézier cúbica y su tangente en `t`. Puntos como `[x, y]`. */
export function cubicAt(p0, p1, p2, p3, t) {
  const m = 1 - t;
  const x = m ** 3 * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t ** 3 * p3[0];
  const y = m ** 3 * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t ** 3 * p3[1];
  const dx = 3 * m * m * (p1[0] - p0[0]) + 6 * m * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const dy = 3 * m * m * (p1[1] - p0[1]) + 6 * m * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  return { x, y, ang: (Math.atan2(dy, dx) * 180) / Math.PI };
}

export const cubic = (p0, p1, p2, p3) =>
  `M${n(p0[0])},${n(p0[1])} C${n(p1[0])},${n(p1[1])} ${n(p2[0])},${n(p2[1])} ${n(p3[0])},${n(p3[1])}`;

/**
 * Contorno cerrado y suave que pasa por `pts` (Catmull-Rom convertido a Bézier cúbica).
 * Es la base de los lavados de acuarela: un círculo con radio perturbado deja de ser un círculo.
 */
export function closedSpline(pts, tension = 1) {
  const N = pts.length;
  let d = `M${n(pts[0][0])},${n(pts[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C${n(c1[0])},${n(c1[1])} ${n(c2[0])},${n(c2[1])} ${n(p2[0])},${n(p2[1])}`;
  }
  return d + ' Z';
}

/** Mancha irregular: círculo de radio perturbado por el PRNG y suavizado con `closedSpline`. */
export function blobPath(cx, cy, r, { puntos = 11, jitter = 0.22, aplanado = 1, semilla = 1 } = {}) {
  const rnd = prng(semilla);
  const pts = [];
  for (let i = 0; i < puntos; i++) {
    const a = (i / puntos) * Math.PI * 2;
    const rr = r * (1 - jitter / 2 + rnd() * jitter);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * aplanado]);
  }
  return closedSpline(pts);
}

// -------------------------------------------------------------------------------------- botánica

/**
 * Hoja de almendra, en coordenadas locales: nace en (0,0) y apunta a (+largo, 0).
 * Dos cúbicas simétricas. Es la unidad de toda la botánica de estas plantillas.
 */
export function leafPath(largo, ancho) {
  const L = largo, W = ancho / 2;
  return (
    `M0,0 C${n(L * 0.22)},${n(-W)} ${n(L * 0.72)},${n(-W * 0.82)} ${n(L)},0 ` +
    `C${n(L * 0.72)},${n(W * 0.82)} ${n(L * 0.22)},${n(W)} 0,0 Z`
  );
}

/** Hoja rellena (masa de color: el lenguaje de `xv-jardin`). */
export const leafSolid = (x, y, largo, ancho, ang, fill, op = 1) =>
  `<g transform="translate(${n(x)},${n(y)}) rotate(${n(ang)})"><path d="${leafPath(largo, ancho)}" fill="${fill}" fill-opacity="${n(op)}"/></g>`;

/** Hoja de contorno con nervadura central (el lenguaje de línea de `boda-clasica`). */
export function leafOutline(x, y, largo, ancho, ang, stroke, w = 1.4, op = 0.85) {
  return (
    `<g transform="translate(${n(x)},${n(y)}) rotate(${n(ang)})">` +
    `<path d="${leafPath(largo, ancho)}" fill="none" stroke="${stroke}" stroke-opacity="${n(op)}" stroke-width="${n(w)}" stroke-linejoin="round"/>` +
    `<path d="M${n(largo * 0.08)},0 L${n(largo * 0.86)},0" stroke="${stroke}" stroke-opacity="${n(op * 0.55)}" stroke-width="${n(w * 0.6)}"/>` +
    `</g>`
  );
}

/** Hoja redonda de eucalipto: elipse ligeramente ovalada sobre su peciolo. */
export const leafRound = (x, y, r, ang, fill, op = 1, aplan = 0.86) =>
  `<g transform="translate(${n(x)},${n(y)}) rotate(${n(ang)})"><ellipse cx="${n(r)}" cy="0" rx="${n(r)}" ry="${n(r * aplan)}" fill="${fill}" fill-opacity="${n(op)}"/></g>`;

/**
 * Rama: tallo de Bézier cúbica más hojas con merma de tamaño hacia la punta.
 * `estilo`: 'line' (contorno, boda) | 'solid' (relleno, XV) | 'round' (eucalipto).
 *
 * Dos detalles que separan una rama dibujada de un peine de hojas: las hojas van ALTERNAS (no en
 * pares perfectos en cada nudo) y tanto su ángulo como su tamaño llevan una perturbación
 * determinista del PRNG. Sin eso, la rama se lee como una espina de pescado.
 */
export function branch(p0, p1, p2, p3, opciones = {}) {
  const {
    hojas = 11, largo = 46, ancho = 17, apertura = 52, merma = 0.5, desde = 0.12, hasta = 0.97,
    color = '#6B7B4A', color2 = null, op = 0.9, estilo = 'line', trazo = 1.5, tallo = 1.4,
    tallOp = 0.75, terminal = true, alterna = true, jitterAng = 13, jitterTam = 0.22,
    semilla = 17, bayas = 0, bayaR = 4, bayaColor = null, bayaOp = 0.75,
  } = opciones;
  const rnd = prng(semilla);
  let s = `<path d="${cubic(p0, p1, p2, p3)}" fill="none" stroke="${color}" stroke-opacity="${n(tallOp)}" stroke-width="${n(tallo)}" stroke-linecap="round"/>`;
  const dibuja = (x, y, a, k, c, o) => {
    if (estilo === 'solid') return leafSolid(x, y, largo * k, ancho * k, a, c, o);
    if (estilo === 'round') return leafRound(x, y, (ancho * k) / 2, a, c, o);
    return leafOutline(x, y, largo * k, ancho * k, a, c, trazo, o);
  };
  for (let i = 0; i < hojas; i++) {
    const t = desde + ((hasta - desde) * i) / Math.max(1, hojas - 1);
    const { x, y, ang } = cubicAt(p0, p1, p2, p3, t);
    const base = (1 - merma * t) * (1 - jitterTam / 2 + rnd() * jitterTam);
    const c = color2 && i % 2 === 1 ? color2 : color;
    const lados = alterna ? [i % 2 === 0 ? -1 : 1] : [-1, 1];
    for (const lado of lados) {
      const a = ang + lado * (apertura + (rnd() - 0.5) * jitterAng);
      s += dibuja(x, y, a, base * (0.9 + rnd() * 0.2), c, op * (0.86 + rnd() * 0.14));
    }
    // hoja de refuerzo en el lado contrario, más pequeña y más abierta: densidad sin simetría
    if (alterna && rnd() < 0.55) {
      const lado = i % 2 === 0 ? 1 : -1;
      s += dibuja(x, y, ang + lado * (apertura + 18 + (rnd() - 0.5) * jitterAng), base * 0.62, color2 ?? c, op * 0.7);
    }
  }
  if (terminal) {
    const { x, y, ang } = cubicAt(p0, p1, p2, p3, 1);
    s += dibuja(x, y, ang, (1 - merma) * 0.86, color, op);
  }
  if (bayas > 0) {
    const bc = bayaColor ?? color;
    for (let i = 0; i < bayas; i++) {
      const t = desde + (hasta - desde) * ((i + 0.5) / bayas);
      const { x, y, ang } = cubicAt(p0, p1, p2, p3, t);
      const lado = i % 2 === 0 ? 1 : -1;
      const d = bayaR * 2.6 * (0.8 + rnd() * 0.5);
      const bx = x + Math.cos(rad(ang + lado * 82)) * d, by = y + Math.sin(rad(ang + lado * 82)) * d;
      s += `<line x1="${n(x)}" y1="${n(y)}" x2="${n(bx)}" y2="${n(by)}" stroke="${bc}" stroke-opacity="${n(bayaOp * 0.55)}" stroke-width="${n(Math.max(0.8, tallo * 0.7))}"/>`;
      s += `<circle cx="${n(bx)}" cy="${n(by)}" r="${n(bayaR * (0.75 + rnd() * 0.5))}" fill="${bc}" fill-opacity="${n(bayaOp)}"/>`;
    }
  }
  return s;
}

/** Zarcillo: espiral logarítmica abierta. Lo que remata una rama de papelería grabada. */
export function tendril(x, y, escala, ang, color, w = 1.3, op = 0.6, vueltas = 1.6, sentido = 1) {
  const pasos = 40;
  let d = '';
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const a = t * vueltas * Math.PI * 2 * sentido;
    const r = 46 * Math.exp(-2.05 * t);
    const px = 46 - r * Math.cos(a) * sentido, py = -r * Math.sin(a);
    d += (i === 0 ? 'M' : 'L') + n(px) + ',' + n(py);
  }
  return (
    `<g transform="translate(${n(x)},${n(y)}) rotate(${n(ang)}) scale(${n(escala)})">` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${n(op)}" stroke-width="${n(w / escala)}" stroke-linecap="round"/></g>`
  );
}

/**
 * Flor de acuarela estilizada (peonía / rosa de jardín): tres coronas de pétalos de tamaño
 * decreciente, giradas media vuelta entre sí, más un corazón oscuro. Cada pétalo es la misma
 * almendra de `leafPath`, que es lo que da unidad al sistema.
 */
export function petalPath(largo, ancho) {
  const L = largo, W = ancho / 2;
  return (
    `M0,0 C${n(L * 0.06)},${n(-W * 0.72)} ${n(L * 0.58)},${n(-W)} ${n(L * 0.94)},${n(-W * 0.42)} ` +
    `C${n(L * 1.06)},${n(-W * 0.14)} ${n(L * 1.06)},${n(W * 0.14)} ${n(L * 0.94)},${n(W * 0.42)} ` +
    `C${n(L * 0.58)},${n(W)} ${n(L * 0.06)},${n(W * 0.72)} 0,0 Z`
  );
}

export function flower(cx, cy, r, { base, centro, semilla = 5, coronas = 3, petalos = 7, op = 0.55, giro = 0, washId = null } = {}) {
  const rnd = prng(semilla);
  let s = '';
  // Charco de pigmento bajo la flor: es lo que la separa de un gráfico vectorial plano y la
  // convierte en una acuarela — el color se acumula donde el pincel se detuvo.
  if (washId) {
    s += `<path d="${blobPath(cx, cy, r * 1.02, { jitter: 0.34, semilla: semilla + 41 })}" fill="${base}" fill-opacity="${n(op * 0.5)}" filter="url(#${washId})"/>`;
  }
  for (let c = 0; c < coronas; c++) {
    const k = 1 - c * 0.24;
    const paso = 360 / petalos;
    for (let i = 0; i < petalos; i++) {
      const a = giro + i * paso + c * (paso / 2 + 11) + (rnd() - 0.5) * 16;
      const largo = r * k * (0.80 + rnd() * 0.34);
      const ancho = r * k * (0.68 + rnd() * 0.26);
      // El pétalo NUNCA se mezcla con el color del corazón: hacerlo apagaba la flor hasta dejarla
      // de un gris indefinido. La profundidad se consigue oscureciendo el propio tono del pétalo.
      const tono = c === 0 ? lighten(base, 0.26) : mix(base, darken(base, 0.30), (c - 1) / Math.max(1, coronas - 1));
      // el pétalo no nace en el centro exacto: se desplaza hacia fuera, como en una flor real
      const d = r * 0.10 * c;
      const px = cx + Math.cos(rad(a)) * d, py = cy + Math.sin(rad(a)) * d;
      s += `<g transform="translate(${n(px)},${n(py)}) rotate(${n(a)})">` +
        `<path d="${petalPath(largo, ancho)}" fill="${tono}" fill-opacity="${n(op * (0.74 + 0.26 * c) * (0.85 + rnd() * 0.3))}"/></g>`;
    }
  }
  // Velo de pigmento POR ENCIMA de los pétalos: en una acuarela el color se deposita y unifica los
  // bordes. Sin él los pétalos se leen como un gráfico vectorial plano.
  if (washId) {
    s += `<path d="${blobPath(cx, cy, r * 0.78, { jitter: 0.40, semilla: semilla + 83 })}" fill="${darken(base, 0.18)}" fill-opacity="${n(op * 0.22)}" filter="url(#${washId})"/>`;
  }
  // corazón: dos discos y unos estambres cortos
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.22)}" fill="${centro}" fill-opacity="${n(Math.min(1, op * 0.9))}"/>`;
  s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.11)}" fill="${darken(centro, 0.2)}" fill-opacity="${n(Math.min(1, op * 1.35))}"/>`;
  for (let i = 0; i < 9; i++) {
    const a = giro * 1.7 + i * 40 + rnd() * 14;
    const rr = r * (0.19 + rnd() * 0.11);
    s += `<circle cx="${n(cx + Math.cos(rad(a)) * rr)}" cy="${n(cy + Math.sin(rad(a)) * rr)}" r="${n(r * 0.028)}" fill="${darken(centro, 0.3)}" fill-opacity="${n(Math.min(1, op * 1.2))}"/>`;
  }
  return s;
}

/** Nube de florecillas (nube de novia): puntos con tallo corto. Rellena huecos sin pesar. */
export function fillerDots(cx, cy, r, { cuenta = 14, color = '#FFFFFF', op = 0.8, semilla = 9, punto = 4 } = {}) {
  const rnd = prng(semilla);
  let s = '';
  for (let i = 0; i < cuenta; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = r * Math.sqrt(rnd());
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8;
    s += `<line x1="${n(cx)}" y1="${n(cy)}" x2="${n(x)}" y2="${n(y)}" stroke="${color}" stroke-opacity="${n(op * 0.30)}" stroke-width="1"/>`;
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(punto * (0.6 + rnd() * 0.7))}" fill="${color}" fill-opacity="${n(op)}"/>`;
  }
  return s;
}

// ------------------------------------------------------------------------------------- ornamentos

/**
 * Voluta de filigrana, en coordenadas locales, mirando hacia +x/-y. La curva está trazada a mano:
 * es el rizo de una esquina de papelería grabada, no un arco de circunferencia.
 */
export function flourish(x, y, escala, ang, color, w = 1.6, op = 0.7, hoja = null) {
  const tallo = [[0, 0], [58, -6], [104, -34], [128, -74]];
  let s = `<g transform="translate(${n(x)},${n(y)}) rotate(${n(ang)}) scale(${n(escala)})">`;
  s += `<path d="${cubic(...tallo)}" fill="none" stroke="${color}" stroke-opacity="${n(op)}" stroke-width="${n(w / escala)}" stroke-linecap="round"/>`;
  // contracurva, más corta: dos líneas que se cruzan es lo que hace que un rizo parezca grabado
  s += `<path d="${cubic([6, 4], [46, 22], [86, 16], [112, -10])}" fill="none" stroke="${color}" stroke-opacity="${n(op * 0.66)}" stroke-width="${n((w * 0.7) / escala)}" stroke-linecap="round"/>`;
  const c = hoja ?? color;
  for (const [t, lado] of [[0.30, -1], [0.55, 1], [0.78, -1]]) {
    const { x: px, y: py, ang: pa } = cubicAt(...tallo, t);
    const k = 1 - t * 0.45;
    s += leafOutline(px, py, 46 * k, 16 * k, pa + lado * 54, c, (w * 0.85) / escala, op * 0.9);
  }
  const punta = cubicAt(...tallo, 1);
  s += `</g>`;
  s += tendril(x + (punta.x * Math.cos(rad(ang)) - punta.y * Math.sin(rad(ang))) * escala,
               y + (punta.x * Math.sin(rad(ang)) + punta.y * Math.cos(rad(ang))) * escala,
               escala * 0.62, ang + punta.ang, color, w, op * 0.8, 1.35);
  return s;
}

/** Filete horizontal con rombo al centro: el separador clásico de una invitación impresa. */
export function rule(cx, cy, ancho, color, op = 0.6, w = 1.2) {
  const x0 = cx - ancho / 2, x1 = cx + ancho / 2, s = ancho * 0.022;
  return (
    `<g>` +
    `<line x1="${n(x0)}" y1="${n(cy)}" x2="${n(cx - s * 1.9)}" y2="${n(cy)}" stroke="${color}" stroke-opacity="${n(op)}" stroke-width="${n(w)}"/>` +
    `<line x1="${n(cx + s * 1.9)}" y1="${n(cy)}" x2="${n(x1)}" y2="${n(cy)}" stroke="${color}" stroke-opacity="${n(op)}" stroke-width="${n(w)}"/>` +
    `<path d="M${n(cx)},${n(cy - s)} L${n(cx + s)},${n(cy)} L${n(cx)},${n(cy + s)} L${n(cx - s)},${n(cy)} Z" fill="${color}" fill-opacity="${n(op)}"/>` +
    `<circle cx="${n(cx - s * 2.9)}" cy="${n(cy)}" r="${n(w * 1.1)}" fill="${color}" fill-opacity="${n(op * 0.8)}"/>` +
    `<circle cx="${n(cx + s * 2.9)}" cy="${n(cy)}" r="${n(w * 1.1)}" fill="${color}" fill-opacity="${n(op * 0.8)}"/>` +
    `</g>`
  );
}

/** Doble filete de marco, el borde de la papelería fina. */
export function doubleFrame(w, h, inset, color, op = 0.5) {
  const i2 = inset + Math.min(w, h) * 0.016;
  return (
    `<rect x="${n(inset)}" y="${n(inset)}" width="${n(w - inset * 2)}" height="${n(h - inset * 2)}" fill="none" stroke="${color}" stroke-opacity="${n(op)}" stroke-width="2.2"/>` +
    `<rect x="${n(i2)}" y="${n(i2)}" width="${n(w - i2 * 2)}" height="${n(h - i2 * 2)}" fill="none" stroke="${color}" stroke-opacity="${n(op * 0.62)}" stroke-width="1"/>`
  );
}

/** Ventana en arco (medio punto sobre jambas rectas): el recurso más reconocible del género. */
export function archPath(x0, y0, x1, y1) {
  const rx = (x1 - x0) / 2, cx = (x0 + x1) / 2, yc = y0 + rx;
  return (
    `M${n(x0)},${n(y1)} L${n(x0)},${n(yc)} A${n(rx)},${n(rx)} 0 0 1 ${n(x1)},${n(yc)} L${n(x1)},${n(y1)} Z`
  );
}

/**
 * Arco apuntado (ojival) de jardín, trazado con cúbicas y no con `A`: los arcos de circunferencia
 * daban una silueta de tejadillo, y lo que se busca es la curva continua de un mirador —
 * arranque vertical, hombro ancho y punta.
 */
export function ogeePath(x0, y0, x1, y1) {
  const cx = (x0 + x1) / 2, w = x1 - x0, arranque = y0 + w * 0.46;
  return (
    `M${n(x0)},${n(y1)} L${n(x0)},${n(arranque)} ` +
    `C${n(x0)},${n(arranque - w * 0.30)} ${n(cx - w * 0.30)},${n(y0 + w * 0.05)} ${n(cx)},${n(y0)} ` +
    `C${n(cx + w * 0.30)},${n(y0 + w * 0.05)} ${n(x1)},${n(arranque - w * 0.30)} ${n(x1)},${n(arranque)} ` +
    `L${n(x1)},${n(y1)} Z`
  );
}

/** Corona circular de hojas, abierta arriba. Motivo canónico de una invitación de XV. */
export function wreath(cx, cy, r, { hojas = 13, color, color2, largo = 54, ancho = 22, op = 0.75, estilo = 'solid', abertura = 34 } = {}) {
  let s = '';
  for (const lado of [-1, 1]) {
    for (let i = 0; i <= hojas; i++) {
      const t = i / hojas;
      const a = 90 + lado * (abertura + t * (330 - abertura * 2)) * 0.5;
      const x = cx + Math.cos(rad(a)) * r, y = cy + Math.sin(rad(a)) * r;
      const k = 0.55 + 0.45 * Math.sin(t * Math.PI);
      const tang = a + 90 * lado + lado * 16;
      const c = i % 2 === 0 ? color : color2 ?? color;
      if (estilo === 'solid') s += leafSolid(x, y, largo * k, ancho * k, tang, c, op);
      else if (estilo === 'round') s += leafRound(x, y, (ancho * k) / 2, tang, c, op);
      else s += leafOutline(x, y, largo * k, ancho * k, tang, c, 1.5, op);
    }
  }
  return s;
}

/** Enrejado de jardín: celosía de listones cruzados, recortada por una máscara. */
export function trellis(x0, y0, x1, y1, paso, color, op = 0.22, w = 2) {
  let s = '';
  for (let d = -(y1 - y0); d < x1 - x0 + (y1 - y0); d += paso) {
    s += `<line x1="${n(x0 + d)}" y1="${n(y0)}" x2="${n(x0 + d + (y1 - y0))}" y2="${n(y1)}" stroke="${color}" stroke-opacity="${n(op)}" stroke-width="${n(w)}"/>`;
    s += `<line x1="${n(x0 + d)}" y1="${n(y1)}" x2="${n(x0 + d + (y1 - y0))}" y2="${n(y0)}" stroke="${color}" stroke-opacity="${n(op)}" stroke-width="${n(w)}"/>`;
  }
  return s;
}

// ------------------------------------------------------------------------------------------ texto

/** Una línea de texto centrada, con la tipografía real del `fontSet` de la plantilla. */
export const textLine = (x, y, texto, { familia, tam, color, op = 1, peso = 400, esp = 0, italic = false, anchor = 'middle' }) =>
  `<text x="${n(x)}" y="${n(y)}" font-family="${esc(familia)}" font-size="${n(tam)}" font-weight="${peso}"` +
  `${italic ? ' font-style="italic"' : ''} letter-spacing="${n(esp)}" text-anchor="${anchor}" fill="${color}" fill-opacity="${n(op)}">${esc(texto)}</text>`;

// ------------------------------------------------------------------------------------ composición

/** Envoltorio de documento SVG. `defs` y `body` son cadenas ya montadas. */
export const doc = (w, h, defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<defs>${defs}</defs>${body}</svg>`;

export { mix, lighten, darken };
