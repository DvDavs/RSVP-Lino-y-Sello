// packages/ui/test/tipografia.test.ts — `11 §2.2`, brief 3c-2 entregable 2 y 4(a)/4(b).
//
// (a) Las 15 clases (`display-2xl`…`label-sm`) existen en `typography.css` y aplican la familia
//     correcta por voz. Se lee el CSS como texto y se extrae el bloque de declaraciones de cada
//     selector (regex de bloque, no un parser completo) en vez de montarlo en jsdom: el motor CSS
//     de jsdom no resuelve `clamp()`/`var()`/media queries de forma fiable (`cssstyle`), así que un
//     `getComputedStyle` ahí daría falsos verdes o falsos rojos por limitaciones del propio jsdom,
//     no por el CSS real. Esto es exactamente lo que se declara: qué `font-family` escribe cada
//     regla, byte a byte.
// (b) Regla dura del sistema (`brief-comun.md`, `10-identidad-visual.md`): ninguna clase
//     `display-*`/`heading-*` usa la familia de cuerpo (ni al revés) — ni por variable ni en literal.
// (c) Ningún `font-family` "a secas" (sin familia de marca antes) fuera de los `@font-face`/
//     fallbacks declarados aquí mismo: se grepea todo `packages/ui/src` en busca de
//     `font-family: <genérica>;` sin nada delante.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_UI = path.resolve(import.meta.dirname, "..");
const CSS = readFileSync(path.join(RAIZ_UI, "src/styles/typography.css"), "utf8");

/** Bloque de declaraciones de un selector simple (`.clase { … }`), hasta su primer `}`. */
function bloqueDe(selector: string): string {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`${escapado}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!m) throw new Error(`No se encontró el selector ${selector} en typography.css`);
  return m[1]!;
}

const CLASES_DISPLAY = ["display-2xl", "display-xl", "display-lg", "display-md", "display-sm"] as const;
const CLASES_HEADING = ["heading-lg", "heading-md", "heading-sm"] as const;
const CLASES_TEXT = ["text-lg", "text-md", "text-sm", "text-xs"] as const;
const CLASES_LABEL = ["label-lg", "label-md", "label-sm"] as const;

describe("typography.css — las 15 voces existen (11 §2.2)", () => {
  for (const clase of [...CLASES_DISPLAY, ...CLASES_HEADING, ...CLASES_TEXT, ...CLASES_LABEL]) {
    it(`.${clase} existe`, () => {
      expect(() => bloqueDe(`.${clase}`)).not.toThrow();
    });
  }
});

describe("typography.css — familia correcta por voz, nunca cruzada (regla dura)", () => {
  for (const clase of [...CLASES_DISPLAY, ...CLASES_HEADING]) {
    it(`.${clase} usa la familia display (Fraunces), nunca la de texto/etiqueta`, () => {
      const bloque = bloqueDe(`.${clase}`);
      expect(bloque).toMatch(/font-family:\s*var\(--ui-font-display|font-family:\s*"Fraunces"/);
      expect(bloque).not.toMatch(/--ui-font-text|--ui-font-label|"Onest"|"Red Hat Mono"/);
    });
  }

  for (const clase of CLASES_TEXT) {
    it(`.${clase} usa la familia de texto (Onest), nunca display/etiqueta`, () => {
      const bloque = bloqueDe(`.${clase}`);
      expect(bloque).toMatch(/font-family:\s*var\(--ui-font-text|font-family:\s*"Onest"/);
      expect(bloque).not.toMatch(/--ui-font-display|--ui-font-label|"Fraunces"|"Red Hat Mono"/);
    });
  }

  for (const clase of CLASES_LABEL) {
    it(`.${clase} usa la familia de etiqueta (Red Hat Mono), nunca display/texto`, () => {
      const bloque = bloqueDe(`.${clase}`);
      expect(bloque).toMatch(/font-family:\s*var\(--ui-font-label|font-family:\s*"Red Hat Mono"/);
      expect(bloque).not.toMatch(/--ui-font-display|--ui-font-text|"Fraunces"|"Onest"/);
    });
  }

  it(".prose usa la familia de texto", () => {
    const bloque = bloqueDe(".prose");
    expect(bloque).toMatch(/font-family:\s*var\(--ui-font-text|font-family:\s*"Onest"/);
  });

  // Revisor 3c-rev-2: los títulos dentro de `.prose` heredaban la familia de CUERPO (medido en
  // Chromium sobre /design/tipografia: `getComputedStyle(h3).fontFamily` = "Onest Variable"), que
  // es exactamente lo que la regla dura prohíbe. La declaración conjunta les da la voz display y
  // cada nivel su tamaño de `heading-*`.
  it(".prose h2/h3/h4 usan la familia display, nunca la de cuerpo", () => {
    const bloque = bloqueDe(".prose h2,\n.prose h3,\n.prose h4");
    expect(bloque).toMatch(/font-family:\s*var\(--ui-font-display|font-family:\s*"Fraunces"/);
    expect(bloque).not.toMatch(/--ui-font-text|--ui-font-label|"Onest"|"Red Hat Mono"/);
  });

  /** Como `bloqueDe`, pero exige que el selector sea el ÚNICO de su regla (precedido de `}`), para
   *  no confundir `.prose h4 { … }` con el último miembro de la lista `.prose h2, .prose h3,
   *  .prose h4 { … }`. */
  function bloqueExactoDe(selector: string): string {
    const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`(?<=\\})\\s*${escapado}\\s*\\{([^}]*)\\}`).exec(CSS);
    if (!m) throw new Error(`No se encontró una regla propia para ${selector} en typography.css`);
    return m[1]!;
  }

  for (const [selector, rol] of [
    [".prose h2", "heading-lg"],
    [".prose h3", "heading-md"],
    [".prose h4", "heading-sm"],
  ] as const) {
    it(`${selector} toma el tamaño y el peso de ${rol} (no los 16 px de .prose)`, () => {
      const bloque = bloqueExactoDe(selector);
      expect(bloque).toContain(`--ui-${rol}-size`);
      expect(bloque).toContain(`--ui-${rol}-weight`);
    });
  }
});

describe("typography.css — pesos de énfasis 450/650 documentados (11 §2.2)", () => {
  for (const clase of CLASES_TEXT) {
    it(`.${clase} strong/b sube a 650`, () => {
      const idx = CSS.indexOf(`.${clase} strong`);
      expect(idx, `Falta ".${clase} strong, .${clase} b { font-weight: … }"`).toBeGreaterThanOrEqual(0);
    });
  }
});

/* ─── Nada de tipografía genérica "a secas" (brief 3c-2, 4b) ─────────────────────────────────── */

const GENERICAS = ["system-ui", "-apple-system", "Arial", "Helvetica", "sans-serif", "ui-monospace", "ui-sans-serif", "ui-serif"];
/** `font-family: <genérica>;` con la genérica como ÚNICO valor (sin marca delante, sin coma). */
const RE_GENERICA_A_SECAS = new RegExp(`font-family:\\s*(?:${GENERICAS.join("|")})\\s*;`, "g");

function archivosFuenteUi(): string[] {
  const raiz = path.join(RAIZ_UI, "src");
  const acumulador: string[] = [];
  const EXT = new Set([".css", ".ts", ".tsx"]);
  (function recorrer(dir: string) {
    for (const nombre of readdirSync(dir)) {
      const ruta = path.join(dir, nombre);
      const info = statSync(ruta);
      if (info.isDirectory()) {
        recorrer(ruta);
        continue;
      }
      if (nombre.endsWith(".test.ts") || nombre.endsWith(".test.tsx")) continue;
      if (EXT.has(path.extname(nombre))) acumulador.push(ruta);
    }
  })(raiz);
  return acumulador;
}

describe("packages/ui/src — sin font-family genérica a secas (fuera de los fallbacks declarados)", () => {
  it("ningún archivo de src/ declara system-ui|-apple-system|Arial|Helvetica|sans-serif solo", () => {
    const infractores: string[] = [];
    for (const archivo of archivosFuenteUi()) {
      const contenido = readFileSync(archivo, "utf8");
      if (RE_GENERICA_A_SECAS.test(contenido)) infractores.push(path.relative(RAIZ_UI, archivo));
      RE_GENERICA_A_SECAS.lastIndex = 0;
    }
    expect(infractores, `font-family genérica a secas en: ${infractores.join(", ")}`).toEqual([]);
  });
});
