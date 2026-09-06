// packages/ui/src/historias/registro.test.tsx — compuerta de humo del registro de historias:
// cada `render()` de cada variante/estado debe montar sin lanzar y sin violaciones de axe. No
// sustituye las pruebas propias de cada componente (interacción, teclado, estados): solo comprueba
// que lo que queda enlazado a la galería `/design/componentes` (F3) es, de hecho, renderizable.
import { describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "jest-axe";
import { historiaPorSlug, registro } from "./registro.ts";

describe("registro de historias", () => {
  it("tiene slugs únicos, ordenados alfabéticamente, con al menos una variante", () => {
    const slugs = registro.map((h) => h.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual([...slugs].sort());
    for (const historia of registro) {
      expect(historia.variantes.length).toBeGreaterThan(0);
    }
  });

  it("historiaPorSlug encuentra por slug y no encuentra lo inexistente", () => {
    expect(historiaPorSlug("button")?.nombre).toBe("Button");
    expect(historiaPorSlug("no-existe")).toBeUndefined();
  });

  for (const historia of registro) {
    describe(`${historia.slug}`, () => {
      for (const variante of historia.variantes) {
        it(`variante "${variante.nombre}" renderiza sin violaciones de axe`, async () => {
          const { container } = render(<>{variante.render()}</>);
          const resultados = await axe(container);
          expect(resultados).toHaveNoViolations();
          cleanup();
        });
      }
      for (const estado of historia.estados ?? []) {
        it(`estado "${estado.nombre}" renderiza sin violaciones de axe`, async () => {
          const { container } = render(<>{estado.render()}</>);
          const resultados = await axe(container);
          expect(resultados).toHaveNoViolations();
          cleanup();
        });
      }
    });
  }
});
