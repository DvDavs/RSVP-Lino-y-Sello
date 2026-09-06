// packages/ui/test/jest-axe.d.ts — `jest-axe@11.0.0` no publica declaraciones de tipo propias
// (verificado [V]: `node_modules/jest-axe` no trae ningún `.d.ts`) y `@types/jest-axe` no está en
// el `package.json` exacto del paquete. Declaración mínima, solo lo que este paquete usa. Mismo
// patrón que `packages/sections/test/jest-axe.d.ts` (misma causa, mismo paquete `jest-axe`).
//
// Deliberadamente SIN `import`/`export` propio: un archivo `.d.ts` que es "script" (sin ningún
// import/export de nivel superior) declara el módulo ambiental de forma GLOBAL para todo el
// programa. Si este archivo tuviera un `import` de nivel superior (como `import "vitest"` para
// augmentar `Assertion`), pasaría a ser un MÓDULO y `declare module "jest-axe"` dejaría de aplicarse
// globalmente — por eso está separado en dos archivos (ver `vitest-matchers.d.ts`).
declare module "jest-axe" {
  export interface AxeResults {
    readonly violations: ReadonlyArray<{ readonly id: string; readonly description: string }>;
  }
  export function axe(container: Element | Document): Promise<AxeResults>;
  // Objeto matcher listo para `expect.extend(toHaveNoViolations)`, NO una función suelta.
  export const toHaveNoViolations: {
    toHaveNoViolations(results: AxeResults): { pass: boolean; message: () => string };
  };
}
