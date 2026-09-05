// @invitaciones/ui/fonts/preload — manifiesto de las fuentes autoalojadas del CHROME (fase 3-C,
// bloque 1, 3C-2). Fuente única de verdad para: (a) los `@font-face` de `./fonts.css` (mismos
// ficheros y rutas), (b) el script de copia `scripts/copiar-fuentes-publicas.ts` y (c) las pruebas
// de peso/existencia. `11 §2.1/§2.3/§2.4`.
//
// Elección (ADR-3C-2-01, ajuste del orquestador sobre ADR-3C-0-02): Fraunces (display) + Onest
// (texto) + Red Hat Mono (etiqueta), las tres `@fontsource-variable`, licencia OFL-1.1, subconjunto
// LATINO (es-MX) + LATIN-EXT (robustez ante nombres/topónimos con diacríticos fuera de Latin-1).
// Fraunces se sirve con el fichero `full` (ejes wght+opsz+SOFT+WONK, 121 016 B) porque la escala de
// `11 §2.2` usa SOFT y WONK en varios roles; la alternativa más ligera sin esos dos ejes es
// `fraunces-latin-opsz-normal.woff2` (67 304 B, wght+opsz únicamente) — queda anotada aquí por si el
// dueño decide más adelante renunciar a SOFT/WONK para bajar el presupuesto de 177 KB a 123 KB.
//
// Por qué NO se sirven con `next/font`: `next/font/local` reescribe la URL de la fuente con un
// origen que el lienzo aislado (`(canvas)`, `Origin: null`) no puede pedir en modo CORS sin
// `crossOrigin` explícito en el propio recurso, y aquí no hace falta ese mecanismo porque el chrome
// es un documento normal del mismo origen. En su lugar: ficheros estáticos servidos por `apps/web`
// en `/fonts/*` (mismo mecanismo que ya usa `next.config.ts` para el CORS de `/fonts/:path*`, hoy
// reservado al lienzo) con rutas ESTABLES conocidas en tiempo de build — así `preload.ts` puede
// anunciar el `href` exacto del `<link rel="preload">` sin depender del hash que el pipeline de CSS
// de Next asigna a los assets importados con `url()`.
//
// El script `scripts/copiar-fuentes-publicas.ts` (parte de `pnpm run build` de este paquete, antes
// de que `apps/web` construya — `turbo.json`: `build` depende de `^build`) copia estos mismos
// ficheros desde `node_modules/@fontsource-variable/*/files/` a `apps/web/public/fonts/`. Acoplo
// documentado en `handoffs/3c-2.md` y `preguntas-abiertas.md`: si en el futuro otra app consumiera
// `@invitaciones/ui`, tendría que correr el mismo script o servir los mismos ficheros en `/fonts/*`.

export type VozTipografica = "display" | "text" | "label";
export type SubconjuntoUnicode = "latin" | "latin-ext";

export interface ArchivoFuente {
  /** Voz del sistema que usa esta familia (`11 §2.2`: display/heading en `display`, texto en `text`, etiqueta en `label`). */
  readonly voz: VozTipografica;
  /** Nombre CSS de la familia, tal cual se declara en `font-family` (sin sufijo "Variable"). */
  readonly familia: string;
  /** Paquete de npm (`@fontsource-variable/*`) del que sale el fichero. */
  readonly paquete: string;
  /** Versión exacta instalada (`pnpm add -E`), para trazabilidad con `npm view`. */
  readonly version: string;
  readonly subconjunto: SubconjuntoUnicode;
  /** Nombre del `.woff2` tal cual lo publica fontsource (mismo nombre en origen y en `/fonts/*`). */
  readonly archivo: string;
  /** Peso real en bytes (verificado con `npm pack` + `tar -tzv`, `11 §2.3`). */
  readonly bytes: number;
  /** Ruta relativa a `packages/ui/` del fichero de origen (dentro de `node_modules`). */
  readonly rutaNodeModules: string;
  /** Ruta pública absoluta que sirve `apps/web` una vez corrido el script de copia. */
  readonly rutaPublica: string;
}

function archivo(
  voz: VozTipografica,
  familia: string,
  paquete: string,
  version: string,
  subconjunto: SubconjuntoUnicode,
  nombre: string,
  bytes: number,
): ArchivoFuente {
  return {
    voz,
    familia,
    paquete,
    version,
    subconjunto,
    archivo: nombre,
    bytes,
    rutaNodeModules: `node_modules/${paquete}/files/${nombre}`,
    rutaPublica: `/fonts/${nombre}`,
  };
}

/** Las seis fuentes autoalojadas del chrome: 3 familias × 2 subconjuntos (latino + latin-ext). */
export const FUENTES_AUTOALOJADAS: readonly ArchivoFuente[] = [
  archivo("display", "Fraunces", "@fontsource-variable/fraunces", "5.3.0", "latin", "fraunces-latin-full-normal.woff2", 121_016),
  archivo("display", "Fraunces", "@fontsource-variable/fraunces", "5.3.0", "latin-ext", "fraunces-latin-ext-full-normal.woff2", 105_244),
  archivo("text", "Onest", "@fontsource-variable/onest", "5.3.1", "latin", "onest-latin-wght-normal.woff2", 33_760),
  archivo("text", "Onest", "@fontsource-variable/onest", "5.3.1", "latin-ext", "onest-latin-ext-wght-normal.woff2", 28_452),
  archivo("label", "Red Hat Mono", "@fontsource-variable/red-hat-mono", "5.3.0", "latin", "red-hat-mono-latin-wght-normal.woff2", 22_412),
  archivo("label", "Red Hat Mono", "@fontsource-variable/red-hat-mono", "5.3.0", "latin-ext", "red-hat-mono-latin-ext-wght-normal.woff2", 11_720),
] as const;

/**
 * Presupuesto de primera vista (`11 §2.4`): SOLO el subconjunto latino, porque un documento en
 * es-MX no usa glifos de `latin-ext` y el navegador no descarga un `@font-face` cuyo
 * `unicode-range` no coincide con ningún carácter del documento. 121 016 + 33 760 + 22 412.
 */
export const PRESUPUESTO_PRIMERA_VISTA_BYTES = 177_188;

/**
 * Rutas para `<link rel="preload" as="font" type="font/woff2" crossorigin>`. Únicamente la voz
 * `display`, subconjunto latino (`11 §2.4`: "la display se preload-a porque pinta el `display-2xl`
 * del LCP"; texto y etiqueta van con `font-display: swap` sin preload).
 */
export const RUTAS_PRECARGA: readonly string[] = FUENTES_AUTOALOJADAS.filter(
  (f) => f.voz === "display" && f.subconjunto === "latin",
).map((f) => f.rutaPublica);
