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
// (d) 3c-2b — UNA SOLA FUENTE DE VERDAD (revisor 3c-rev-2, "dos implementaciones que ya
//     divergen"): cada `var(--ui-…, reserva)` de `typography.css` referencia una variable que
//     `packages/tokens/generated/tokens.css` EMITE DE VERDAD (nunca un nombre propio de esta
//     hoja), y la reserva (el segundo argumento de `var()`, para cuando ese import falta) es
//     BYTE A BYTE el valor que el token trae — leyendo ambos ficheros generados/fuente, no
//     derivando de `src/tipografia.ts` otra vez (eso sería probar la fuente contra sí misma).
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLES_TIPOGRAFICOS } from "@invitaciones/tokens";

const RAIZ_UI = path.resolve(import.meta.dirname, "..");
const CSS = readFileSync(path.join(RAIZ_UI, "src/styles/typography.css"), "utf8");
const RAIZ_TOKENS = path.resolve(RAIZ_UI, "../tokens");
const TOKENS_CSS = readFileSync(path.join(RAIZ_TOKENS, "generated/tokens.css"), "utf8");

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
      expect(bloque).toContain(`--ui-text-${rol}`);
      expect(bloque).toContain(`--ui-weight-${rol}`);
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

/* ─── (d) Una sola fuente de verdad: typography.css consume tokens.css DE VERDAD ────────────────
   3c-2b, revisor 3c-rev-2. Se parsea `tokens.css` (declaraciones `--ui-…` del `:root` raíz y del
   `@media (min-width: 1024px) { :root { … } }`) y se extrae, de `typography.css`, cada llamada
   `var(--ui-…, reserva)` — con su nombre y su reserva balanceando paréntesis a mano (la reserva
   puede traer `clamp(...)` anidado o comas propias, p. ej. `"opsz" 96, "SOFT" 70, "WONK" 1`) — y si
   la llamada está dentro de un `@media (min-width: 1024px) { … }` de esta misma hoja o no. Cada
   llamada se compara contra el bloque de tokens que le toca (escritorio si está dentro del media,
   raíz si no). */

/** Declaraciones `--ui-nombre: valor;` de un bloque de tokens.css, una por línea. */
function parsearDeclaraciones(bloque: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const linea of bloque.split("\n")) {
    const m = /^\s*(--ui-[a-z0-9-]+):\s*(.+);\s*$/.exec(linea);
    if (m) mapa.set(m[1]!, m[2]!.trim());
  }
  return mapa;
}

const BLOQUE_RAIZ = /:root \{\n([\s\S]*?)\n\}\n/.exec(TOKENS_CSS);
if (!BLOQUE_RAIZ) throw new Error("tipografia.test.ts: no se encontró `:root {` en tokens.css generado");
const TOKENS_RAIZ = parsearDeclaraciones(BLOQUE_RAIZ[1]!);

const BLOQUE_ESCRITORIO = /@media \(min-width: 1024px\) \{\n {2}:root \{\n([\s\S]*?)\n {2}\}\n\}\n/.exec(TOKENS_CSS);
if (!BLOQUE_ESCRITORIO) throw new Error("tipografia.test.ts: no se encontró el @media de escritorio en tokens.css generado");
const TOKENS_ESCRITORIO = parsearDeclaraciones(BLOQUE_ESCRITORIO[1]!);

/** Índices de `css` que caen dentro de un `@media (min-width: 1024px) { ... }` de nivel superior. */
function marcarRegionEscritorio(css: string): boolean[] {
  const dentro = new Array<boolean>(css.length).fill(false);
  const reMedia = /@media \(min-width: 1024px\) \{/g;
  let m: RegExpExecArray | null;
  while ((m = reMedia.exec(css))) {
    let profundidad = 1;
    let j = m.index + m[0].length;
    const inicioContenido = j;
    while (j < css.length && profundidad > 0) {
      if (css[j] === "{") profundidad++;
      else if (css[j] === "}") profundidad--;
      j++;
    }
    for (let k = inicioContenido; k < j - 1; k++) dentro[k] = true;
  }
  return dentro;
}

interface LlamadaVar {
  readonly nombre: string;
  readonly reserva: string;
  readonly escritorio: boolean;
}

/** Cada `var(--ui-…, reserva)` de `css`, con paréntesis balanceados a mano (la reserva puede
 *  traer un `clamp(...)` anidado o comas propias). */
function extraerLlamadasVar(css: string): LlamadaVar[] {
  const regionEscritorio = marcarRegionEscritorio(css);
  const llamadas: LlamadaVar[] = [];
  const reVar = /var\(/g;
  let m: RegExpExecArray | null;
  while ((m = reVar.exec(css))) {
    let profundidad = 1;
    let j = m.index + m[0].length;
    const inicio = j;
    while (j < css.length && profundidad > 0) {
      if (css[j] === "(") profundidad++;
      else if (css[j] === ")") profundidad--;
      j++;
    }
    const contenido = css.slice(inicio, j - 1);
    const idxComa = contenido.indexOf(",");
    if (idxComa === -1) continue;
    const nombre = contenido.slice(0, idxComa).trim();
    const reserva = contenido.slice(idxComa + 1).trim();
    if (!nombre.startsWith("--ui-")) continue;
    llamadas.push({ nombre, reserva, escritorio: regionEscritorio[m.index] === true });
  }
  return llamadas;
}

const normalizar = (valor: string): string => valor.replace(/\s+/g, " ").trim();

/** Las variables de LA ESCALA (no cualquier `--ui-…`: `typography.css` también usa `--ui-link`
 *  para el color de los enlaces de `.prose`, que no es tipografía y tiene su propia prueba de
 *  contraste en otro sitio). Nombres reales que emite `packages/tokens` para cada rol de
 *  `ROLES_TIPOGRAFICOS`, más las tres familias por voz y el peso de énfasis general. */
const VARIABLES_DE_ESCALA = new Set<string>([
  "--ui-font-display",
  "--ui-font-text",
  "--ui-font-label",
  "--ui-weight-texto-fuerte",
  ...ROLES_TIPOGRAFICOS.flatMap((rol) => [
    `--ui-text-${rol}`,
    `--ui-leading-${rol}`,
    `--ui-tracking-${rol}`,
    `--ui-weight-${rol}`,
    `--ui-variacion-${rol}`,
  ]),
]);

describe("typography.css — una sola fuente de verdad para la escala (3c-2b, revisor 3c-rev-2)", () => {
  const llamadas = extraerLlamadasVar(CSS).filter((l) => VARIABLES_DE_ESCALA.has(l.nombre));

  it("typography.css referencia al menos una variable --ui- por rol de la escala (no quedó huérfano)", () => {
    expect(llamadas.length).toBeGreaterThan(30);
  });

  for (const llamada of llamadas) {
    const mapa = llamada.escritorio ? TOKENS_ESCRITORIO : TOKENS_RAIZ;
    const bloque = llamada.escritorio ? "de escritorio (@media min-width:1024px)" : "raíz (:root)";

    it(`${llamada.nombre} (${llamada.escritorio ? "escritorio" : "raíz"}) existe en tokens.css`, () => {
      expect(mapa.has(llamada.nombre), `tokens.css no emite ${llamada.nombre} en el bloque ${bloque}`).toBe(true);
    });

    it(`la reserva de ${llamada.nombre} (${llamada.escritorio ? "escritorio" : "raíz"}) coincide con el token`, () => {
      const valorToken = mapa.get(llamada.nombre);
      expect(valorToken, `tokens.css no emite ${llamada.nombre} en el bloque ${bloque}`).toBeDefined();
      expect(
        normalizar(llamada.reserva),
        `la reserva de ${llamada.nombre} en typography.css ("${llamada.reserva}") no coincide con ` +
          `el valor de tokens.css ("${valorToken}") — 11 §2.2 manda: corrige la reserva, no el token`,
      ).toBe(normalizar(valorToken!));
    });
  }

  // Sabotaje (documentado en bitácora 3c-2b): un token que packages/tokens NO emite hace caer la
  // primera aserción de arriba; una reserva que no coincide con el valor real del token hace caer
  // la segunda. Aquí se prueba el mecanismo de detección en sí, sin tocar los ficheros reales.
  it("sabotaje: una variable que tokens.css no emite se detecta", () => {
    const llamadasSaboteadas = extraerLlamadasVar(CSS.replace("--ui-text-display-2xl", "--ui-text-display-2xl-inventado"));
    const saboteada = llamadasSaboteadas.find((l) => l.nombre === "--ui-text-display-2xl-inventado");
    expect(saboteada).toBeDefined();
    expect(TOKENS_RAIZ.has(saboteada!.nombre)).toBe(false);
  });

  it("sabotaje: una reserva que diverge del valor real del token se detecta", () => {
    const llamadasSaboteadas = extraerLlamadasVar(CSS.replace("clamp(40px, 25.237px + 3.785vw, 64px)", "clamp(40px, 25.237px + 3.785vw, 999px)"));
    const saboteada = llamadasSaboteadas.find((l) => l.nombre === "--ui-text-display-2xl");
    expect(saboteada).toBeDefined();
    const valorToken = TOKENS_RAIZ.get(saboteada!.nombre);
    expect(normalizar(saboteada!.reserva)).not.toBe(normalizar(valorToken!));
  });
});
