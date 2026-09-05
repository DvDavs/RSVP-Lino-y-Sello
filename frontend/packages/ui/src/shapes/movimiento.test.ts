// movimiento.test.ts — `11 §6.2` regla 5 y `11 §3.2`: el movimiento de las formas se apaga con
// `prefers-reduced-motion`, y se apaga en la HOJA, no en cada componente.
//
// Esta prueba lee `shapes.css` como texto a propósito: jsdom no evalúa `@media`, así que la única
// comprobación honesta es sobre lo que se publica. Comprueba las dos mitades del contrato:
//   (a) NINGUNA declaración `animation:` vive fuera de `@media (prefers-reduced-motion: no-preference)`
//       — sin la preferencia, la regla ni siquiera existe;
//   (b) CADA animación tiene además su `animation: none` explícito en el bloque `reduce`, que es lo
//       que sobrevive si alguien copia la clase a otra hoja o un `@layer` reordena la cascada.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HOJA = readFileSync(path.join(import.meta.dirname, "shapes.css"), "utf8");
/** La hoja sin comentarios: los comentarios de este archivo CITAN las reglas y las duplicarían. */
const CSS = HOJA.replace(/\/\*[\s\S]*?\*\//g, "");

/** Devuelve el cuerpo de la primera `@media` cuya condición coincide (sobre el CSS real). */
function bloqueMedia(condicion: string): string {
  const inicio = CSS.indexOf(`@media ${condicion}`);
  expect(inicio, `falta @media ${condicion}`).toBeGreaterThan(-1);
  let profundidad = 0;
  const abre = CSS.indexOf("{", inicio);
  for (let i = abre; i < CSS.length; i++) {
    if (CSS[i] === "{") profundidad++;
    else if (CSS[i] === "}") {
      profundidad--;
      if (profundidad === 0) return CSS.slice(abre + 1, i);
    }
  }
  throw new Error(`@media ${condicion} sin cerrar`);
}

const SIN_PREFERENCIA = bloqueMedia("(prefers-reduced-motion: no-preference)");
const CON_REDUCE = bloqueMedia("(prefers-reduced-motion: reduce)");

/** Nombres de las animaciones declaradas en la hoja. */
const KEYFRAMES = [...CSS.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);

/** Clases que encienden una animación, con la animación que encienden. */
const ANIMACIONES = [...SIN_PREFERENCIA.matchAll(/\.([\w-]+)\s*\{[^}]*animation:\s*([\w-]+)/g)].map((m) => ({
  clase: m[1],
  animacion: m[2],
}));

describe("shapes.css — movimiento", () => {
  it("declara las animaciones documentadas (`breathe` y `drift`)", () => {
    expect(KEYFRAMES).toEqual(["ui-forma-respira", "ui-forma-deriva"]);
  });

  it("las dos clases de movimiento encienden su animación", () => {
    expect(ANIMACIONES).toEqual([
      { clase: "ui-forma--respira", animacion: "ui-forma-respira" },
      { clase: "ui-forma--deriva", animacion: "ui-forma-deriva" },
    ]);
  });

  it("ninguna animación se declara fuera de `no-preference`", () => {
    const fuera = CSS.replace(SIN_PREFERENCIA, "").replace(CON_REDUCE, "");
    expect(fuera).not.toMatch(/animation:(?!\s*none\b)/);
  });

  it("cada animación tiene su `animation: none` explícito en el bloque `reduce`", () => {
    for (const { clase } of ANIMACIONES) {
      const regla = new RegExp(`\\.${clase}\\s*\\{[^}]*animation:\\s*none`);
      expect(CON_REDUCE, `falta el apagado de .${clase}`).toMatch(regla);
    }
    // Y nada más que apagados: el bloque `reduce` no puede encender movimiento.
    expect(CON_REDUCE).not.toMatch(/animation:(?!\s*none\b)/);
    expect(CON_REDUCE).not.toMatch(/transition:/);
  });

  it("la respiración dura al menos 12 s (regla 2 de 11 §6.2)", () => {
    const respira = /\.ui-forma--respira\s*\{[^}]*animation:[^;]*/.exec(SIN_PREFERENCIA)?.[0] ?? "";
    expect(respira).toContain("var(--ui-dur-respira, 12000ms)");
    expect(respira).toContain("infinite alternate");
  });

  it("la respiración es escala 1 → 1,04 con 2° de giro", () => {
    const cuerpo = /@keyframes ui-forma-respira\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
    expect(cuerpo).toContain("scale(1) rotate(0deg)");
    expect(cuerpo).toContain("scale(1.04) rotate(2deg)");
  });
});

describe("shapes.css — color solo desde tokens", () => {
  it("no contiene ni un color literal", () => {
    expect(HOJA).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(HOJA).not.toMatch(/\brgba?\(/);
    expect(HOJA).not.toMatch(/\bhsla?\(/);
    expect(HOJA).not.toMatch(/\boklch\(/);
  });

  it("ninguna variable de color lleva valor de reserva (una pareja inventada es peor que nada)", () => {
    const colores = /--ui-(surface|ink|primary|support|accent|divider|border|focus)[a-z0-9-]*/;
    for (const uso of HOJA.match(/var\(--ui-[a-z0-9-]+,[^)]*\)/g) ?? []) {
      expect(uso, `reserva de color en ${uso}`).not.toMatch(colores);
    }
  });

  it("no usa el prefijo de las plantillas de invitación", () => {
    expect(HOJA).not.toMatch(/--inv-/);
  });
});
