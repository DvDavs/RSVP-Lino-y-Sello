import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import "@testing-library/jest-dom/vitest";

// `jest-axe` exporta ya el objeto matcher (mismo patrón que `packages/sections/test/setup.ts`):
// `expect.extend` se llama directamente con el objeto, sin envolverlo en `{ toHaveNoViolations }`.
expect.extend(toHaveNoViolations);

// Radix (Select/Popover/Combobox) usa `ResizeObserver` para medir el disparador y `PointerEvent`
// para el puntero; jsdom no implementa ninguno de los dos (`bitacora/3c-b2-f1.md`). Sustitutos
// mínimos, solo para que las pruebas no revienten con un ReferenceError — no miden nada real, así
// que el tamaño/posición del panel flotante no es parte de lo que estas pruebas comprueban.
if (typeof window !== "undefined") {
  if (!("ResizeObserver" in window)) {
    class ResizeObserverSimulado {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error — sustituto mínimo, ver comentario de arriba.
    window.ResizeObserver = ResizeObserverSimulado;
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

afterEach(() => {
  cleanup();
});
