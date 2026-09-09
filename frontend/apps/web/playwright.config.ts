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

// Puerto del servidor de pruebas. Configurable porque `reuseExistingServer` da por bueno CUALQUIER
// servidor que ya escuche en el puerto — incluido el de otra sesión de trabajo sobre otro árbol —,
// y entonces los e2e miden un build que no es el de este código (visto en el bloque 3-4).
const PUERTO = process.env.PW_PORT ?? "3000";
const ORIGEN = `http://127.0.0.1:${PUERTO}`;

export default defineConfig({
  testDir: "./e2e",
  // 3C-8: `design.spec.ts`, `design-contraste.spec.ts`, `design-axe.spec.ts` y
  // `design-objetivos.spec.ts` son el proyecto APARTE de `playwright.design.config.ts` (brief
  // 3c-b2-f3 §4: sin backend, `webServer` propio en :3133). Sin este `testIgnore`, esta config
  // TAMBIÉN los recoge (mismo `testDir`) y los corre contra :3000 con backend real — generan
  // capturas `*-chromium-linux.png` espurias que no son las de referencia (`*-design-linux.png`) y
  // duplican el trabajo. Detectado en `handoffs/3c-6-parcial.md` §3.5.
  testIgnore: ["design.spec.ts", "design-contraste.spec.ts", "design-axe.spec.ts", "design-objetivos.spec.ts"],
  // Bloque 3-6, política anti-flake (`contratos.md` §6 / ADR-1R-C-11): autentica la cuenta de
  // demostración UNA SOLA VEZ, antes de que arranque ningún worker — ver `e2e/global-setup.ts`.
  // Sin esto, `fullyParallel: true` dispara logins concurrentes de la MISMA cuenta y provoca el 500
  // de `RefreshTokenService.kt:20` (módulo `auth` antiguo, ajeno — `preguntas-abiertas.md` § P-3-3b-8).
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // I-CI-01 / I-CI-03, medido en el runner de GitHub (no en local): con 2 workers la suite falla,
  // pero YA NO por aislamiento —eso se arregló en `editor-3c-evidencia.spec.ts` y se verificó— sino
  // porque el LIENZO del editor no pinta dentro de su presupuesto cuando dos Chromium comparten los
  // 4 vCPU con el backend, `next start` y Postgres: `teclado-editor` E-10a a 20 s (corrida
  // 34299786630) y `editor-nucleo` E-N2 en el `expect` de 5 s de aquí abajo (34304958215). En LOCAL,
  // en cambio, la suite entera pasa con 4 workers en 1,3 min. El `4` de antes nunca se midió en CI
  // y ponía en la configuración un número que el runner no sostiene; el `1` dice la verdad y es el
  // único con verde repetido. Subirlo exige cerrar I-CI-03, no tocar esta línea.
  // El job `design` (`playwright.design.config.ts`, sin backend) conserva sus 4: ahí sí caben.
  workers: process.env.CI ? 1 : undefined,
  // 06 §8.2.1: un reintento en CI, solo para arranques lentos del servidor; una prueba que solo
  // pasa en el reintento se reporta "flaky" y el job falla igual con `--fail-on-flaky-tests`.
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"]],
  use: {
    baseURL: ORIGEN,
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
    // respuesta HTTP < 400. Cuando se escribió esto la app no tenía página en `/` (todas las rutas
    // vivían bajo grupos: `/editor`, `/i/[publicToken]`…) y `/` caía en `not-found.tsx` con `404`,
    // así que Playwright esperaba para siempre. Desde la fase 3-C (3C-5) `/` es la PORTADA y
    // responde `200`, pero la sonda se queda en `/editor` a propósito: es la ruta que de verdad
    // demuestra que la aplicación arrancó con su cliente HTTP, no una página estática.
    url: `${ORIGEN}/editor`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // `next start` toma el puerto de `PORT`; pasarlo por argumento exigiria reescribir el script.
      PORT: PUERTO,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003",
      NEXT_PUBLIC_EDITOR_ORIGIN: process.env.NEXT_PUBLIC_EDITOR_ORIGIN ?? ORIGEN,
      // Bloque 3-3: `e2e/render-publico.spec.ts` recorre el ciclo real de `04 §15.2` (publicar →
      // webhook → recargar) golpeando `POST /api/revalidate`. Ese handler RECHAZA TODO si no hay
      // `REVALIDATE_SECRET` configurado (`app/api/revalidate/route.ts:40`), así que sin esta línea
      // la prueba mediría un 401, no la revalidación.
      REVALIDATE_SECRET: process.env.REVALIDATE_SECRET ?? "e2e-secreto-de-pruebas",
      // Bloque 3-8 (U-6): el enlace que la clienta comparte se construye ahora con el ORIGEN
      // PÚBLICO del sitio (`lib/enlace-publico.ts`), no con el `publicUrl` que devuelve el backend
      // (`http://localhost/i/…`, que no le abre a ningún invitado). Este valor estaba fijado a
      // `:3000` a mano: con `PW_PORT` distinto, el enlace apuntaba a OTRO servidor. Se deriva del
      // mismo `ORIGEN` que el resto de la configuración.
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? ORIGEN,
      NEXT_PUBLIC_CDN_ORIGIN: process.env.NEXT_PUBLIC_CDN_ORIGIN ?? "http://127.0.0.1:6003",
      // Enganche de pruebas del bloque 3-4: expone el store del editor en `window.__editorStore`
      // para conducir las 11 acciones desde Playwright mientras el panel de formularios (3-5) no
      // existe. Solo aquí; en un despliegue real esta variable no está definida.
      NEXT_PUBLIC_E2E_HOOKS: "1",
    },
  },
});
