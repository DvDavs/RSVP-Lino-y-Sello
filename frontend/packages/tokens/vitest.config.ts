import { defineConfig } from "vitest/config";

// Paquete sin DOM: pruebas en Node (la fuente es TS puro; el CSS lo genera un script).
// Umbrales altos a propósito: aquí no hay ramas difíciles de alcanzar, solo datos y funciones
// puras, así que un hueco de cobertura significa código muerto o un token sin probar.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.ts"],
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
