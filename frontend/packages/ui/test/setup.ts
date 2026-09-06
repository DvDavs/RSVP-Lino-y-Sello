import "@testing-library/jest-dom/vitest";
import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";

// `vitest.config.ts` no activa `test.globals`, así que Testing Library no detecta un `afterEach`
// global y no desmonta solo entre pruebas: sin esto, dos `it()` que renderizan en el mismo archivo
// comparten `document.body` y el segundo ve los nodos del primero (mismo motivo documentado en
// `packages/icons/test/setup.ts`).
afterEach(cleanup);

// Registrado una vez para todo el paquete (fase 3-C, bloque 2): cada `*.test.tsx` puede llamar
// `expect.extend(toHaveNoViolations)` igualmente sin error (jest-axe lo tolera dos veces), pero con
// esto ya no hace falta repetirlo en cada archivo nuevo.
expect.extend(toHaveNoViolations);

// jsdom no implementa `ResizeObserver`; lo necesita el popper interno de Radix (Tooltip, Select,
// Popover) para medir el disparador. Solo hace falta que exista, no que mida nada real.
class ResizeObserverFalso {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverFalso as unknown as typeof ResizeObserver;
}

// jsdom tampoco implementa la captura de puntero (`Element.prototype.{has,set,release}PointerCapture`),
// que usa el gesto de deslizar para cerrar del `Toast` de Radix. Sin esto, un clic simulado por
// `userEvent` en cualquier tostada lanza `TypeError: target.hasPointerCapture is not a function`.
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture !== "function") {
  Element.prototype.releasePointerCapture = () => {};
}
