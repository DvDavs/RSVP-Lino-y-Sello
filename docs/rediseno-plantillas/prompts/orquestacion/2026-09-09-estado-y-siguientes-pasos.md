# Orquestación — estado al 2026-09-09 y siguientes pasos

Escrito por el orquestador raíz (sesión `claude/stoic-tesla-9bsr8i`, rama de documentación
únicamente). Fuente: `git log` de las 17 ramas remotas, memoria de `claude/fase-4-kit-de-autor`,
`claude/fase-5-producto`, `claude/ci-github-actions-jobs-9qyd9z` y `claude/decisiones-dueno`,
y las 26 corridas de GitHub Actions.

## 1. Dónde está cada cosa

| Rama | Head | Qué contiene | Estado |
|---|---|---|---|
| `main` | `4358fc8` | Solo la auditoría (PR #1). Nada del rediseño. | Intocable hasta la fase 7 |
| `claude/fase-3c-identidad-visual-wqg0d2` | `26f0d49` | Fases 0–3 y 3-C cerradas. Base común de todo lo demás. | Cerrada |
| `claude/decisiones-dueno` | `75b42e6` | D-01…D-08 (`55ad6f5`), hoja de ruta nueva, 9 imágenes integradas (hero + 8 tipos de evento) sin pruebas ejecutadas. | Territorio de ChatGPT; se mergea en E6 |
| `claude/fase-4-kit-de-autor` | `d4cb633` | Kit de autor completo (4-0a/b/c, 4-1A/B/C, 4-2, 4-3, 4-4a/b/c, 4-5, 4-6, 4-7, 4-8, 4-9, 4-9b). 12 paquetes en `frontend/templates/`, 13 versiones registradas. Contiene `55ad6f5`. | **Falta el cierre** |
| `claude/ci-github-actions-jobs-9qyd9z` | `c4326e5` | CI real en GitHub Actions, **verde** (corrida 34054050395, 10 min 15 s, 4 jobs en paralelo). Issues I-CI-01 (aislamiento e2e, `--workers=1`) e I-CI-02 (Chromium 1194). | Cerrada con 1 issue de `frontend/**` pendiente |
| `claude/ci-github-actions` | `253ebb7` | Solo el prompt de la tarea de CI. El trabajo real está en `-jobs-9qyd9z`. | Obsoleta (no mergear) |
| `claude/fase-5-producto` | `6535114` | Prompt maestro de la fase 5 + E1…E6. **Ningún commit de cimientos.** Nace de `9daa517` (2 imágenes). | **Lista para lanzar E1** |
| `claude/fase-3-wip-*`, `fase-2-*`, `fase-3-frontend-*`, `fase-3b-*`, `agent-network-*`, `rsvp-templates-*` | — | Historia ya contenida en `26f0d49` o en `main`. | Solo lectura |

## 2. Qué falta, en orden

1. **Cierre de la fase 4** (una sesión, Opus). Tablero desactualizado (4-3, 4-5, 4-7, 4-8, 4-9,
   4-1C no tienen fila), 14 ADR-4 en estado *propuesta*, ronda 2 de la prueba ciega pendiente
   (4-1C fue «ronda 1 de 2»), `preview.webp` de `boda-clasica` con nombre real horneado (4-9b),
   revisión adversarial del kit y del registro, `contratos.md §14`, handoffs para las fases 5 y 6,
   y la decisión D-01 sobre las 9 convertidas y `packages/migration-legacy` (presentar al dueño).
2. **I-CI-01** (una sesión corta, Opus): aislar `editor-3c-evidencia.spec.ts` y `a11y-publico.spec.ts`,
   volver a subir los workers y demostrarlo verde en el runner. Añadir `claude/fase-5-producto` y
   `claude/fase-4-kit-de-autor` a los disparadores de `push` (hoy la fase 5 no tendría CI).
3. **Fase 5 · E1 cimientos** (una sesión, Opus): prompt del repositorio + adenda de esta fecha
   (rama real del CI, estado de las imágenes, territorio de la fase 4, regla «cada e2e crea su
   propia invitación»).
4. Cuando exista el commit de cimientos: **E2, E3, E4, E5 en paralelo** (prompts en
   `prompts/fase-5/`, con adenda del orquestador al repartirlos).
5. **E6 integración y cierre**: mergea `fase-5-{cuenta,invitados,pagos,admin}`, luego
   `claude/fase-4-kit-de-autor`, `claude/ci-github-actions-jobs-9qyd9z` (NO `claude/ci-github-actions`)
   y `claude/decisiones-dueno`; también esta rama de documentación.
6. Fase 6 (arte de plantillas con el kit) y fase 7 (retiro del módulo antiguo, despliegue, PR a `main`).

1, 2 y 3 no comparten territorio: se lanzan hoy en paralelo en tres chats.

## 3. Decisiones que necesita el dueño (con el supuesto por defecto)

| # | Pregunta | Supuesto si no hay respuesta |
|---|---|---|
| Q-1 | Las 9 plantillas convertidas del sistema viejo (4-2/4-4) ya están limpias, registradas y en verde, pero D-01 les quitó el motivo. ¿Se quedan como catálogo inicial que la fase 6 vestirá, o se borran? ¿Y `packages/migration-legacy`? | Se quedan como catálogo inicial; `migration-legacy` se marca «retirar en la fase 7» y no se borra ahora |
| Q-2 | Disparar el CI también en `push` a `claude/fase-5-producto` y `claude/fase-4-kit-de-autor` cuesta ~28 minutos de Actions por push (4 jobs). ¿Se acepta? | Sí, solo en esas dos ramas de integración, no en las `wip/*` |
| Q-3 | I-CI-02: ¿regenerar las 124 capturas con el Chromium que instala `@playwright/test@1.62.1`, o dejar escrito que la revisión 1194 es parte del contrato de la galería? | Se difiere a la fase 7 (como propuso el CI); mientras, el CI pinea 1194 |
| Q-4 | ¿Confirmas que nada se mergea a `main` hasta la fase 7? | Sí |

## 4. Prompts entregados hoy

Los tres prompts (A cierre fase 4, B I-CI-01, C fase 5 E1) van en el chat del orquestador y se
reproducen en `prompts/orquestacion/2026-09-09-prompts.md`. Cada agente los copia además a la
carpeta `prompts/` de su rama, como hizo la tarea de CI.
