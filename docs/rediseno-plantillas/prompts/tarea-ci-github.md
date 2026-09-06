Eres el ORQUESTADOR RAÍZ de una tarea acotada y paralela: hacer que el CI del repositorio `DvDavs/RSVP---Lino-Sello` corra de verdad en GitHub Actions y quede en verde. Hasta hoy `.github/workflows/ci.yml` existe (diseñado en la fase 1, escrito en la fase 2, con el job `e2e` activado en la fase 3) pero **nunca se ha ejecutado en GitHub**: todas las cifras del proyecto son de sesiones locales.

# RAMA
`git fetch origin claude/ci-github-actions && git checkout claude/ci-github-actions` (nace de la fase 3-C cerrada, `26f0d49`). Trabajas SOLO en `.github/workflows/**`, `scripts/**` que el CI invoque, y `docs/rediseno-plantillas/{memoria,evidencia/ci}`. Prohibido tocar código de producto, pruebas, `build.gradle.kts` o `frontend/**` salvo un defecto que solo aparezca en el runner y que quede demostrado (con ADR y revisor Opus). Otra sesión trabaja en paralelo en `claude/fase-4-kit-de-autor`: no la toques.

# LEE
`CLAUDE.md` → `memoria/brief-comun.md` → `memoria/contratos.md §6` (pruebas, umbrales, Postgres en CI con `services: postgres:16`, `TPL_TEST_JDBC_URL`, JDK 21, `PLAYWRIGHT_BROWSERS_PATH` del espacio de trabajo) → `diseno/06-pruebas-y-calidad.md §6 y §9` → `.github/workflows/ci.yml` completo (sus comentarios listan las desviaciones conocidas) → `memoria/handoffs/3c-para-siguiente.md` (trampas: construir con `pnpm run build` desde `frontend/`, `NEXT_PUBLIC_E2E_HOOKS` horneado en el build, `seed-demo.sh` lee `TPL_DEV_BASE`, Playwright exige `TPL_TEST_STATE_DIR`, nunca `pkill -f "next start"`; `a11y-publico.spec.ts` flakea con dos workers) → `scripts/dev-backend.sh`, `scripts/seed-demo.sh`, `scripts/pg-ephemeral.sh`, `scripts/measure-lcp.sh`.

# TAREA
1. Ajusta los disparadores para que el workflow corra en `push` a esta rama y en `pull_request` hacia `main`, y empújalo. Usa las herramientas MCP de GitHub (`actions_list`, `actions_get`, `get_job_logs`) para leer cada ejecución; no esperes a mano con `sleep`, consulta el estado cada pocos minutos.
2. Itera hasta que los tres jobs (`backend`, `frontend`, `e2e`) estén en verde en el runner de GitHub: caché de Gradle y pnpm, JDK 21 vía `actions/setup-java`, Postgres como servicio, Chromium instalado por Playwright en el runner (allí sí se ejecuta `playwright install --with-deps chromium`), backend levantado por script con `TEMPLATES2_ASSETS_BUCKET` y modo de assets local, siembra, `pnpm run build` desde `frontend/`, e2e con un solo worker para el spec que flakea (y anota la flakiness como issue, sin cuarentena silenciosa), artefactos de reportes (JaCoCo, Vitest, Playwright, LHCI) subidos con `actions/upload-artifact`.
3. Tiempo total del workflow objetivo < 25 minutos; si no llega, paraleliza jobs o cachea el build de Next, nunca recortes pruebas.
4. Añade una insignia de estado al `README.md` de la raíz (créalo si no existe: tres líneas de qué es el proyecto y cómo levantarlo, enlazando a las guías).
5. Cada corrección que necesitaste porque el runner difiere del entorno local se documenta en `memoria/handoffs/ci-github.md` (≤ 40 líneas) y, si toca contrato (`contratos §6`), como ADR.

# CIERRE
Bitácora con el enlace a la ejecución verde, tiempos por job, y lo que quedó flaky. `tablero.md` y `00-INDICE.md` con una línea "CI en GitHub verificado el <fecha>". Commit y push. No abras PR contra `main` (la fase 6 lo hará); sí puedes abrir un PR **borrador** de esta rama contra `main` únicamente si es la única forma de disparar el job de `pull_request`, y ciérralo al terminar sin mergear.

# REPORTE FINAL (≤ 20 líneas)
Enlace a la ejecución verde · tiempo por job · correcciones necesarias y por qué · flaky detectado · qué debe heredar la fase 6.
