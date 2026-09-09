# CI real en GitHub Actions — qué difería del runner y cómo se corrigió
Corrida verde: <https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/34053300447> (`c835654`,
10 min 15 s). Alcance tocado: `.github/workflows/**`, `scripts/**` que el CI invoca y esta memoria.
**Cero** cambios en código de producto, pruebas, `build.gradle.kts` o `frontend/**`.
## 0. El punto de partida no era el del encargo
El workflow **sí** se había ejecutado: 19 corridas en `claude/fase-3-frontend-orchestration-yuh8sx`
([la última](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/33952077339)), todas en rojo:
`backend` y `frontend` pasaban y `e2e` moría **en 0 s** en el primer paso de Playwright, corrida
tras corrida, sin que nadie leyera el log. Ninguna e2e se había ejecutado jamás en el runner.
## 1. Divergencias runner/local, corregidas
1. **`pnpm exec playwright` desde `frontend/` no resuelve nada**: `@playwright/test` es dependencia
   de `apps/web`, no de la raíz; en desarrollo colaba por un `playwright` **global** en el PATH
   (`/opt/node22/bin`, 1.56.1). → `pnpm --filter web exec`.
2. **Las 124 capturas de referencia son de Chromium 1194** (141.0.7390.37), el de `/opt/pw-browsers`
   que `playwright.config.ts` fuerza por `executablePath`, no el 1234 de `@playwright/test@1.62.1`.
   → el CI instala esa revisión (`npx playwright-core@1.56.0 install chromium`) y la señala con
   `PW_CHROMIUM_PATH`, que ambas configs ya leían. Issue **I-CI-02**.
3. **`ffmpeg`**: `video: "retain-on-failure"` graba en TODAS las pruebas y el paso solo instalaba el
   navegador. 4. **El arranque del backend no esperaba a nada** → `scripts/ci-backend.sh`: espera
   activa, aborto si el proceso muere o el log dice «APPLICATION FAILED TO START», y fallo con log.
5. **Webhook sin cablear**: `TEMPLATES2_REVALIDATE_URL`/`_TOKEN` llegan vacías de `application.yml`
   (ADR-2-6-01) y las fija `dev-backend.sh`, que el CI no usa; sin ellas `render-publico.spec.ts`
   mediría un 401. 6. **`psql` del runner está en `/usr/bin`** → `TPL_TEST_PGBIN` por PATH.
7. **Las pruebas también hablan con Postgres**: `e2e/preparar.ts:32` abre `psql` (la fila de
   `invitation` no tiene ruta HTTP, ADR-2-4-02) con `TPL_DEV_DB` —defecto `invitaciones_dev`,
   inexistente en CI— y sin contraseña; el clúster local usa `trust`, el servicio `postgres:16` no.
   **46 de 77 en rojo.** → `TPL_DEV_DB`, `TPL_TEST_STATE_DIR` y `PGPASSWORD` en el paso.
8. **Sin caché de Gradle en `e2e`**: el `setup-gradle@v4` del job `backend`; con ella el backend
   arranca en 1 m 56 s. 9. **`workers: 4` no se había medido nunca**: el «79/79» de la fase 3-C se midió en local, donde
   `workers: CI ? 4 : undefined` da **2**. Medido en el runner sobre el mismo código: 4 workers → 5
   fallos + 2 flaky; 2 workers → 1 fallo + 1 flaky. El que sobrevive no es reloj:
   `editor-3c-evidencia.spec.ts` abre la invitación SEMBRADA COMPARTIDA sin el mutex
   `conLockDeInvitacionSembrada` (`preparar.ts:110`). → una sola invocación con `--workers=1
   --timeout=60000`: **ADR-CI-01**, issue **I-CI-01**.
## 2. Estructura, tiempos y anti-flake
Los jobs corrían en cadena (`e2e` con `needs: [backend, frontend]`) y la galería era un paso de
`e2e`. Con el objetivo de < 25 min: los cuatro arrancan **en paralelo** y la galería (279 pruebas,
sin backend ni Postgres, `webServer` propio en el 3133) pasa a job propio `design`. Ninguna prueba
se recorta: cambian de job, no desaparecen. Verde: `backend` 5 m 57 s · `frontend` 6 m 04 s ·
`design` 6 m 09 s (279/279) · `e2e` 10 m 11 s (79/79 contra el backend real + LHCI).
Anti-flake: `--fail-on-flaky-tests` en la única invocación, sin `skip` ni `fixme` en el árbol.

## 3. Tarea I-CI-01 (2026-09-09) — aislamiento cerrado, paralelismo NO
**Workers finales: 1** (`--workers=1 --timeout=60000`, y `playwright.config.ts` dice ahora
`workers: CI ? 1` para no prometer un 4 que el runner no sostiene). El job `design` conserva sus 4:
no tiene backend detrás.
- **Cerrado**: I-CI-01. `editor-3c-evidencia.spec.ts` ya no comparte la invitación sembrada sin
  protección (su prueba de `axe` crea la suya; la de capturas toma el mutex y se queda con la
  sembrada a propósito: es evidencia versionada y el lienzo ya está caliente).
  `a11y-publico.spec.ts` dejó de purgar la caché ISR compartida y muestrea `axe` con la página
  quieta. Detalle y medidas en `bitacora/ci-i-ci-01.md`.
- **Abierto**: **I-CI-03**. Con 2 workers el runner sigue rojo, y ya no por datos: el lienzo del
  editor no pinta dentro de su presupuesto (`expect` 5 s de la config; 20 s en `teclado-editor`).
  Tres corridas lo miden. En local la misma suite pasa con 4 workers en 1,3 min.
- **Disparadores**: se añaden a `push` `claude/fase-4-kit-de-autor` y `claude/fase-5-producto` (sin
  ellas la fase 5 no tendría CI). Sin comodines: ~28 min de Actions por corrida (`issues-ci.md`).
- **`scripts/ci-backend.sh`**: el backend del job arranca desde el **jar** (`bootJar` + `java -jar`)
  y no con `bootRun`. De cuatro procesos java vivos durante las pruebas a uno, y de paso el CI
  prueba el artefacto de producción. Arranque medido: 18,7 s en local, ~2 min con la compilación.
- **Tiempos del job `e2e`** con un worker y el jar: ver la última corrida verde de la rama.
