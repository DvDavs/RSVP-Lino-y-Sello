// packages/sections/test/harness-c/placeholder-image.ts — imagen de relleno para el banco de
// capturas (TAREA 3 del brief 3-2c). El golden real de `boda-clasica-1.0.0` no trae fotografías
// para giftTable/suggestions/amenities/family (assetId reales, sin CDN alcanzable desde este
// entorno aislado) — un `<img>` roto o una espera de red habría arruinado la captura.
//
// `ResolvedValue.image.url` exige `^https?://…` (mismo patrón que `blocks/url.ts`
// `SAFE_HTTP_URL`, medido [V]: `ComposedBlockSchema.parse` rechaza una `data:` URI con
// `TPL_BLOCK_TYPE_MISMATCH`-like ZodError). Por eso la imagen NO viaja como `data:` URI: se sirve
// de verdad por HTTP desde el propio servidor de Vite del banco de capturas — `vite.config.ts`
// monta un middleware que responde `/ph/<seed>.svg` con el SVG que genera `placeholderSvgMarkup`
// (misma función, sin red externa, determinista).
function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)},${s}%,${l}%)`;
}

/** `seed` mueve el matiz para que cada tarjeta de una grilla no use la misma imagen. */
export function placeholderSvgMarkup(seed: number): string {
  const h1 = (18 + seed * 37) % 360;
  const h2 = (h1 + 26) % 360;
  const h3 = (h1 + 48) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${hsl(h1, 42, 90)}"/>
        <stop offset="1" stop-color="${hsl(h2, 38, 74)}"/>
      </linearGradient>
      <filter id="b" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="34"/>
      </filter>
    </defs>
    <rect width="400" height="400" fill="url(#g)"/>
    <g filter="url(#b)">
      <circle cx="130" cy="150" r="95" fill="${hsl(h3, 55, 80)}" opacity="0.75"/>
      <circle cx="300" cy="270" r="120" fill="${hsl(h2, 48, 62)}" opacity="0.7"/>
      <circle cx="260" cy="90" r="75" fill="${hsl(h1, 60, 93)}" opacity="0.6"/>
    </g>
  </svg>`;
}

/** URL http(s) real y estable, servida por el propio Vite dev server de este banco (nunca red
 *  externa) — apta para `ResolvedValue.image.url` (exige `^https?://…`). Solo para navegador:
 *  `window` no existe cuando este módulo se evalúa en Node (Vitest) — no se usa ahí. */
export function placeholderPhoto(seed: number): string {
  return `${window.location.origin}/ph/${seed}.svg`;
}
