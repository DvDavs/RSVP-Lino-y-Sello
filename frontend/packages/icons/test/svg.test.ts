// test/svg.test.ts — compuerta de `svg/*.svg` (11 §4.1, ADR-3C-0-04): retícula, trazo, sin color
// suelto ni tamaño fijo, nombres en kebab-case, y que lo commiteado en `src/generated/` es
// EXACTAMENTE lo que produce `scripts/generar.ts` a partir del SVG fuente de hoy (si alguien edita
// el SVG y no regenera, esta prueba cae). `svg/ilustraciones/*.svg` queda fuera a propósito: no son
// iconos de 24 (son las ilustraciones de 160 que consume `packages/ui/src/ilustraciones/`).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generarComponente, nombreArchivoAPascal, nombresIconos } from "../scripts/generar.ts";

const RAIZ = path.resolve(import.meta.dirname, "..");
const DIR_SVG = path.join(RAIZ, "svg");
const DIR_GENERADOS = path.join(RAIZ, "src", "generated");

const NOMBRES = nombresIconos(DIR_SVG);
const KEBAB = /^[a-z]+(-[a-z]+)*$/;

describe("svg/*.svg — inventario de la mitad B (11 §4.2, nombres 42-82)", () => {
  it("hay al menos 20 SVG (mínimo de mitad, brief 3c-3-iconos.md) y ninguno vacío", () => {
    expect(NOMBRES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(NOMBRES)("%s: nombre de archivo en kebab-case", (nombre) => {
    expect(nombre).toMatch(KEBAB);
  });

  it.each(NOMBRES)("%s: retícula 24×24 y trazo permitido en la etiqueta raíz", (nombre) => {
    const svg = readFileSync(path.join(DIR_SVG, `${nombre}.svg`), "utf8");
    const etiquetaRaiz = svg.match(/^<svg[^>]*>/)?.[0] ?? "";
    expect(etiquetaRaiz).toContain('viewBox="0 0 24 24"');
    expect(etiquetaRaiz).toContain('stroke="currentColor"');
    expect(etiquetaRaiz).toMatch(/stroke-width="(1\.75|2)"/);
    expect(etiquetaRaiz).toContain('stroke-linecap="round"');
    expect(etiquetaRaiz).toContain('stroke-linejoin="round"');
    expect(etiquetaRaiz).not.toMatch(/\swidth="|\sheight="/);
  });

  it.each(NOMBRES)("%s: sin fill hexadecimal, sin style=, sin <image>", (nombre) => {
    const svg = readFileSync(path.join(DIR_SVG, `${nombre}.svg`), "utf8");
    expect(svg).not.toMatch(/fill="#/i);
    expect(svg).not.toMatch(/\sstyle=/);
    expect(svg).not.toMatch(/<image/i);
  });

  it.each(NOMBRES)("%s: es XML bien formado (una sola etiqueta <svg>, cierres balanceados)", (nombre) => {
    const svg = readFileSync(path.join(DIR_SVG, `${nombre}.svg`), "utf8");
    expect(svg.match(/<svg /g)?.length).toBe(1);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
    // Todo elemento hijo se autocierra (`/>`) salvo `<g ...>...</g>`: ambos balanceados.
    const abiertos = svg.match(/<g[ >]/g)?.length ?? 0;
    const cerrados = svg.match(/<\/g>/g)?.length ?? 0;
    expect(abiertos).toBe(cerrados);
  });

  it("no hay nombres repetidos entre los 41 (cada archivo es un icono del inventario)", () => {
    expect(new Set(NOMBRES).size).toBe(NOMBRES.length);
  });

  it.each(NOMBRES)("%s: src/generated/%sIcon.tsx coincide con lo que regenera scripts/generar.ts hoy", (nombre) => {
    const pascal = nombreArchivoAPascal(nombre);
    const svg = readFileSync(path.join(DIR_SVG, `${nombre}.svg`), "utf8");
    const esperado = generarComponente(nombre, svg);
    const commiteado = readFileSync(path.join(DIR_GENERADOS, `${pascal}Icon.tsx`), "utf8");
    expect(commiteado).toBe(esperado);
  });

  it("src/generated/ no tiene ficheros huérfanos (uno por cada SVG, ni uno más)", () => {
    const generados = readdirSync(DIR_GENERADOS).filter((f) => f.endsWith(".tsx"));
    expect(generados.length).toBe(NOMBRES.length);
  });
});

describe("svg/ilustraciones/*.svg — estados vacíos (11 §4.3)", () => {
  const DIR_ILUSTRACIONES = path.join(DIR_SVG, "ilustraciones");
  const nombres = readdirSync(DIR_ILUSTRACIONES)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.replace(/\.svg$/, ""));

  it("hay exactamente 3: sin-invitaciones, sin-fotos, error-generico", () => {
    expect(new Set(nombres)).toEqual(new Set(["sin-invitaciones", "sin-fotos", "error-generico"]));
  });

  it.each(nombres)("%s: lienzo de 160, trazo 4-4,5, sin fill hexadecimal ni <image>", (nombre) => {
    const svg = readFileSync(path.join(DIR_ILUSTRACIONES, `${nombre}.svg`), "utf8");
    expect(svg).toContain('viewBox="0 0 160 160"');
    expect(svg).not.toMatch(/fill="#/i);
    expect(svg).not.toMatch(/<image/i);
    const anchosDeTrazo = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    for (const ancho of anchosDeTrazo) expect(ancho).toBeGreaterThanOrEqual(4);
    for (const ancho of anchosDeTrazo) expect(ancho).toBeLessThanOrEqual(4.5);
  });

  it.each(nombres)("%s: se apoya en el sello de fondo `--ui-primary-soft` (gramática común, 11 §4.3)", (nombre) => {
    const svg = readFileSync(path.join(DIR_ILUSTRACIONES, `${nombre}.svg`), "utf8");
    expect(svg).toContain("var(--ui-primary-soft)");
  });
});
