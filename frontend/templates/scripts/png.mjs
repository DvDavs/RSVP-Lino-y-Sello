// frontend/templates/scripts/png.mjs
//
// Codificador PNG y lienzo vectorial mínimo, en Node puro y SIN DEPENDENCIAS.
// Existe porque en este entorno no hay ImageMagick, ni `sharp`, ni Pillow, ni acceso a bancos de
// imágenes (contratos.md §7): los assets de los paquetes de plantilla se GENERAN, de forma
// determinista, a partir de la paleta del `theme.json` de cada plantilla.
//
// Determinismo (es requisito duro: `package_hash` es la clave de idempotencia del registro,
// ADR-008 + ADR-1R-D-03): no se usa `Math.random` en ninguna parte. El grano es una función hash
// entera de (x, y, semilla). Dos ejecuciones producen byte a byte el mismo archivo.
//
// Licencia del resultado: obra propia generada por este script, sin derechos de terceros.

import zlib from 'node:zlib';

// ---------------------------------------------------------------- CRC32 (RFC 1952, tabla estándar)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// ------------------------------------------------------------------------------------- utilidades
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

/** sRGB → lineal y vuelta: mezclar en espacio lineal evita los degradados "sucios" de mezclar en sRGB. */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** Ruido entero determinista en [-1, 1]; sin `Math.random` (ver cabecera). */
function hashNoise(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695040888963407) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  h = (h ^ (h >>> 16)) | 0;
  return (h & 0xffff) / 32767.5 - 1;
}

// ------------------------------------------------------------------------------------------ lienzo
export class Canvas {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    // Trabaja en RGB LINEAL de coma flotante; se convierte a sRGB de 8 bits sólo al codificar.
    this.px = new Float64Array(width * height * 3);
  }

  /** Degradado lineal multiparada a lo largo del eje (ax, ay) → (bx, by), en coordenadas 0..1. */
  linearGradient(ax, ay, bx, by, stops) {
    const A = stops.map(([p, hex]) => [p, hexToRgb(hex).map((c) => toLinear(c / 255))]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let y = 0; y < this.h; y++) {
      const v = y / (this.h - 1);
      for (let x = 0; x < this.w; x++) {
        const u = x / (this.w - 1);
        let t = ((u - ax) * dx + (v - ay) * dy) / len2;
        t = clamp01(t);
        let i = 0;
        while (i < A.length - 2 && t > A[i + 1][0]) i++;
        const [p0, c0] = A[i];
        const [p1, c1] = A[i + 1];
        const k = smoothstep(0, 1, p1 === p0 ? 0 : (t - p0) / (p1 - p0));
        const o = (y * this.w + x) * 3;
        this.px[o] = mix(c0[0], c1[0], k);
        this.px[o + 1] = mix(c0[1], c1[1], k);
        this.px[o + 2] = mix(c0[2], c1[2], k);
      }
    }
    return this;
  }

  /** Mancha radial suave (los "blobs" difuminados de una papelería fina). `alpha` es el máximo. */
  radialGlow(cx, cy, rx, ry, hex, alpha, falloff = 2.0) {
    const c = hexToRgb(hex).map((v) => toLinear(v / 255));
    const CX = cx * this.w;
    const CY = cy * this.h;
    const RX = rx * this.w;
    const RY = ry * this.h;
    for (let y = 0; y < this.h; y++) {
      const ny = (y - CY) / RY;
      for (let x = 0; x < this.w; x++) {
        const nx = (x - CX) / RX;
        const d = Math.sqrt(nx * nx + ny * ny);
        if (d >= 1) continue;
        const a = alpha * Math.pow(1 - d, falloff);
        const o = (y * this.w + x) * 3;
        this.px[o] = mix(this.px[o], c[0], a);
        this.px[o + 1] = mix(this.px[o + 1], c[1], a);
        this.px[o + 2] = mix(this.px[o + 2], c[2], a);
      }
    }
    return this;
  }

  /** Viñeta: oscurece los bordes hacia `hex`, con una elipse suave centrada. */
  vignette(hex, alpha, start = 0.55) {
    const c = hexToRgb(hex).map((v) => toLinear(v / 255));
    for (let y = 0; y < this.h; y++) {
      const ny = (y / (this.h - 1)) * 2 - 1;
      for (let x = 0; x < this.w; x++) {
        const nx = (x / (this.w - 1)) * 2 - 1;
        const d = Math.sqrt(nx * nx * 0.85 + ny * ny);
        const a = alpha * smoothstep(start, 1.25, d);
        if (a <= 0) continue;
        const o = (y * this.w + x) * 3;
        this.px[o] = mix(this.px[o], c[0], a);
        this.px[o + 1] = mix(this.px[o + 1], c[1], a);
        this.px[o + 2] = mix(this.px[o + 2], c[2], a);
      }
    }
    return this;
  }

  /** Pinta con una función de cobertura (0..1) evaluada en píxel; el antialias lo pone la función. */
  paintMask(hex, alpha, coverage) {
    const c = hexToRgb(hex).map((v) => toLinear(v / 255));
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const k = coverage(x + 0.5, y + 0.5);
        if (k <= 0) continue;
        const a = alpha * (k > 1 ? 1 : k);
        const o = (y * this.w + x) * 3;
        this.px[o] = mix(this.px[o], c[0], a);
        this.px[o + 1] = mix(this.px[o + 1], c[1], a);
        this.px[o + 2] = mix(this.px[o + 2], c[2], a);
      }
    }
    return this;
  }

  /** Trazo de rectángulo redondeado (el "arco" de la papelería), con antialias por campo de distancia. */
  strokeRoundRect(x0, y0, x1, y1, radius, lineWidth, hex, alpha) {
    const X0 = x0 * this.w, X1 = x1 * this.w, Y0 = y0 * this.h, Y1 = y1 * this.h;
    const R = radius * this.w;
    const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
    const hx = (X1 - X0) / 2 - R, hy = (Y1 - Y0) / 2 - R;
    const half = lineWidth / 2;
    return this.paintMask(hex, alpha, (px, py) => {
      const qx = Math.abs(px - cx) - hx;
      const qy = Math.abs(py - cy) - hy;
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R;
      return 1 - smoothstep(half - 0.75, half + 0.75, Math.abs(d));
    });
  }

  /** Trazo de elipse. */
  strokeEllipse(cx, cy, rx, ry, lineWidth, hex, alpha) {
    const CX = cx * this.w, CY = cy * this.h, RX = rx * this.w, RY = ry * this.h;
    const half = lineWidth / 2;
    return this.paintMask(hex, alpha, (px, py) => {
      const nx = (px - CX) / RX, ny = (py - CY) / RY;
      const k = Math.sqrt(nx * nx + ny * ny);
      const d = (k - 1) * Math.min(RX, RY);
      return 1 - smoothstep(half - 0.75, half + 0.75, Math.abs(d));
    });
  }

  /**
   * Hoja con la BASE en (bx, by) y la punta en la dirección `ang` (radianes, 0 = hacia la derecha,
   * ángulos crecientes en sentido horario porque el eje Y crece hacia abajo).
   *
   * El perfil de media anchura es `sin(pi*s)^0.62` con `s` ∈ [0,1] de la base a la punta: redondeado
   * en el cuerpo y afilado en la punta, que es lo que distingue una hoja de un rombo. `len` y `wid`
   * van en fracción de la ALTURA del lienzo, para que la proporción no dependa del formato.
   */
  fillLeaf(bx, by, len, wid, ang, hex, alpha) {
    const BX = bx * this.w, BY = by * this.h;
    const L = len * this.h, W = wid * this.h;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    return this.paintMask(hex, alpha, (px, py) => {
      const dx = px - BX, dy = py - BY;
      const u = dx * ca + dy * sa;       // a lo largo del eje, 0 en la base
      const v = -dx * sa + dy * ca;      // perpendicular
      if (u < 0 || u > L) return 0;
      const s = u / L;
      const hw = W * Math.pow(Math.sin(Math.PI * s), 0.62);
      const cob = 1 - smoothstep(-0.7, 0.7, Math.abs(v) - hw);
      const punta = clamp01(Math.min(u, L - u) / 1.2);
      return cob * punta;
    });
  }

  /** Tallo/curva de Bézier cuadrática, trazada por distancia mínima muestreada. */
  strokeQuad(p0, p1, p2, lineWidth, hex, alpha) {
    const S = (p) => [p[0] * this.w, p[1] * this.h];
    const [ax, ay] = S(p0), [bx, by] = S(p1), [cx, cy] = S(p2);
    const N = 160;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, m = 1 - t;
      pts.push([m * m * ax + 2 * m * t * bx + t * t * cx, m * m * ay + 2 * m * t * by + t * t * cy]);
    }
    const half = lineWidth / 2;
    return this.paintMask(hex, alpha, (px, py) => {
      let best = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const dx = px - pts[i][0], dy = py - pts[i][1];
        const d2 = dx * dx + dy * dy;
        if (d2 < best) best = d2;
      }
      return 1 - smoothstep(half - 0.75, half + 0.75, Math.sqrt(best));
    });
  }

  /** Grano fino determinista: rompe el bandeado de los degradados y da textura de papel. */
  grain(amount, seed) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const n = hashNoise(x, y, seed) * amount;
        const o = (y * this.w + x) * 3;
        this.px[o] = clamp01(this.px[o] + n);
        this.px[o + 1] = clamp01(this.px[o + 1] + n * 0.96);
        this.px[o + 2] = clamp01(this.px[o + 2] + n * 0.92);
      }
    }
    return this;
  }

  /** RGB de 8 bits en sRGB, con difuminado ordenado 4×4 para que no aparezcan bandas. */
  toRgb8() {
    const BAYER = [
      [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
    ];
    const out = Buffer.alloc(this.w * this.h * 3);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const o = (y * this.w + x) * 3;
        const d = (BAYER[y & 3][x & 3] / 16 - 0.5) / 255;
        for (let c = 0; c < 3; c++) {
          const v = toSrgb(clamp01(this.px[o + c])) + d;
          out[o + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
        }
      }
    }
    return out;
  }

  toPng() {
    return encodePng(this.w, this.h, this.toRgb8());
  }
}

// -------------------------------------------------------------------------------- codificación PNG
/**
 * PNG truecolor de 8 bits (IHDR color type 2). Filtro por fila elegido con la heurística de suma
 * mínima de valores absolutos del propio estándar (None / Sub / Up / Average / Paeth), que es lo que
 * hace que un degradado vertical ocupe kilobytes en vez de megabytes.
 */
export function encodePng(width, height, rgb8) {
  const bpp = 3;
  const rowLen = width * bpp;
  const raw = Buffer.alloc((rowLen + 1) * height);
  const prev = Buffer.alloc(rowLen);
  const cand = [Buffer.alloc(rowLen), Buffer.alloc(rowLen), Buffer.alloc(rowLen), Buffer.alloc(rowLen), Buffer.alloc(rowLen)];

  for (let y = 0; y < height; y++) {
    const row = rgb8.subarray(y * rowLen, (y + 1) * rowLen);
    const sums = [0, 0, 0, 0, 0];
    for (let i = 0; i < rowLen; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const x = row[i];
      cand[0][i] = x;
      cand[1][i] = (x - a) & 0xff;
      cand[2][i] = (x - b) & 0xff;
      cand[3][i] = (x - ((a + b) >> 1)) & 0xff;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      cand[4][i] = (x - pr) & 0xff;
      for (let f = 0; f < 5; f++) {
        const v = cand[f][i];
        sums[f] += v < 128 ? v : 256 - v;
      }
    }
    let best = 0;
    for (let f = 1; f < 5; f++) if (sums[f] < sums[best]) best = f;
    const off = y * (rowLen + 1);
    raw[off] = best;
    cand[best].copy(raw, off + 1);
    row.copy(prev, 0);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // profundidad de bits
  ihdr[9] = 2;   // truecolor RGB
  ihdr[10] = 0;  // compresión deflate
  ihdr[11] = 0;  // filtrado adaptativo
  ihdr[12] = 0;  // sin entrelazado

  const idat = zlib.deflateSync(raw, { level: 9, memLevel: 9, strategy: zlib.constants.Z_DEFAULT_STRATEGY });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
