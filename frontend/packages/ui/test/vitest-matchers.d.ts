// packages/ui/test/vitest-matchers.d.ts — augmenta el `expect` de Vitest con el matcher
// `toHaveNoViolations` que `test/setup.ts` registra vía `expect.extend`. Ver `jest-axe.d.ts` para
// por qué esto vive en un archivo aparte (necesita ser un MÓDULO, `declare module "jest-axe"` NO).
//
// Los miembros van directo en cada interfaz (no por `extends` de una interfaz compartida): un
// `extends` sin miembros propios dispara `@typescript-eslint/no-empty-object-type` (verificado
// [V] — el mismo patrón en `packages/sections/test/vitest-matchers.d.ts` lo dispara también, pero
// el `lint` de ese paquete es hoy un placeholder que no lo corre; el de `@invitaciones/ui` sí).
import "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}
