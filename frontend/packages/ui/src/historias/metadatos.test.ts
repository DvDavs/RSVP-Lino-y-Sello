// packages/ui/src/historias/metadatos.test.ts — `metadatos.ts` se mantiene A MANO como gemelo
// seguro-para-servidor de `registro.ts` (ver el porqué en `registro.ts`): esta prueba es la única
// compuerta que impide que diverjan. Importa `registro` directamente: aquí, en Vitest/Node, "use
// client" es solo una cadena que nadie interpreta — el problema que obliga a separar los dos
// ficheros es específico del bundler de React Server Components de Next, no de este test runner.
import { describe, expect, it } from "vitest";
import { metadatos } from "./metadatos.ts";
import { registro } from "./registro.ts";

describe("metadatos — gemelo seguro para servidor de registro", () => {
  it("tiene exactamente una entrada por historia de registro, en el mismo orden", () => {
    expect(metadatos.map((m) => m.slug)).toEqual(registro.map((h) => h.slug));
  });

  it("nombre, familia y descripción coinciden campo a campo con su historia", () => {
    for (const metadato of metadatos) {
      const historia = registro.find((h) => h.slug === metadato.slug);
      expect(historia, `registro.ts no tiene ninguna historia con slug "${metadato.slug}"`).toBeDefined();
      expect(metadato.nombre).toBe(historia!.nombre);
      expect(metadato.familia).toBe(historia!.familia);
      expect(metadato.descripcion).toBe(historia!.descripcion);
    }
  });

  it("ningún slug se repite", () => {
    expect(new Set(metadatos.map((m) => m.slug)).size).toBe(metadatos.length);
  });
});
