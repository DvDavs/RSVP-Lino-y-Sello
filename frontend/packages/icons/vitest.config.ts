import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Mismo arnés que packages/sections (Vitest 5 + Testing Library + jsdom). Los umbrales de cobertura
// los fija el agente que llena el paquete (fase 3-C, bloque 1/2); el esqueleto solo garantiza que
// `vitest run` arranca.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: true,
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    coverage: { provider: "v8", reporter: ["text", "json-summary"], include: ["src/**/*.{ts,tsx}"], exclude: ["src/**/*.d.ts", "src/**/*.test.{ts,tsx}"] },
  },
});
