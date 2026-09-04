// packages/sections/test/setup.ts — cargado por vitest.config.ts (setupFiles).
//
// Deliberado: NO se añade `@testing-library/jest-dom` como dependencia porque el package.json
// exacto de `04 §2.1` no lo incluye (tarea 1: "package.json exacto"). Las pruebas usan aserciones
// de DOM planas (`.textContent`, `.querySelector`, `.getAttribute`) en vez de `.toBeInTheDocument()`.
import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";

// `jest-axe` exporta YA el objeto matcher `{ toHaveNoViolations(results) {...} }` (verificado [V]
// en node_modules/jest-axe/index.js:125) — envolverlo en `{ toHaveNoViolations }` otra vez
// (como haría con una función suelta) anida un nivel de más y rompe el matcher en tiempo de
// ejecución ("expectAssertion.call is not a function"). `expect.extend` se llama directamente
// con el objeto, sin envolver.
expect.extend(toHaveNoViolations);

afterEach(() => {
  cleanup();
});
