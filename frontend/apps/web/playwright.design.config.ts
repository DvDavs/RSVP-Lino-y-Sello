import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// playwright.design.config.ts — regresión visual, contraste y axe de la galería `/design` (fase
// 3-C, bloque 2, F3). Config APARTE de `playwright.config.ts` a propósito (brief 3c-b2-f3 §4):
//
//   - `playwright.config.ts` exige backend real (Postgres, `scripts/seed-demo.sh`) porque su
//     `globalSetup` (`e2e/global-setup.ts`) autentica la cuenta de demostración ANTES de arrancar
//     ningún worker (`06 §8.2`/ADR-1R-C-11). La galería de diseño no llama al backend ni una vez:
//     son fixtures de `@invitaciones/tokens`/`@invitaciones/ui`, nada de red. Compartir esa config
//     obligaría a este proyecto a levantar Postgres y sembrar datos que nunca usa.
//   - Por eso: SIN `globalSetup` aquí, y un `webServer` PROPIO en el puerto 3133 (distinto del 3000
//     de la config principal) que solo hace `next build && next start` — nada de
//     `NEXT_PUBLIC_API_BASE_URL`, `REVALIDATE_SECRET` ni el resto de variables que la config
//     principal pasa para el editor/render público, porque `/design/**` no las lee.
//
// Ejecuta SOLO `design.spec.ts`, `design-contraste.spec.ts`, `design-axe.spec.ts` y
// `design-objetivos.spec.ts` (tamaño de objetivo y foco visible, revisión del bloque 2)
// (`testMatch` más abajo); el resto de `e2e/*.spec.ts` los sigue corriendo `playwright.config.ts`.
const RUTA_CHROMIUM_LOCAL = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = existsSync(RUTA_CHROMIUM_LOCAL) ? RUTA_CHROMIUM_LOCAL : undefined;

const PUERTO = process.env.PW_DESIGN_PORT ?? "3133";
const ORIGEN = `http://127.0.0.1:${PUERTO}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["design.spec.ts", "design-contraste.spec.ts", "design-axe.spec.ts", "design-objetivos.spec.ts"],
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    // Umbral estricto (brief 3c-b2-f3 §4): 0,1 % de píxeles distintos. `animations: "disabled"` es
    // la compuerta redundante de Playwright sobre la misma regla de `11 §6.2`: además de que
    // `reducedMotion` (abajo) apague las animaciones que la propia hoja de estilos condiciona a
    // `prefers-reduced-motion`, esto fija/termina cualquier `transition`/`animation` CSS que no lo
    // esté (p. ej. la de color al cambiar de tema) antes de capturar.
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled" },
  },
  reporter: [["list"]],
  use: {
    baseURL: ORIGEN,
    trace: "on-first-retry",
    // `11 §6.2` regla 5: con `reduce` no debe quedar `animation` viva ni `transition` de `transform`
    // (`shapes.css`, `componentes.css`). Se combina con `animations:"disabled"` de arriba porque esa
    // opción solo actúa en el instante de `toHaveScreenshot`; esto lo deja así durante TODA la
    // prueba (relevante para `design-contraste.spec.ts`, que no toma capturas). `reducedMotion` no
    // es una opción de primer nivel en los tipos de esta versión de Playwright (a diferencia de
    // `colorScheme`): va anidada en `contextOptions`.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    {
      name: "design",
      use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : {} },
    },
  ],
  webServer: {
    command: `pnpm run build && pnpm run start`,
    url: `${ORIGEN}/design`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: PUERTO,
    },
  },
});
