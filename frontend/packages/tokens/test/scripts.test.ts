// test/scripts.test.ts — los tres scripts se ejecutan DE VERDAD (subproceso, Node 22 con
// TypeScript nativo) y se comprueba su código de salida. Es lo que engancha `verify-contrast` a
// `pnpm run test`: la compuerta se prueba, no se supone.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = resolve(import.meta.dirname, "..");
const correr = (script: string, ...args: string[]) =>
  spawnSync(process.execPath, [resolve(RAIZ, "scripts", script), ...args], { cwd: RAIZ, encoding: "utf8" });

describe("scripts/verify-contrast.ts", () => {
  it("sale con 0 e imprime la tabla completa (252 filas, 240 con umbral, 0 fallos)", () => {
    const r = correr("verify-contrast.ts");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("3 paletas x 2 temas x 42 parejas = 252 filas; 240 con umbral; 0 fallos.");
    expect(r.stdout).not.toContain("FALLA");
  }, 30_000);

  it("SABOTAJE: con un rol saboteado sale con 1 (la compuerta rompe el build)", () => {
    const r = correr("verify-contrast.ts", "--sabotear=ink=#fdf9f6");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("FALLA");
    expect(r.stdout).toMatch(/= 252 filas; 240 con umbral; [1-9]\d* fallos\./);
    expect(r.stdout).toContain("sabotaje aplicado: ink=#fdf9f6");
  }, 30_000);

  it("rechaza un rol inexistente en vez de saboteárselo en silencio", () => {
    const r = correr("verify-contrast.ts", "--sabotear=inventado=#000000");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Rol desconocido");
  }, 30_000);

  it("`--activa` mide solo la paleta del producto", () => {
    const r = correr("verify-contrast.ts", "--activa");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("1 paletas x 2 temas x 42 parejas = 84 filas; 80 con umbral; 0 fallos.");
  }, 30_000);
});

describe("scripts/emit-css.ts", () => {
  it("`--check` confirma que lo commiteado está al día", () => {
    const r = correr("emit-css.ts", "--check");
    expect(r.stdout).toContain("OK      generated/tokens.css");
    expect(r.stdout).toContain("OK      generated/tailwind.css");
    expect(r.status).toBe(0);
  }, 30_000);
});

describe("scripts/generar-escalas.ts", () => {
  it("reproduce las escalas de 11 §1.2 (la fórmula OKLCH es ejecutable, no un párrafo)", () => {
    const r = correr("generar-escalas.ts");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("#bb0076");
    expect(r.stdout).toContain("[a] Bugambilia");
    const md = correr("generar-escalas.ts", "--md");
    expect(md.status).toBe(0);
    expect(md.stdout).toContain("| `primary` · bugambilia (352°) |");
  }, 30_000);
});
