// packages/sections/test/harness-b/vite.config.ts — servidor de desarrollo SOLO para el banco de
// capturas (independiente de `vitest.config.ts`, que es de pruebas, no de un servidor navegable).
// No se usa en CI ni en `pnpm test`: solo lo arranca `screenshot.mjs`.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  server: { host: "127.0.0.1" },
  logLevel: "warn",
});
