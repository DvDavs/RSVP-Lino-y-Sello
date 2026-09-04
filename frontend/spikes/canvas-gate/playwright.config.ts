import { defineConfig, devices } from "@playwright/test";

/**
 * `contratos.md §7`: Chromium PREINSTALADO en `/opt/pw-browsers`. **No** se ejecuta
 * `playwright install`. Escritorio 1440×900, que es la medida de las capturas de evidencia.
 */
const APP = "http://127.0.0.1:6100";
const CDN = "http://127.0.0.1:6003";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: APP,
    // Después de `devices`, que trae su propio viewport: las capturas son 1440×900 exactos.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: "chromium",
      use: {
        viewport: { width: 1440, height: 900 },
        // El Chromium preinstalado es la revisión **1194** y `@playwright/test@1.62.1` espera la
        // 1234, así que hay que apuntarlo a mano. La alternativa sería `playwright install`, que
        // `contratos.md §7` prohíbe. Verificado: la 1194 conduce bien con este driver.
        launchOptions: {
          executablePath:
            process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        },
      },
    },
  ],
  webServer: {
    // Producción, no `next dev`: en desarrollo Next necesita `'unsafe-eval'` y monta HMR, y un
    // lienzo que corre con otra política que en producción es justo la divergencia que C5 prohíbe.
    command: "npx next start -p 6100 -H 127.0.0.1",
    url: APP,
    // `false` a propósito: reutilizar un `next start` viejo sirve un manifiesto obsoleto y da 500
    // en los chunks (pasó durante este spike). Playwright levanta y para su propio servidor.
    reuseExistingServer: false,
    timeout: 60_000,
    env: { NEXT_PUBLIC_EDITOR_ORIGIN: APP, NEXT_PUBLIC_CDN_ORIGIN: CDN },
  },
});
