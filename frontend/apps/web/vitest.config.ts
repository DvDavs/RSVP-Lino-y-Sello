// vitest.config.ts — umbrales de `contratos.md` §6 para `apps/web`: 60 % líneas / 65 % funciones /
// 50 % ramas. `functions` es obligatorio (una función de una sola sentencia nunca llamada puede
// reportar `Lines 100 %`, 06 §2.2).
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Mismo alias que `tsconfig.json` (`"@/*": ["./*"]`): sin él, un componente que importa
  // `@/lib/store` no resuelve bajo Vitest aunque `tsc` y Next sí lo resuelvan.
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: [
      "test/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "lcov"],
      // Vitest 5: `coverage.all` se retiró (informe siempre completo sobre `include`, no solo los
      // ficheros tocados por un test). Alcance de esta pasada (3-1, andamiaje): la lógica testeable de verdad — el cliente HTTP,
      // los errores tipados, el webhook de revalidación y los componentes de presentación pura. Las
      // páginas de ruta ((chrome)/(canvas)/(public)/**) son esqueleto de fetch+estado; su prueba de
      // integración real (con Testing Library sobre flujos completos) es de los bloques 3-4/3-5, que
      // sustituyen el contenido de esas páginas. Registrado en `memoria/bitacora/3-1.md`.
      // Bloque 3-4: se añade `components/editor/**` (el chrome del núcleo: indicador de guardado,
      // deshacer/rehacer, vista móvil y diálogo de conflicto). Las PÁGINAS de ruta siguen fuera:
      // su prueba real es Playwright contra el backend de verdad (`e2e/`), no jsdom.
      include: [
        "lib/**/*.{ts,tsx}",
        "app/api/**/*.{ts,tsx}",
        "components/ui/**/*.{ts,tsx}",
        "components/public/**/*.{ts,tsx}",
        "components/editor/**/*.{ts,tsx}",
        // Bloque 3-5: los 14 campos del panel de contenido y sus pruebas (U-17 y una por tipo de bloque).
        "components/fields/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
      thresholds: { lines: 60, functions: 65, branches: 50, statements: 60 },
    },
  },
});
