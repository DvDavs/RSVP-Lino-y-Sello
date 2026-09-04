// packages/sections/test/harness-c/vite.config.ts — servidor de desarrollo SOLO para el banco de
// capturas (TAREA 3, brief 3-2c). No es parte del build del paquete (`package.json` no lo
// referencia): se invoca a mano con `npx vite --config test/harness-c/vite.config.ts` desde
// `screenshot.mjs`. Mismo plugin (`@vitejs/plugin-react`) que ya usa `vitest.config.ts`.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { placeholderSvgMarkup } from "./placeholder-image.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** Sirve `/ph/<seed>.svg` con la MISMA generación que usa `placeholder-image.ts` en el
 *  navegador — así `ResolvedValue.image.url` puede ser una URL http(s) real y servible (exigida
 *  por el esquema, ver comentario largo en `placeholder-image.ts`) sin depender de red externa. */
function placeholderImagesPlugin(): Plugin {
  return {
    name: "harness-c-placeholder-images",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/^\/ph\/(\d+)\.svg$/);
        if (!match) return next();
        const seed = Number(match[1]);
        res.setHeader("Content-Type", "image/svg+xml");
        res.end(placeholderSvgMarkup(seed));
      });
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [react(), placeholderImagesPlugin()],
  server: {
    port: 4173,
    strictPort: true,
  },
});
