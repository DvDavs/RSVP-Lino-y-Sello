import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `vitest.config.ts` no activa `test.globals`, así que Testing Library no detecta un `afterEach`
// global y no desmonta solo entre pruebas (14 §"auto cleanup" solo se activa si ve la función
// global). Sin esto, dos pruebas que renderizan el mismo icono comparten `document.body` y la
// segunda ve los nodos de la primera.
afterEach(cleanup);
