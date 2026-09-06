# CI real en GitHub Actions — qué difería del runner y cómo se corrigió

Alcance: `.github/workflows/**`, `scripts/**` que el CI invoca y esta memoria. **Cero** cambios en
código de producto, pruebas, `build.gradle.kts` o `frontend/**`.

## 0. El punto de partida no era el del encargo
El workflow **sí** se había ejecutado: 19 corridas en `claude/fase-3-frontend-orchestration-yuh8sx`
(la última, [run 33952077339](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/33952077339)),
todas en rojo. `backend` y `frontend` pasaban; `e2e` moría **en 0 s** en el primer paso de Playwright,
corrida tras corrida, sin que nadie leyera el log. Ninguna e2e se ejecutó jamás en el runner.

## 1. Divergencias runner/local, corregidas
1. **`pnpm exec playwright` desde `frontend/` no resuelve nada**: `@playwright/test` es dependencia de
   `apps/web`, no de la raíz. En el contenedor de desarrollo colaba por un `playwright` **global** en
   el PATH (`/opt/node22/bin`, 1.56.1); en el runner falla con «not found». → `pnpm --filter web exec`.
2. **Las 124 capturas de referencia son de Chromium 1194** (141.0.7390.37), el de `/opt/pw-browsers`
   que `playwright.config.ts` fuerza por `executablePath`, no el 1234 de `@playwright/test@1.62.1`. →
   el CI instala esa revisión (`npx playwright-core@1.56.0 install chromium`) y la señala con
   `PW_CHROMIUM_PATH`, variable que ambas configs ya leían. Issue **I-CI-02**.
3. **`ffmpeg`**: `video: "retain-on-failure"` graba en TODAS las pruebas; el paso original solo
   instalaba el navegador. 4. **El arranque del backend no esperaba a nada**: el bucle del `run:` terminaba sin comprobar nada. →
   `scripts/ci-backend.sh`, con espera activa, aborto si el proceso muere o el log dice «APPLICATION
   FAILED TO START», y fallo del paso con las últimas 60 líneas. 5. **Webhook sin cablear**: `TEMPLATES2_REVALIDATE_URL`/`_TOKEN` llegan vacías de
   `application.yml` (ADR-2-6-01) y las fija `dev-backend.sh`, que el CI no usa; sin ellas
   `render-publico.spec.ts` mediría un 401. 6. **`psql` del runner está en `/usr/bin`**, no en
   `/usr/lib/postgresql/16/bin` (defecto de `seed-demo.sh`) → `TPL_TEST_PGBIN` resuelto por PATH.
7. **Las pruebas también hablan con Postgres**: `e2e/preparar.ts:32` abre `psql` (la fila de
   `invitation` no tiene ruta HTTP, ADR-2-4-02) con `TPL_DEV_DB` —defecto `invitaciones_dev`, que en
   CI no existe— y sin contraseña. El clúster local usa `trust`; el servicio `postgres:16` no.
   **46 de 77 pruebas en rojo por esto.** → `TPL_DEV_DB`, `TPL_TEST_STATE_DIR` y `PGPASSWORD` en el paso.
8. **Sin caché de Gradle en `e2e`**: el mismo `gradle/actions/setup-gradle@v4` que el job `backend`.
   Con caché, el backend arranca en 94 s.

## 2. Estructura, tiempos y anti-flake
Los jobs corrían en cadena (`e2e` con `needs: [backend, frontend]`) y la galería era un paso de `e2e`.
Con el objetivo de < 25 min: los cuatro arrancan **en paralelo** y la galería (279 pruebas, sin backend
ni Postgres, `webServer` propio en el 3133) pasa a job propio `design`. Ninguna prueba se recorta:
cambian de job, no desaparecen. `a11y-publico.spec.ts` corre en una segunda invocación con
`--workers=1`; el resto conserva los 4, y las dos llevan `--fail-on-flaky-tests`. Sin `skip` ni
`fixme`: issue **I-CI-01** en `issues-ci.md`.
