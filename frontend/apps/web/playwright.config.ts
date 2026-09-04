import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// playwright.config.ts — `06-pruebas-y-calidad.md` §8-§9 (ADR-026 + ADR-1R-C-12), con la corrección
// medida de `handoffs/3-0b.md` §1/§4: el Chromium preinstalado de este entorno
// (`/opt/pw-browsers`) es la revisión 1194 y `@playwright/test@1.62.1` espera la 1234
// (`Executable doesn't exist … chromium_headless_shell-1234`), y `contratos.md §7` prohíbe
// `playwright install`. En CI (`.github/workflows/ci.yml`, job `e2e`) SÍ se instalan navegadores
// (no existe `/opt/pw-browsers` ahí), así que `executablePath` solo se fija cuando esa ruta EXISTE
// en disco — en CI, `existsSync` da `false` y Playwright usa el Chromium que el propio job instaló.
const RUTA_CHROMIUM_LOCAL = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = existsSync(RUTA_CHROMIUM_LOCAL) ? RUTA_CHROMIUM_LOCAL : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  // 06 §8.2.1: un reintento en CI, solo para arranques lentos del servidor; una prueba que solo
  // pasa en el reintento se reporta "flaky" y el job falla igual con `--fail-on-flaky-tests`.
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : {} },
    },
  ],
  webServer: {
    // Producción, nunca `next dev` (C5, `handoffs/3-0b.md` §1): en desarrollo Next monta HMR y
    // necesita `'unsafe-eval'`, que es justo la CSP que la ruta del lienzo prohíbe.
    command: "pnpm run build && pnpm run start",
    // HALLAZGO verificado (no en `06 §9`): Playwright solo da el `webServer` por listo ante una
    // respuesta HTTP < 400. La app no tiene página en `/` (todas las rutas viven bajo grupos:
    // `/editor`, `/i/[publicToken]`…), así que `/` cae en `app/not-found.tsx` con `404` — Playwright
    // esperaba para siempre y agotaba el `timeout` de 180 s aunque el servidor estuviera arriba
    // (confirmado: `curl 127.0.0.1:3000/` responde en <200 ms). Se apunta a `/editor`, que responde
    // `200` de verdad.
    url: "http://127.0.0.1:3000/editor",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003",
      // Bloque 3-3: `e2e/render-publico.spec.ts` recorre el ciclo real de `04 §15.2` (publicar →
      // webhook → recargar) golpeando `POST /api/revalidate`. Ese handler RECHAZA TODO si no hay
      // `REVALIDATE_SECRET` configurado (`app/api/revalidate/route.ts:40`), así que sin esta línea
      // la prueba mediría un 401, no la revalidación.
      REVALIDATE_SECRET: process.env.REVALIDATE_SECRET ?? "e2e-secreto-de-pruebas",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
      NEXT_PUBLIC_EDITOR_ORIGIN: process.env.NEXT_PUBLIC_EDITOR_ORIGIN ?? "http://127.0.0.1:3000",
      NEXT_PUBLIC_CDN_ORIGIN: process.env.NEXT_PUBLIC_CDN_ORIGIN ?? "http://127.0.0.1:6003",
    },
  },
});
