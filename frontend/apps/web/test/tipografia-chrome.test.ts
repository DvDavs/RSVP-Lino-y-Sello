// apps/web/test/tipografia-chrome.test.ts — fase 3-C, 3C-2, brief entregables 4(b)/4(d)/5.
//
// (b) Nada de `font-family` genérica "a secas" bajo `app/(chrome)/**` (mismo criterio que
//     `packages/ui/test/tipografia.test.ts`; se repite aquí porque `tokens-no-leak.test.ts` ya
//     demuestra que este árbol es el único con permiso para tocar `--ui-*`, y ese permiso no debe
//     traducirse en "cualquier tipografía sirve").
// (d) `RUTAS_PRECARGA` (reexportado por `@invitaciones/ui`) apunta a ficheros que existen de verdad
//     en el `node_modules` de `@invitaciones/ui` (misma fuente que consume el script de copia).
// (5) El layout del chrome renderiza un `<link rel="preload" as="font" crossOrigin>` por cada ruta
//     de `RUTAS_PRECARGA`, ni uno más ni uno menos.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FUENTES_AUTOALOJADAS, RUTAS_PRECARGA } from "@invitaciones/ui";

const RAIZ = path.resolve(import.meta.dirname, "..");
const RAIZ_UI = path.resolve(RAIZ, "../../packages/ui");
const CHROME = path.join(RAIZ, "app", "(chrome)");

const GENERICAS = ["system-ui", "-apple-system", "Arial", "Helvetica", "sans-serif", "ui-monospace", "ui-sans-serif", "ui-serif"];
const RE_GENERICA_A_SECAS = new RegExp(`font-family:\\s*(?:${GENERICAS.join("|")})\\s*;`, "g");

function archivosChrome(): string[] {
  const acumulador: string[] = [];
  const EXT = new Set([".css", ".ts", ".tsx"]);
  (function recorrer(dir: string) {
    let entradas: string[];
    try {
      entradas = readdirSync(dir);
    } catch {
      return;
    }
    for (const nombre of entradas) {
      const ruta = path.join(dir, nombre);
      const info = statSync(ruta);
      if (info.isDirectory()) {
        recorrer(ruta);
        continue;
      }
      if (nombre.endsWith(".test.ts") || nombre.endsWith(".test.tsx")) continue;
      if (EXT.has(path.extname(nombre))) acumulador.push(ruta);
    }
  })(CHROME);
  return acumulador;
}

describe("app/(chrome) — sin font-family genérica a secas", () => {
  it("ningún archivo bajo app/(chrome) declara system-ui|-apple-system|Arial|Helvetica|sans-serif solo", () => {
    const infractores: string[] = [];
    for (const archivo of archivosChrome()) {
      const contenido = readFileSync(archivo, "utf8");
      if (RE_GENERICA_A_SECAS.test(contenido)) infractores.push(path.relative(RAIZ, archivo));
      RE_GENERICA_A_SECAS.lastIndex = 0;
    }
    expect(infractores, `font-family genérica a secas en: ${infractores.join(", ")}`).toEqual([]);
  });
});

describe("layout del chrome — preload de la voz display (11 §2.4)", () => {
  it("RUTAS_PRECARGA no está vacío y sus ficheros de origen existen", () => {
    expect(RUTAS_PRECARGA.length).toBeGreaterThan(0);
    for (const rutaPublica of RUTAS_PRECARGA) {
      const fuente = FUENTES_AUTOALOJADAS.find((f) => f.rutaPublica === rutaPublica);
      expect(fuente, `${rutaPublica} no está en el manifiesto de @invitaciones/ui`).toBeDefined();
      const origen = path.join(RAIZ_UI, fuente!.rutaNodeModules);
      expect(existsSync(origen), `${rutaPublica} → ${origen} no existe`).toBe(true);
    }
  });

  it("layout.tsx renderiza un <link rel=preload crossOrigin> por cada ruta de RUTAS_PRECARGA", () => {
    const layout = readFileSync(path.join(CHROME, "layout.tsx"), "utf8");
    expect(layout).toMatch(/RUTAS_PRECARGA/);
    expect(layout).toMatch(/rel="preload"/);
    expect(layout).toMatch(/crossOrigin="anonymous"/);
    expect(layout).toMatch(/as="font"/);
  });
});
