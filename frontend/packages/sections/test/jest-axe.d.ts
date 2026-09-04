// packages/sections/test/jest-axe.d.ts — `jest-axe@11.0.0` no publica declaraciones de tipo
// propias (verificado [V]: node_modules/jest-axe no trae ningún .d.ts) y `@types/jest-axe` no
// está en el package.json exacto de `04 §2.1`. Declaración mínima, solo lo que este paquete usa.
//
// Deliberadamente SIN `import`/`export` propio: un archivo `.d.ts` que es "script" (sin ningún
// import/export de nivel superior) declara el módulo ambiental de forma GLOBAL para todo el
// programa. Si este archivo tuviera un `import` de nivel superior (como `import "vitest"` para
// augmentar `Assertion`), pasaría a ser un MÓDULO y `declare module "jest-axe"` dejaría de
// aplicarse globalmente — verificado [V]: separado en dos archivos por eso (ver
// `vitest-matchers.d.ts` para la augmentación de `Assertion`).
declare module "jest-axe" {
  export interface AxeResults {
    readonly violations: ReadonlyArray<{ readonly id: string; readonly description: string }>;
  }
  export function axe(container: Element | Document): Promise<AxeResults>;
  // Objeto matcher listo para `expect.extend(toHaveNoViolations)`, NO una función suelta
  // (verificado [V] en node_modules/jest-axe/index.js:125 — ver setup.ts).
  export const toHaveNoViolations: {
    toHaveNoViolations(results: AxeResults): { pass: boolean; message: () => string };
  };
}
