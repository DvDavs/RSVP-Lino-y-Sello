// test/setup.ts — arranque de Vitest + jsdom (Testing Library 16.3.3, jsdom 30.0.1). Limpia el DOM
// y el `sessionStorage` simulado entre pruebas para que ninguna deje el token de sesión filtrado a
// la siguiente (P8: el aislamiento entre pruebas también es parte de "un solo lugar").
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
