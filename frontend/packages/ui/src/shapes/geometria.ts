// packages/ui/src/shapes/geometria.ts — la MATEMÁTICA de la biblioteca de formas.
//
// `blob()`, `sello()` y `rayos()` se trasladan LITERALMENTE desde
// `docs/rediseno-plantillas/evidencia/fase-3c/moodboard/construir.mjs` (mismo cuerpo, mismos
// valores por defecto, mismo redondeo a un decimal), tal y como manda `11 §3` y `handoffs/3c-0.md`
// («la matemática de blob, sello y rayos vive hoy en `moodboard/construir.mjs` y se traslada tal
// cual»). Cambiar aquí un decimal cambia todos los dibujos del moodboard: no se «mejora» sin ADR.
//
// Todo es DETERMINISTA (ADR-3C-0-03): el mismo `seed` da el mismo `path` en servidor y en cliente,
// así que no hay discrepancia de hidratación y la regresión visual es estable. Nada de `Math.random()`.
//
// Este módulo es SOLO geometría: no conoce React, ni tokens, ni colores.

/** Un punto en el sistema de coordenadas del `viewBox` (normalmente 0-100). */
export type Punto = readonly [x: number, y: number];

/** Redondeo común a un decimal: mantiene los `path` cortos y comparables entre corridas. */
const f = (v: number): string => v.toFixed(1);

/**
 * PRNG determinista (mulberry32): misma `seed`, misma secuencia, en servidor y en cliente.
 * Copiado de `construir.mjs`.
 */
export function prng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Blob orgánico: `n` puntos en polar con radio y ángulo perturbados por el PRNG; cierre suave
 * Catmull-Rom → Bézier cúbica. Copiado de `construir.mjs`.
 */
export function blob(seed = 1, n = 7, amp = 0.22, r = 42, cx = 50, cy = 50): string {
  const rnd = prng(seed);
  const pts: Punto[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * (Math.PI / n);
    const rr = r * (1 + (rnd() - 0.5) * 2 * amp);
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Punto = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Punto = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + " Z";
}

/**
 * Sello festoneado (estrella suave): `r(θ) = R + a·cos(nθ)`, muestreado a `pasos` puntos.
 * Máscara de foto, fondo de insignia y de estado vacío. Copiado de `construir.mjs`.
 */
export function sello(n = 12, a = 4, R = 44, cx = 50, cy = 50, pasos = 240): string {
  let d = "";
  for (let i = 0; i <= pasos; i++) {
    const th = (i / pasos) * Math.PI * 2;
    const r = R + a * Math.cos(n * th);
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(th)).toFixed(1)} ${(cy + r * Math.sin(th)).toFixed(1)}`;
  }
  return d + " Z";
}

/**
 * Rayos radiales: `n` cuñas alternas de radio `R` centradas en (0,0); la otra mitad la pinta el
 * fondo del contenedor. Copiado de `construir.mjs`.
 */
export function rayos(n = 12, R = 120): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i * 2 * Math.PI) / n;
    const a1 = a0 + Math.PI / n;
    d += `M0 0 L${f(R * Math.cos(a0))} ${f(R * Math.sin(a0))} A${R} ${R} 0 0 1 ${f(R * Math.cos(a1))} ${f(R * Math.sin(a1))} Z `;
  }
  return d.trim();
}

/**
 * Polígono de esquinas redondeadas (`Q` en cada vértice). Base de `Triangle`: el moodboard dibuja
 * el triángulo con vértices duros, pero `11 §3.1` pide `radius` (`<Triangle radius={12} />`) y una
 * esquina de 12 unidades es lo que separa «papel picado» de «clipart». Con `radio = 0` devuelve
 * exactamente el polígono duro del moodboard.
 */
export function poligonoRedondeado(puntos: readonly Punto[], radio = 0): string {
  const n = puntos.length;
  if (n < 3) throw new Error("poligonoRedondeado necesita al menos tres puntos");
  let d = "";
  for (let i = 0; i < n; i++) {
    const anterior = puntos[(i - 1 + n) % n];
    const actual = puntos[i];
    const siguiente = puntos[(i + 1) % n];
    const entrada = avanzar(actual, anterior, radio);
    const salida = avanzar(actual, siguiente, radio);
    d += i === 0 ? `M${f(entrada[0])} ${f(entrada[1])}` : ` L${f(entrada[0])} ${f(entrada[1])}`;
    if (radio > 0) d += ` Q${f(actual[0])} ${f(actual[1])} ${f(salida[0])} ${f(salida[1])}`;
  }
  return d + " Z";
}

/** Punto a `radio` unidades de `desde` en dirección a `hacia`, sin pasarse de la mitad del lado. */
function avanzar(desde: Punto, hacia: Punto, radio: number): Punto {
  const dx = hacia[0] - desde[0];
  const dy = hacia[1] - desde[1];
  const largo = Math.hypot(dx, dy) || 1;
  const r = Math.min(radio, largo / 2);
  return [desde[0] + (dx / largo) * r, desde[1] + (dy / largo) * r];
}

/**
 * Triángulo isósceles inscrito en el `viewBox` de 100, con esquinas redondeadas.
 * Vértices del moodboard normalizados: cúspide arriba, base apoyada.
 */
export function triangulo(radio = 12, lado = 100): string {
  const m = (100 - lado) / 2;
  return poligonoRedondeado(
    [
      [m + lado / 2, m + lado * 0.06],
      [m + lado * 0.96, m + lado * 0.92],
      [m + lado * 0.04, m + lado * 0.92],
    ],
    radio,
  );
}

/**
 * Cuadrado (rotado por el componente) inscrito en el `viewBox` de 100 con esquinas redondeadas.
 * `lado` se calcula con `ladoInscrito()` para que la rotación no recorte las esquinas.
 */
export function cuadradoRedondeado(lado: number, radio: number, cx = 50, cy = 50): string {
  const h = lado / 2;
  return poligonoRedondeado(
    [
      [cx - h, cy - h],
      [cx + h, cy - h],
      [cx + h, cy + h],
      [cx - h, cy + h],
    ],
    Math.min(radio, h),
  );
}

/**
 * Lado máximo de un cuadrado que, girado `grados`, sigue cabiendo entero en una caja de `caja`
 * unidades. Sin esto, `<RotatedSquare rotate={12} />` se sale del bloque y rompe la regla 3 de
 * `11 §3.4` («se recorta al contenedor y nunca sale del bloque»).
 */
export function ladoInscrito(grados: number, caja = 100): number {
  const r = (grados * Math.PI) / 180;
  return caja / (Math.abs(Math.cos(r)) + Math.abs(Math.sin(r)));
}

/**
 * Arco (máscara de foto `arch`): rectángulo con la cabecera semicircular. `inset` mete la forma
 * dentro de la caja (0 = ocupa el `viewBox` entero, que es lo que quiere una fotografía).
 */
export function arco(inset = 0, base = 100, caja = 100): string {
  const r = (caja - inset * 2) / 2;
  const hombro = inset + r;
  return `M${f(inset)} ${f(base)} V${f(hombro)} A${f(r)} ${f(r)} 0 0 1 ${f(caja - inset)} ${f(hombro)} V${f(base)} Z`;
}

/** Los tres perfiles FIJOS de onda de `11 §3.2`. No se admite un `path` libre. */
export type PerfilOnda = "suave" | "marcada" | "doble";

/**
 * Curvas de las ondas en un `viewBox` de 200 × 90 (`preserveAspectRatio="none"`, así que la altura
 * real la fija el componente entre 60 y 90 px). `fondo` es la capa de atrás (solo con `layers={2}`)
 * y `frente` la que entrega el color de la sección siguiente.
 *
 * Trazadas a partir de las dos ondas dibujadas en `moodboard/partes/04-formas.html`
 * (`viewBox 0 0 200 150`), reescaladas a 90 de alto.
 */
export const ONDAS: Readonly<Record<PerfilOnda, { readonly fondo: string; readonly frente: string }>> = {
  suave: {
    fondo: "M0 40 C50 16 90 60 140 36 C170 22 186 42 200 34 V90 H0 Z",
    frente: "M0 56 C50 32 90 76 140 52 C170 38 186 58 200 50 V90 H0 Z",
  },
  marcada: {
    fondo: "M0 44 C40 -8 82 68 124 26 C156 -4 178 42 200 12 V90 H0 Z",
    frente: "M0 62 C40 10 82 86 124 44 C156 14 178 60 200 30 V90 H0 Z",
  },
  doble: {
    fondo: "M0 30 C50 6 90 50 140 26 C170 12 186 32 200 24 V90 H0 Z",
    frente: "M0 58 C40 40 80 78 130 52 C166 34 182 58 200 50 V90 H0 Z",
  },
};
