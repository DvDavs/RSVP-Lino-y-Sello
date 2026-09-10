// reglas-duras.test.ts — la compuerta de las reglas duras de identidad visual (`identidad-visual`
// SKILL.md: «Nunca emojis…», «Color solo desde tokens… nada de hex sueltos en componentes»). Recorre
// esta MISMA carpeta y cae si algún fichero de componente contiene un emoji o un color en
// hexadecimal. Se excluyen los `*.test.ts(x)` (esta prueba y sus hermanas): lo que se vigila es el
// código de los componentes, no el código de las pruebas que los vigilan.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CARPETA = import.meta.dirname;

const FICHEROS = readdirSync(CARPETA)
  .filter((nombre) => /\.(tsx?|css)$/.test(nombre))
  .filter((nombre) => !/\.test\.tsx?$/.test(nombre))
  .sort();

// Bloques Unicode de emoji (pictogramas, símbolos misceláneos, dingbats, banderas regionales,
// suplementarios) y el selector de variación que fuerza representación emoji (U+FE0F).
const EMOJI =
  /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}️]/u;

// Un color hex de verdad: `#` seguido de 3, 4, 6 u 8 dígitos hexadecimales y NADA más pegado detrás
// (así no cae un id de invitación tipo `#a1b2c3d` de 7 dígitos, que no es un hex válido de CSS).
const HEX_CSS = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/;

describe("reglas duras de identidad — _componentes de /admin", () => {
  it("encuentra ficheros que vigilar (la compuerta no vigila una carpeta vacía)", () => {
    expect(FICHEROS.length).toBeGreaterThan(0);
  });

  it.each(FICHEROS)("%s no contiene emojis", (fichero) => {
    const contenido = readFileSync(path.join(CARPETA, fichero), "utf8");
    expect(EMOJI.test(contenido)).toBe(false);
  });

  it.each(FICHEROS)("%s no contiene un color en hexadecimal (color solo desde tokens)", (fichero) => {
    const contenido = readFileSync(path.join(CARPETA, fichero), "utf8");
    expect(HEX_CSS.test(contenido)).toBe(false);
  });
});
