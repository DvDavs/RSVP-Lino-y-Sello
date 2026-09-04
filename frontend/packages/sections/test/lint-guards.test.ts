// packages/sections/test/lint-guards.test.ts — guardas mecánicas que normalmente pondría
// `eslint.config.mjs` (04 §19.3), pero ese archivo es propiedad del agente 3-1 (paquete raíz del
// monorepo, `contratos.md` §1) y no existe todavía en este árbol de trabajo. Mientras tanto, ESTA
// prueba es la compuerta real: falla el `pnpm test` de `packages/sections` si alguna regla dura se
// viola, en vez de depender de un lint que aún no está cableado. Cuando 3-1 (u otro bloque) añada
// las reglas de ESLint reales, esta prueba puede quedarse como red de seguridad adicional.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(here, "../src");

/**
 * Quita comentarios `//…` y `/*…*\/` antes de buscar patrones prohibidos — sin esto, un
 * comentario que EXPLICA por qué el código no hace algo (p. ej. "nunca uses style={{…}}") se
 * detecta a sí mismo como si lo hiciera. Heurística simple (no entiende cadenas con `//` dentro),
 * suficiente para el código de este paquete: se verificó a mano que no produce falsos negativos
 * contra los archivos reales de `src/`.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function sourceFiles(): string[] {
  return globSync("**/*.{ts,tsx}", { cwd: SRC_DIR }).map((f) => join(SRC_DIR, f));
}

function readAllCode(): Array<{ path: string; text: string }> {
  return sourceFiles().map((path) => ({ path, text: stripComments(readFileSync(path, "utf8")) }));
}

describe("lint-guards — 04 §19.3: prohibiciones duras en packages/sections/src", () => {
  it("cero dangerouslySetInnerHTML en todo el paquete (fuera de comentarios)", () => {
    const offenders = readAllCode().filter(({ text }) => text.includes("dangerouslySetInnerHTML"));
    expect(offenders.map((o) => relative(SRC_DIR, o.path))).toEqual([]);
  });

  it('cero prop `style={{` de React (regla propia de 3-2a: CSP del lienzo, handoffs/3-0b.md §1)', () => {
    const offenders = readAllCode().filter(({ text }) => /\bstyle=\{\{/.test(text));
    expect(offenders.map((o) => relative(SRC_DIR, o.path))).toEqual([]);
  });

  it("cero alert(/confirm( (04 §19.3)", () => {
    const offenders = readAllCode().filter(({ text }) => /\balert\(|\bconfirm\(/.test(text));
    expect(offenders.map((o) => relative(SRC_DIR, o.path))).toEqual([]);
  });

  it("cero localStorage/document.cookie (el lienzo tiene origen opaco: lanzan — handoffs/3-0b.md §3)", () => {
    const offenders = readAllCode().filter(({ text }) => /localStorage|document\.cookie/.test(text));
    expect(offenders.map((o) => relative(SRC_DIR, o.path))).toEqual([]);
  });

  it("cero utilidades de Tailwind en className literal (04 §19.2, mismo grep que el contrato)", () => {
    const pattern = /className="[^"]*(bg-|text-|p-|m-|flex |grid )/;
    const offenders = readAllCode().filter(({ text }) => pattern.test(text));
    expect(offenders.map((o) => relative(SRC_DIR, o.path))).toEqual([]);
  });

  it("cero import de next/*, zustand, react-hook-form, @radix-ui/*, lucide-react (04 §19.3)", () => {
    const pattern = /from\s+["'](next\/(?!image)|zustand|react-hook-form|@radix-ui\/|lucide-react)/;
    const offenders = readAllCode().filter(({ text }) => pattern.test(text));
    expect(offenders.map((o) => relative(SRC_DIR, o.path))).toEqual([]);
  });

  it("todo color en un .module.css es var(--inv-*) — cero hex/rgb literal fuera de theme/tokens.css", () => {
    const cssFiles = globSync("**/*.css", { cwd: SRC_DIR })
      .filter((f) => !f.endsWith("theme/tokens.css")) // tokens.css SÍ define los valores de reserva
      .map((f) => join(SRC_DIR, f));
    const hexOrRgb = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
    const offenders = cssFiles
      .map((path) => ({ path, text: stripComments(readFileSync(path, "utf8")) }))
      .filter(({ text }) => hexOrRgb.test(text));
    expect(offenders.map((o) => relative(SRC_DIR, o.path))).toEqual([]);
  });
});
