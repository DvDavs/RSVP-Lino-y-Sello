# Prompt de la tarea «CI · cerrar I-CI-01 (aislamiento e2e y paralelismo)»

Copia literal del encargo recibido por el orquestador raíz de esta tarea, guardada aquí por
exigencia del propio prompt (regla de la sección RAMA). No se edita.

---

Eres el ORQUESTADOR RAÍZ de una tarea acotada de CI en `DvDavs/RSVP-Lino-y-Sello`: cerrar la issue **I-CI-01** (la suite e2e solo pasa con `--workers=1` porque dos specs comparten la invitación sembrada sin el mutex) y devolver el paralelismo al job `e2e`, demostrándolo verde en GitHub Actions. Sesión autónoma: no preguntes.

# RAMA
`git fetch origin claude/ci-github-actions-jobs-9qyd9z && git checkout claude/ci-github-actions-jobs-9qyd9z` (head `c4326e5`, corrida verde 34054050395; ver `memoria/handoffs/ci-github.md`). Trabajas y empujas en esa misma rama: el `push` a ella dispara el workflow. Copia este prompt a `docs/rediseno-plantillas/prompts/tarea-ci-i-ci-01.md` en tu primer commit. No toques `claude/ci-github-actions` (rama obsoleta, solo tiene el prompt viejo).

# LEE
`CLAUDE.md` → `memoria/brief-comun.md` → `memoria/issues-ci.md` (I-CI-01 e I-CI-02) → `memoria/handoffs/ci-github.md` → `memoria/decisiones.md` solo ADR-CI-01 → `.github/workflows/ci.yml` completo → `frontend/apps/web/e2e/preparar.ts` (`invitacionSembrada()` en la línea ~68 y `conLockDeInvitacionSembrada` en la ~110), `frontend/apps/web/e2e/editor-3c-evidencia.spec.ts`, `frontend/apps/web/e2e/a11y-publico.spec.ts`, `frontend/apps/web/playwright.config.ts` → `docs/rediseno-plantillas/diseno/06-pruebas-y-calidad.md §8.2` (regla: «si una prueba solo pasa con `workers: 1`, es un fallo de aislamiento, no una excepción»). No leas más.

# TERRITORIO
`.github/workflows/**`, `scripts/**` que el CI invoque, `frontend/apps/web/e2e/**` (SOLO los dos specs citados y, si hace falta, `preparar.ts`), `README.md` de la raíz, y `docs/rediseno-plantillas/memoria/**`. Prohibido tocar código de producto, `playwright.config.ts` salvo el valor de `workers`, `build.gradle.kts` y cualquier otra prueba. Tocar `frontend/**` está permitido aquí únicamente porque el defecto quedó demostrado en el runner (corridas 34052024407 y 34052672869) y va con ADR y revisor Opus. Otras sesiones trabajan en `claude/fase-4-kit-de-autor` y `claude/fase-5-producto`: no las toques.

# TAREA
1. **Aislar de verdad** (Opus escribe, otro Opus revisa): la solución correcta es que cada prueba de esos dos specs cree su propia invitación en vez de usar la sembrada (mira cómo lo hacen los specs que ya no comparten). Si eso exige tocar más de lo permitido, la mínima aceptable es envolver `abrirEditor()` de `editor-3c-evidencia.spec.ts` y el tramo equivalente de `a11y-publico.spec.ts` en `conLockDeInvitacionSembrada`. Ninguna prueba se salta, se marca `fixme` ni se recorta; la suite sigue siendo 79 (o más si divides).
2. **Medir en el runner, no en local**: quita `--workers=1` de la invocación del job `e2e`, prueba primero con 2 workers y después con los 4 de `playwright.config.ts`. Aceptación: **dos corridas consecutivas verdes** con `--fail-on-flaky-tests` en el número de workers que dejes fijado. Si con 4 no lo consigues por reloj (no por aislamiento), deja 2 y documenta la medida. Usa las herramientas MCP de GitHub (`actions_list`, `actions_get`, `get_job_logs`); nunca `sleep` largos.
3. **Disparadores**: añade `claude/fase-5-producto` y `claude/fase-4-kit-de-autor` a `on.push.branches` (son las ramas de integración; hoy la fase 5 no tendría CI). No añadas `wip/*` ni `claude/fase-5-*` de sesión: el coste es ~28 minutos de Actions por push. Deja escrito el coste en `issues-ci.md`.
4. **Memoria**: cierra I-CI-01 en `issues-ci.md` (con enlaces a las dos corridas verdes), enmienda ADR-CI-01 (estado y motivo), bitácora `bitacora/ci-i-ci-01.md` (≤ 40 líneas), `handoffs/ci-github.md` actualizado (workers finales, tiempo del job), una línea en `tablero.md` y `00-INDICE.md`. No toques I-CI-02: es decisión del dueño (fase 7).
5. Commit y push. No abras PR contra `main`.

# REPORTE FINAL EN EL CHAT (≤ 20 líneas)
Hash final · qué cambió en los dos specs (propia invitación o mutex) y por qué · workers finales · enlaces a las dos corridas verdes con tiempo del job `e2e` · ramas añadidas a los disparadores y coste estimado · qué queda abierto (I-CI-02) · qué debe saber la sesión E6 de la fase 5 al mergear esta rama.
