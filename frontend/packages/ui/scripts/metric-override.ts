// packages/ui/scripts/metric-override.ts — metric override de las tres fuentes de respaldo
// («Fraunces Fallback», «Onest Fallback», «Red Hat Mono Fallback»), `11 §2.4` y `ADR-3C-0-02`
// («font-display: swap con metric override en texto y etiqueta»). Aplicado también a la display
// porque el mismo salto de métrica (CLS) le pasa a ella si el navegador tarda en pintar el
// `preload` (conexión lenta, fuente bloqueada).
//
// Método: el de Capsize, el mismo que usa `next/font` para sus fuentes locales
// (`next/dist/server/font-utils.js`, función `calculateSizeAdjustValues` — leída en este entorno
// del paquete `next` ya instalado, no reinventada):
//
//   mainFontAvgWidth     = xWidthAvg(real)     / unitsPerEm(real)
//   fallbackFontAvgWidth = xWidthAvg(fallback) / unitsPerEm(fallback)
//   sizeAdjust           = mainFontAvgWidth / fallbackFontAvgWidth
//   ascentOverride       = ascent(real)  / (unitsPerEm(real) * sizeAdjust)
//   descentOverride      = |descent(real)| / (unitsPerEm(real) * sizeAdjust)
//   lineGapOverride      = lineGap(real) / (unitsPerEm(real) * sizeAdjust)
//
// `size-adjust` iguala el ancho medio de carácter (`xWidthAvg`, el "az average width" de Capsize)
// de la fuente de respaldo al de la fuente real, para que el ancho de línea no salte al hacer swap
// (CLS horizontal); `ascent-override`/`descent-override`/`line-gap-override` igualan después el
// alto de línea (CLS vertical) — los tres porcentajes se expresan sobre el font-size YA escalado
// por `size-adjust`, así que hay que dividir entre `unitsPerEm * sizeAdjust`, no solo `unitsPerEm`.
//
// Métricas: `@capsizecss/metrics` (MIT, `npm view @capsizecss/metrics version license` → 4.2.0,
// MIT), variante "regular" (peso 400) de cada familia — es la variante que Capsize publica y la
// que compara `next/font`; las tres reales y sus tres locales de respaldo están en el catálogo del
// paquete (`entireMetricsCollection/{fraunces,onest,redHatMono,georgia,arial,courierNew}`), así que
// no hace falta leer ningún `.woff2` con `fontkit`.
//
//   node scripts/metric-override.ts            escribe el bloque en `src/fonts/fonts.css`
//   node scripts/metric-override.ts --check    NO escribe: falla con código 1 si diverge
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import metricasArial from "@capsizecss/metrics/arial";
import metricasCourierNew from "@capsizecss/metrics/courierNew";
import metricasFraunces from "@capsizecss/metrics/fraunces";
import metricasGeorgia from "@capsizecss/metrics/georgia";
import metricasOnest from "@capsizecss/metrics/onest";
import metricasRedHatMono from "@capsizecss/metrics/redHatMono";

interface MetricasFuente {
  readonly familyName: string;
  readonly ascent: number;
  readonly descent: number;
  readonly lineGap: number;
  readonly unitsPerEm: number;
  readonly xWidthAvg: number;
}

export interface AjusteMetrico {
  readonly ascentOverride: string;
  readonly descentOverride: string;
  readonly lineGapOverride: string;
  readonly sizeAdjust: string;
}

/** Un decimal más que `next/font` (2) sería falso preciosismo: el propio `next/font` usa 2. */
const formatearPorcentaje = (valor: number): string => `${Math.abs(valor * 100).toFixed(2)}%`;

/** El cálculo de Capsize/`next/font`, ver cabecera del fichero. */
export function calcularAjusteMetrico(real: MetricasFuente, fallback: MetricasFuente): AjusteMetrico {
  const anchoMedioReal = real.xWidthAvg / real.unitsPerEm;
  const anchoMedioFallback = fallback.xWidthAvg / fallback.unitsPerEm;
  const sizeAdjust = anchoMedioReal / anchoMedioFallback;
  const divisor = real.unitsPerEm * sizeAdjust;
  return {
    ascentOverride: formatearPorcentaje(real.ascent / divisor),
    descentOverride: formatearPorcentaje(real.descent / divisor),
    lineGapOverride: formatearPorcentaje(real.lineGap / divisor),
    sizeAdjust: formatearPorcentaje(sizeAdjust),
  };
}

export interface FuenteDeRespaldo {
  readonly nombreRespaldo: string;
  readonly real: MetricasFuente;
  /** Los `local()` del `src`, en orden (el primero es contra el que se calcula el ajuste). */
  readonly locales: readonly string[];
}

export const FUENTES_DE_RESPALDO: readonly FuenteDeRespaldo[] = [
  { nombreRespaldo: "Fraunces Fallback", real: metricasFraunces, locales: ["Georgia", "Times New Roman"] },
  { nombreRespaldo: "Onest Fallback", real: metricasOnest, locales: ["Arial"] },
  { nombreRespaldo: "Red Hat Mono Fallback", real: metricasRedHatMono, locales: ["Courier New"] },
] as const;

export const METRICAS_LOCALES: Readonly<Record<string, MetricasFuente>> = {
  Georgia: metricasGeorgia,
  "Times New Roman": metricasCourierNew, // no se usa para calcular: solo Georgia es el ajuste
  Arial: metricasArial,
  "Courier New": metricasCourierNew,
};

const INICIO = "/* INICIO metric-override (packages/ui/scripts/metric-override.ts — no editar a mano) */";
const FIN = "/* FIN metric-override */";

/** El bloque `@font-face` de las tres fuentes de respaldo, con las cifras calculadas. */
export function generarBloqueMetricOverride(): string {
  const reglas = FUENTES_DE_RESPALDO.map((f) => {
    const fallback = METRICAS_LOCALES[f.locales[0]!]!;
    const ajuste = calcularAjusteMetrico(f.real, fallback);
    const src = f.locales.map((n) => `local("${n}")`).join(", ");
    return [
      "@font-face {",
      `  font-family: "${f.nombreRespaldo}";`,
      `  src: ${src};`,
      `  ascent-override: ${ajuste.ascentOverride};`,
      `  descent-override: ${ajuste.descentOverride};`,
      `  line-gap-override: ${ajuste.lineGapOverride};`,
      `  size-adjust: ${ajuste.sizeAdjust};`,
      "}",
    ].join("\n");
  });
  return [INICIO, "", ...reglas.flatMap((r, i) => (i === 0 ? [r] : ["", r])), "", FIN].join("\n");
}

/** Reemplaza el bloque marcado en `fonts.css` (o lo añade al final si aún no existe). */
export function insertarBloqueEnFonts(css: string, bloque: string): string {
  const inicio = css.indexOf(INICIO);
  const fin = css.indexOf(FIN);
  if (inicio !== -1 && fin !== -1) {
    return `${css.slice(0, inicio)}${bloque}${css.slice(fin + FIN.length)}`;
  }
  const separador = css.endsWith("\n") ? "\n" : "\n\n";
  return `${css}${separador}${bloque}\n`;
}

function main(): void {
  const raizUi = path.resolve(import.meta.dirname, "..");
  const rutaFonts = path.join(raizUi, "src/fonts/fonts.css");
  const actual = readFileSync(rutaFonts, "utf8");
  const bloque = generarBloqueMetricOverride();
  const comprobar = process.argv.includes("--check");

  for (const f of FUENTES_DE_RESPALDO) {
    const fallback = METRICAS_LOCALES[f.locales[0]!]!;
    const ajuste = calcularAjusteMetrico(f.real, fallback);
    console.log(
      `[metric-override] ${f.nombreRespaldo} (real ${f.real.familyName} ${f.real.ascent}/${f.real.descent}/${f.real.lineGap}/${f.real.unitsPerEm}/${f.real.xWidthAvg}` +
        ` vs ${f.locales[0]} ${fallback.ascent}/${fallback.descent}/${fallback.lineGap}/${fallback.unitsPerEm}/${fallback.xWidthAvg}` +
        `) → ascent-override: ${ajuste.ascentOverride}; descent-override: ${ajuste.descentOverride};` +
        ` line-gap-override: ${ajuste.lineGapOverride}; size-adjust: ${ajuste.sizeAdjust};`,
    );
  }

  const nuevo = insertarBloqueEnFonts(actual, bloque);
  if (comprobar) {
    if (nuevo !== actual) {
      console.error("DIFIERE src/fonts/fonts.css respecto al cálculo (ejecuta `node scripts/metric-override.ts`)");
      process.exit(1);
    }
    console.log("OK      src/fonts/fonts.css (metric override)");
    return;
  }
  writeFileSync(rutaFonts, nuevo);
  console.log(`escrito src/fonts/fonts.css (bloque metric-override, ${bloque.length} bytes)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
