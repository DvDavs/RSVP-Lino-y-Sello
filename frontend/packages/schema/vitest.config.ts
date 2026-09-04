// packages/schema/vitest.config.ts — umbrales de contratos.md §6 / 06-pruebas-y-calidad.md §2.2.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.{test,contract.test}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "lcov"],
      all: true,
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: { lines: 90, functions: 95, branches: 85, statements: 90 },
    },
  },
});
