import { defineConfig } from "vitest/config";

// Paquete sin DOM: pruebas en Node. Los umbrales de cobertura los fija el agente que llena el
// paquete (fase 3-C, bloque 1); el esqueleto solo garantiza que `vitest run` arranca.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    coverage: { provider: "v8", reporter: ["text", "json-summary"], include: ["src/**/*.ts"], exclude: ["src/**/*.d.ts", "src/**/*.test.ts"] },
  },
});
