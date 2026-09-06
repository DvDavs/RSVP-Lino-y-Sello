# CI real en GitHub Actions — qué difería del entorno local y cómo se corrigió

Alcance de la tarea: `.github/workflows/**`, `scripts/**` que el CI invoca y esta memoria. Cero
cambios en código de producto, pruebas, `build.gradle.kts` o `frontend/**`.

## 0. El punto de partida no era el que decía el encargo
El workflow **sí** se había ejecutado antes: 19 corridas en `claude/fase-3-frontend-orchestration-yuh8sx`
(la última, [run 33952077339](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/33952077339)), todas
en rojo. `backend` y `frontend` pasaban; el job `e2e` moría **en 0 s** en el primer paso de Playwright,
corrida tras corrida, sin que nadie leyera el log. Ninguna e2e se había ejecutado jamás en el runner.

## 1. Divergencias runner/local encontradas y corregidas
1. **`pnpm exec playwright` desde `frontend/` no resuelve nada.** `@playwright/test` es dependencia de
   `apps/web`, no de la raíz. En el contenedor de desarrollo colaba porque hay un `playwright`
   **global** en el PATH (`/opt/node22/bin/playwright`, 1.56.1); en el runner el paso falla con
   «playwright: not found». → `pnpm --filter web exec …`.
2. **Las 124 capturas de referencia son de Chromium 1194** (141.0.7390.37), el preinstalado en
   `/opt/pw-browsers` que `playwright.config.ts` fuerza por `executablePath`, no el 1234 de
   `@playwright/test@1.62.1`. → el CI instala esa misma revisión (`npx playwright-core@1.56.0 install
   chromium`) y la señala con `PW_CHROMIUM_PATH`, variable que ambas configs ya leían. Issue **I-CI-02**.
3. **`ffmpeg`**: `video: "retain-on-failure"` graba en TODAS las pruebas, así que el binario es
   obligatorio aunque no haya fallos. El paso original solo instalaba el navegador.
4. **El arranque del backend no esperaba a nada.** El bucle del `run:` terminaba sin comprobar nada: un
   backend muerto se manifestaba después como un 401 de `seed-demo.sh`. → nuevo `scripts/ci-backend.sh`
   con espera activa, aborto si el proceso muere o el log dice «APPLICATION FAILED TO START», y fallo
   del paso con las últimas 60 líneas.
5. **Webhook de revalidación sin cablear.** `TEMPLATES2_REVALIDATE_URL`/`_TOKEN` llegan vacías de
   `application.yml` (ADR-2-6-01) y las fija `scripts/dev-backend.sh`, que el CI no usaba: sin ellas
   `e2e/render-publico.spec.ts` mediría un 401 en vez del ciclo publicar → webhook → recargar.
6. **`psql` del runner está en `/usr/bin`**, no en `/usr/lib/postgresql/16/bin`, que es el defecto de
   `seed-demo.sh` y de `pg-ephemeral.sh`. → se le pasa `TPL_TEST_PGBIN` resuelto por PATH. El script
   no se toca.
7. **Las propias pruebas hablan con Postgres.** `e2e/preparar.ts:32` abre `psql` (la fila de
   `invitation` no tiene ruta HTTP, ADR-2-4-02) leyendo la base de `TPL_DEV_DB` —defecto
   `invitaciones_dev`, que en CI no existe— y el puerto de `TPL_TEST_STATE_DIR/state.env`. Contra el
   clúster efímero local basta (autenticación `trust`); el servicio `postgres:16` pide contraseña.
   **46 de 77 pruebas en rojo por esto**, todas con «fe_sendauth: no password supplied». → se pasa
   `TPL_DEV_DB`, `TPL_TEST_STATE_DIR` y `PGPASSWORD` en el paso. Sin tocar `frontend/**`.
8. **Sin caché de Gradle en `e2e`**: el job compilaba el backend descargando todas las dependencias
   desde cero. → mismo `gradle/actions/setup-gradle@v4` que el job `backend`.

## 2. Estructura y tiempos
Los tres jobs corrían en cadena (`e2e` con `needs: [backend, frontend]`) y la galería de diseño era
un paso más de `e2e`. Con el objetivo de < 25 min de reloj: los jobs arrancan **en paralelo** y la
galería (279 pruebas, sin backend ni Postgres, `webServer` propio en el 3133) pasa a job propio
`design`. Ninguna prueba se recorta: cambian de job, no desaparecen.

## 3. Anti-flake
`a11y-publico.spec.ts` corre en una segunda invocación con `--workers=1`; el resto conserva los 4
workers. Las dos llevan `--fail-on-flaky-tests`. No hay `skip` ni `fixme`: issue **I-CI-01** en
`memoria/issues-ci.md` con la causa probable y a quién le toca cerrarla.
