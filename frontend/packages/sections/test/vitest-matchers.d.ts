// packages/sections/test/vitest-matchers.d.ts — augmenta el `expect` de Vitest con el matcher
// `toHaveNoViolations` que `test/setup.ts` registra vía `expect.extend`. Ver `jest-axe.d.ts` para
// por qué esto vive en un archivo aparte (necesita ser un MÓDULO, `declare module "jest-axe"` NO).
import "vitest";

interface JestAxeMatchers<R = unknown> {
  toHaveNoViolations(): R;
}

declare module "vitest" {
  interface Assertion<T = unknown> extends JestAxeMatchers<T> {}
  interface AsymmetricMatchersContaining extends JestAxeMatchers {}
}
