// test/design-tokens.test.ts — el cableado del sistema de diseño nuevo dentro del chrome (fase 3-C,
// bloque 1). No mide color: eso lo hacen `packages/tokens` (datos) y
// `evidencia/fase-3c/bloque-1/contraste-en-pantalla.mjs` (pila renderizada). Aquí se vigila que el
// cableado siga en su sitio y, sobre todo, que la CONVIVENCIA con el chrome provisional de la
// fase 3 no se rompa por accidente antes de que el bloque 3 lo migre.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const globals = readFileSync(path.join(RAIZ, "app/(chrome)/globals.css"), "utf8");

describe("tokens del sistema de diseño en el chrome", () => {
  it("globals.css importa los dos ficheros del paquete, después de Tailwind", () => {
    const orden = [
      globals.indexOf('@import "tailwindcss"'),
      globals.indexOf('@import "@invitaciones/tokens/tokens.css"'),
      globals.indexOf('@import "@invitaciones/tokens/tailwind.css"'),
    ];
    expect(orden.every((i) => i >= 0)).toBe(true);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it("los tokens provisionales de la fase 3 siguen ahí: el bloque 3 es quien migra el chrome", () => {
    // Si esto se pone rojo sin que el bloque 3 haya migrado el chrome, alguien borró los tokens
    // viejos antes de tiempo y las pantallas actuales se quedan sin color.
    expect(globals).toContain("@theme {");
    expect(globals).toContain("--color-ui-accent: #4e027c;");
    expect(globals).toContain("--ui-content-max: 1330px;");
    for (const fuente of ["inter", "bricolage-grotesque", "outfit"]) {
      expect(globals).toContain(`@import "@fontsource-variable/${fuente}/wght.css";`);
    }
  });

  it("el paquete emite lo que el chrome importa", () => {
    const paquete = path.resolve(RAIZ, "../../packages/tokens");
    for (const generado of ["generated/tokens.css", "generated/tailwind.css"]) {
      expect(existsSync(path.join(paquete, generado)), generado).toBe(true);
    }
    const tokens = readFileSync(path.join(paquete, "generated/tokens.css"), "utf8");
    expect(tokens).toContain(':root {\n  color-scheme: light;');
    expect(tokens).toContain('[data-theme="dark"]');
    // El contenedor nuevo no pisa al viejo (1330 px) mientras convivan.
    expect(tokens).toContain("--ui-container-max: 1200px;");
    expect(tokens).not.toContain("--ui-content-max");
  });

  it("la galería vive bajo app/(chrome)/design (lo exige tokens-no-leak) y no se indexa", () => {
    const galeria = path.join(RAIZ, "app/(chrome)/design");
    for (const fichero of ["layout.tsx", "page.tsx", "tokens/page.tsx", "galeria.module.css"]) {
      expect(existsSync(path.join(galeria, fichero)), fichero).toBe(true);
    }
    expect(readFileSync(path.join(galeria, "layout.tsx"), "utf8")).toContain("robots: { index: false, follow: false }");
  });
});
