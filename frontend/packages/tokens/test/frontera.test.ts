// test/frontera.test.ts — las dos fronteras MECÁNICAS del sistema (11 §8.2), en el sentido que
// `apps/web/test/tokens-no-leak.test.ts` no cubre porque solo mira dentro de `apps/web`:
//
//   1. Ningún token de las plantillas de invitación aparece en packages/{tokens,ui,icons}.
//   2. Ningún token del chrome aparece en packages/sections.
//   3. Ningún hex suelto fuera de `src/paletas.ts` (el color entra por token, siempre).
//
// Los prefijos se componen en tiempo de ejecución para que este mismo fichero no se autodenuncie.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const PAQUETES = resolve(import.meta.dirname, "../..");
const EXTENSIONES = new Set([".ts", ".tsx", ".css", ".mjs", ".js"]);
const IGNORAR = new Set(["node_modules", ".next", "coverage", "dist", ".turbo"]);

const PREFIJO_CHROME = ["--", "ui", "-"].join("");
const PREFIJO_INVITACION = ["--", "inv", "-"].join("");

function ficheros(raiz: string): string[] {
  const salida: string[] = [];
  const recorrer = (dir: string): void => {
    let entradas: string[];
    try {
      entradas = readdirSync(dir);
    } catch {
      return;
    }
    for (const nombre of entradas) {
      if (IGNORAR.has(nombre)) continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (EXTENSIONES.has(nombre.slice(nombre.lastIndexOf(".")))) salida.push(ruta);
    }
  };
  recorrer(raiz);
  return salida;
}

const buscar = (raices: string[], aguja: string): string[] => {
  const patron = new RegExp(`${aguja}[a-z]`);
  const infractores: string[] = [];
  for (const raiz of raices) {
    for (const fichero of ficheros(resolve(PAQUETES, raiz))) {
      if (patron.test(readFileSync(fichero, "utf8"))) infractores.push(relative(PAQUETES, fichero).split(sep).join("/"));
    }
  }
  return infractores;
};

describe("frontera chrome / plantillas de invitación (11 §8.2)", () => {
  it("packages/{tokens,ui,icons} no menciona el prefijo de las plantillas", () => {
    expect(buscar(["tokens", "ui", "icons"], PREFIJO_INVITACION)).toEqual([]);
  });

  it("packages/sections no menciona el prefijo del chrome", () => {
    expect(buscar(["sections"], PREFIJO_CHROME)).toEqual([]);
  });

  it("hay ficheros que escanear (la compuerta no pasa por estar vacía)", () => {
    expect(ficheros(resolve(PAQUETES, "tokens")).length).toBeGreaterThan(10);
    expect(ficheros(resolve(PAQUETES, "sections")).length).toBeGreaterThan(10);
  });
});

describe("cero hex fuera de la fuente de color", () => {
  it("solo `src/paletas.ts` contiene literales hexadecimales", () => {
    const permitidos = new Set(["tokens/src/paletas.ts"]);
    const infractores: string[] = [];
    for (const fichero of ficheros(resolve(PAQUETES, "tokens/src"))) {
      const rel = relative(PAQUETES, fichero).split(sep).join("/");
      if (permitidos.has(rel)) continue;
      const contenido = readFileSync(fichero, "utf8");
      if (/#[0-9a-fA-F]{6}\b/.test(contenido)) infractores.push(rel);
    }
    expect(infractores, `hex suelto en ${infractores.join(", ")}`).toEqual([]);
  });
});
