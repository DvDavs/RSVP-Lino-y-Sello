import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest 5.0.0 + Testing Library 16.3.3 + jsdom 30.0.1 (04 §2.1, §20.1).
// Sin tailwindcss: los .module.css los procesa Vite de forma nativa (CSS Modules incorporado),
// no hace falta ningún plugin extra ni PostCSS (04 §19: packages/sections no depende de tailwind).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: true,
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
      // contratos.md §6: sections 70 % líneas / 75 % funciones / 60 % ramas.
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 60,
      },
    },
  },
});
