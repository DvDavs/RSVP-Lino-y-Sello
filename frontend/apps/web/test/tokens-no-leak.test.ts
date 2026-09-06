// test/tokens-no-leak.test.ts — compuerta MECÁNICA de la frontera chrome/invitación (04 §19.4,
// instrucción del dueño sobre la dirección de arte: "ni un --ui-* puede filtrarse a una sección, ni
// al documento del lienzo, ni al render público"). `eslint.config.mjs` ya restringe los IMPORTS
// (no se puede importar `lib/store`, `../../globals.css`, etc. desde `(canvas)`/`(public)`); esta
// prueba cubre lo que un import-lint no ve: CADENAS `--ui-` escritas a mano (className, style,
// comentarios de código sirven de aviso también) fuera de `app/(chrome)/**`.
//
// 3C-8: la excepción para la carpeta del shim (`components` + `ui` + `**`) se retiró — era el hueco
// para `button.tsx` (PUENTE TEMPORAL de 3C-7, en esa misma carpeta), que ya no lo necesita nadie
// (`app/(chrome)/acceso` y `app/(chrome)/editor` migraron a `@invitaciones/ui`, 3C-5/3C-6) y se
// borró junto con toda la carpeta.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listarArchivosFuente } from "./util/listar-fuente.ts";

const RAIZ = path.resolve(import.meta.dirname, "..");

describe("frontera --ui- / --inv- (04 §19.4)", () => {
  it("ningún token --ui- aparece fuera de app/(chrome)/**", () => {
    const permitido = [/^app\/\(chrome\)\//];
    const infractores: string[] = [];
    for (const archivo of listarArchivosFuente(RAIZ)) {
      const relativo = path.relative(RAIZ, archivo).split(path.sep).join("/");
      if (permitido.some((r) => r.test(relativo))) continue;
      const contenido = readFileSync(archivo, "utf8");
      if (/--ui-[a-z]/.test(contenido)) infractores.push(relativo);
    }
    expect(infractores, `Tokens --ui- fuera del chrome: ${infractores.join(", ")}`).toEqual([]);
  });

  it("ningún token --inv- aparece dentro de app/(chrome)/** (04 §5.4/§19.4)", () => {
    const prohibido = [/^app\/\(chrome\)\//];
    const infractores: string[] = [];
    for (const archivo of listarArchivosFuente(RAIZ)) {
      const relativo = path.relative(RAIZ, archivo).split(path.sep).join("/");
      if (!prohibido.some((r) => r.test(relativo))) continue;
      const contenido = readFileSync(archivo, "utf8");
      if (/--inv-[a-z]/.test(contenido)) infractores.push(relativo);
    }
    expect(infractores, `Tokens --inv- dentro del chrome: ${infractores.join(", ")}`).toEqual([]);
  });
});
