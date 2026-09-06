// test/catalog.node.test.ts — el catálogo se importa desde NODE PURO, sin React y sin CSS.
//
// El CLI del kit de autor corre en Node, no en un navegador ni bajo Vite: si el catálogo colgara de
// `src/index.ts` arrastraría `.tsx` y `.module.css` y el CLI no podría cargarlo. Por eso el paquete
// declara el punto de entrada aparte `@invitaciones/sections/catalog` (package.json → exports), y
// esta prueba lo demuestra lanzando un proceso `node` de verdad, no simulándolo.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));   // packages/sections

const GUION = `
const m = await import("@invitaciones/sections/catalog");
const catalogo = m.sectionCatalog;
const salida = {
  secciones: Object.keys(catalogo).length,
  variantesCover: catalogo.cover.variants.map(v => v.id),
  andamioEvento: m.scaffoldSlots("event").map(s => s.blockId),
  rolEnHueco: m.slotForRole("cover", "coverTitle").role,
  huecos: Object.values(catalogo).reduce((n, s) => n + s.slots.length, 0),
};
// Y la contraprueba: la raíz del paquete NO se puede cargar desde Node (arrastra .tsx y CSS),
// que es exactamente el motivo de que el catálogo tenga punto de entrada propio.
try { await import("@invitaciones/sections"); salida.raizCarga = true; }
catch (e) { salida.raizCarga = false; salida.raizError = String(e.message).split(String.fromCharCode(10))[0]; }
console.log(JSON.stringify(salida));
`;

describe("importación desde Node puro", () => {
  it("`@invitaciones/sections/catalog` carga en un proceso node sin React ni CSS", () => {
    const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", GUION], {
      cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    const salida = JSON.parse(stdout.trim().split("\n").at(-1)!) as {
      secciones: number; variantesCover: string[]; andamioEvento: string[]; rolEnHueco: string;
      huecos: number; raizCarga: boolean; raizError?: string;
    };
    expect(salida.secciones).toBe(12);
    expect(salida.variantesCover).toEqual(["full", "framed", "split"]);
    expect(salida.andamioEvento).toEqual(["heading", "cards"]);
    expect(salida.rolEnHueco).toBe("coverTitle");
    expect(salida.huecos).toBeGreaterThan(80);
    // Contraprueba: `@invitaciones/sections` (la raíz) NO carga en Node puro.
    expect(salida.raizCarga).toBe(false);
    expect(salida.raizError).toContain(".tsx");
  });

  it("el módulo no importa React, JSX ni CSS ni siquiera de forma indirecta", () => {
    const fuente = readFileSync(join(raiz, "catalog", "index.ts"), "utf8");
    const imports = [...fuente.matchAll(/from\s+"([^"]+)"/g)].map(m => m[1]);
    expect(imports).toEqual(["@invitaciones/schema", "@invitaciones/schema", "../src/registry-data.ts"]);
    // `registry-data.ts` es la frontera sin JSX del paquete (su propio encabezado lo declara).
    const registro = readFileSync(join(raiz, "src", "registry-data.ts"), "utf8");
    const importsRegistro = [...registro.matchAll(/from\s+"([^"]+)"/g)].map(m => m[1]);
    expect(importsRegistro).toEqual(["@invitaciones/schema"]);
    for (const i of [...imports, ...importsRegistro]) {
      expect(i).not.toMatch(/\.(tsx|css)$/);
      expect(i).not.toBe("react");
    }
  });
});
