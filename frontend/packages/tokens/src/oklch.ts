// src/oklch.ts — conversión OKLCH → sRGB (Björn Ottosson, 2020) y codificación gamma sRGB.
//
// PROCEDENCIA: es la misma matemática de `docs/rediseno-plantillas/evidencia/fase-3c/moodboard/
// generar-escalas.mjs`, trasladada a TypeScript sin cambiar una constante. Los hex que produce
// tienen que coincidir dígito a dígito con `paletas.generadas.mjs` de esa carpeta (lo comprueba
// `test/paletas.test.ts` importando el fichero de evidencia). No la "mejores": si cambia, cambian
// las escalas, y con ellas los contrastes ya verificados de `11 §1.6`.

/** OKLCH (L 0-1, C, h en grados) → sRGB LINEAL (sin recortar, puede salirse del gamut). */
export function oklchALinear(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Codificación gamma sRGB de un canal lineal. */
export const gamma = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** ¿Cabe el color en el gamut sRGB (con la tolerancia del generador original)? */
export const enGamut = (rgb: readonly number[]): boolean => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);

/**
 * OKLCH → `#rrggbb`. Recorte al gamut sRGB por bisección BAJANDO SOLO EL CROMA: la luminosidad y
 * el matiz nunca se tocan, que es lo que garantiza que el paso 600 de cualquier matiz tenga el
 * mismo peso visual y las mismas garantías de contraste (`11 §1.1`).
 */
export function oklchAHex(L: number, C: number, h: number): string {
  let lo = 0;
  let hi = C;
  let rgb = oklchALinear(L, C, h);
  if (!enGamut(rgb)) {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      rgb = oklchALinear(L, mid, h);
      if (enGamut(rgb)) lo = mid;
      else hi = mid;
    }
    rgb = oklchALinear(L, lo, h);
  }
  return (
    "#" +
    rgb
      .map((c) =>
        Math.round(Math.max(0, Math.min(1, gamma(c))) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
