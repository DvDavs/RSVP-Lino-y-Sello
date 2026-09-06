// packages/schema/test/paleta-contraste.contract.test.ts — COMPUERTA de contraste WCAG 2.2 AA
// sobre los `theme.json` de referencia (bloque 4-0C).
//
// POR QUÉ EXISTE. `ADR-3-2d-04` corrigió las paletas de `frontend/templates/**` y dejó una DEUDA
// DECLARADA: `docs/rediseno-plantillas/diseno/ejemplos/` y `packages/schema/golden/` se quedaron con
// los colores que NO pasan AA, porque pertenecían a otros agentes. Medido con la fórmula canónica
// antes de esta compuerta: **51 de 99** parejas por debajo del umbral en los cinco `theme.json` de
// los dos árboles (`bitacora/4-0c.md §1`). Y esos dos árboles no son decorado: `diseno/ejemplos/` es
// la ENTRADA de `gen-golden-templates.ts`, y `golden/` es lo que el espejo Kotlin compone en
// `ComposerGoldenTest`. Son, además, "el ejemplo que copiará el kit de autor de la fase 4"
// (ADR-3-2d-04, consecuencias): un ejemplo que incumple AA se copia tal cual.
//
// La compuerta que existía (`frontend/templates/scripts/art/paleta-aa.mjs`, `themeAA`) sólo corre
// cuando se CONSTRUYEN los paquetes de `frontend/templates/`; no mira estos dos árboles. Y la
// invariante del registro `I-31_PALETTE_CONTRAST_BELOW_AA` está DECLARADA pero NO implementada
// (ADR-1R-F-06; `contratos.md §3`), así que hoy el backend registra sin rechistar una plantilla que
// incumpla AA. Esta prueba es, para estos dos árboles, el único control mecánico.
//
// QUÉ AFIRMA. Las cinco parejas de `04 §17.1` con sus umbrales tal cual están escritos, MÁS las
// cuatro de `ADR-3-3b-03` (`muted` y `accent` son COLOR DE TEXTO en `packages/sections`, luego les
// rige WCAG 1.4.3 y su umbral es 4,5:1 contra `bg` Y contra `surface`, no 3,0). Son exactamente las
// nueve de `frontend/templates/scripts/art/paleta-aa.mjs` (`PAREJAS`) y las mismas que
// `packages/sections/test/theme/contraste-plantillas.test.ts` mide sobre los paquetes reales. Aquí
// no se relaja ninguna: `contratos.md §12.4` prohíbe bajar un umbral para que algo pase.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// La fórmula NO se reescribe (habría una cuarta copia en el repo y la compuerta mediría con una
// aritmética propia). Se importa la implementación que ADR-1R-F-06 designa como la del frontend,
// junto con su tabla de las cinco parejas de `04 §17.1`. Es un import de PRUEBA por ruta relativa,
// no una dependencia del paquete: `@invitaciones/schema` no puede declarar `@invitaciones/sections`
// (sections ya depende de schema) y este fichero no entra en la superficie pública ni en la
// cobertura (`vitest.config.ts` incluye sólo `src/**`).
import {
  contrastRatio, PALETTE_AA_PAIRS, type PaletteTokens,
} from "../../sections/src/theme/contrast.ts";

const AQUI = fileURLToPath(new URL(".", import.meta.url));
const RAIZ_REPO = resolve(AQUI, "../../../..");

/**
 * Las cuatro parejas de `ADR-3-3b-03`, que ENDURECEN (nunca relajan) lo que dice `04 §17.1`.
 * Copiadas de `frontend/templates/scripts/art/paleta-aa.mjs` (`PAREJAS`, últimas cuatro entradas);
 * ese fichero es un `.mjs` sin tipos dentro de `frontend/templates/`, que no es un paquete del
 * workspace, así que no se puede importar desde aquí sin romper el aislamiento del monorepo.
 */
const PAREJAS_1_4_3: ReadonlyArray<{
  readonly pair: string; readonly a: keyof PaletteTokens; readonly b: keyof PaletteTokens;
  readonly threshold: number; readonly reason: string;
}> = [
  { pair: "muted/bg (1.4.3)", a: "muted", b: "bg", threshold: 4.5, reason: "texto secundario de tamaño normal" },
  { pair: "muted/surface (1.4.3)", a: "muted", b: "surface", threshold: 4.5, reason: "texto secundario sobre tarjetas" },
  { pair: "accent/bg (1.4.3)", a: "accent", b: "bg", threshold: 4.5, reason: "enlaces y horas en texto normal" },
  { pair: "accent/surface (1.4.3)", a: "accent", b: "surface", threshold: 4.5, reason: "los mismos, sobre tarjetas" },
];

const PAREJAS = [...PALETTE_AA_PAIRS, ...PAREJAS_1_4_3];

/**
 * Los DOS árboles de referencia. No se enumeran carpetas a mano: se recorre el árbol y se recoge
 * TODO `theme.json`. Así una plantilla de ejemplo nueva —o un golden nuevo— entra en la compuerta
 * sola, que es justo lo que falló en 3-B (la corrección se aplicó donde el agente miraba).
 */
const RAICES = [
  { etiqueta: "packages/schema/golden", dir: resolve(AQUI, "../golden") },
  { etiqueta: "diseno/ejemplos", dir: resolve(RAIZ_REPO, "docs/rediseno-plantillas/diseno/ejemplos") },
] as const;

function buscarThemes(dir: string): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) salida.push(...buscarThemes(p));
    else if (e.name === "theme.json") salida.push(p);
  }
  return salida;
}

interface ThemeJson {
  readonly palettes: ReadonlyArray<{ readonly id: string; readonly tokens: PaletteTokens }>;
}

const FICHEROS = RAICES.flatMap(({ dir }) => buscarThemes(dir));

describe("compuerta AA — theme.json de diseno/ejemplos y de packages/schema/golden", () => {
  // Sin esto, borrar los dos árboles dejaría la compuerta en verde con cero iteraciones.
  it("encuentra los theme.json de los dos árboles (hoy 5)", () => {
    expect(FICHEROS.length).toBeGreaterThanOrEqual(5);
    for (const { etiqueta, dir } of RAICES) {
      expect(buscarThemes(dir).length, `${etiqueta} no aporta ningún theme.json`).toBeGreaterThan(0);
    }
  });

  for (const fichero of FICHEROS) {
    const rel = relative(RAIZ_REPO, fichero);
    const theme = JSON.parse(readFileSync(fichero, "utf8")) as ThemeJson;

    it(`${rel}: declara al menos una paleta`, () => {
      expect(theme.palettes.length).toBeGreaterThan(0);
    });

    for (const pal of theme.palettes) {
      it(`${rel} · paleta "${pal.id}": las 9 parejas cumplen su umbral`, () => {
        const fallos = PAREJAS.flatMap(({ pair, a, b, threshold, reason }) => {
          const ratio = contrastRatio(pal.tokens[a], pal.tokens[b]);
          return ratio >= threshold
            ? []
            : [`${pair} ${pal.tokens[a]}/${pal.tokens[b]} = ${ratio.toFixed(2)}:1 < ${threshold.toFixed(1)}:1 (${reason})`];
        });
        // El mensaje enseña TODAS las parejas que caen, no sólo la primera: si una paleta se
        // rompe, quien la arregle necesita la lista entera para elegir el color de una vez.
        expect(fallos, `${rel} · ${pal.id}:\n  ${fallos.join("\n  ")}`).toEqual([]);
      });
    }
  }
});
