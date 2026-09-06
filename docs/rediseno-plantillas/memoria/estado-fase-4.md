# Estado de la fase 4 (kit de autor y plantillas) — vivo, se actualiza en cada bloque

Rama: `claude/fase-4-kit-de-autor` (base `563d42e`, prompt en `4bba568`).
Rama viva de la fase 3-C a fusionar antes del cierre: `claude/fase-3c-identidad-visual-wqg0d2`
(al arrancar la fase 4 iba por `63b3d66`, con su revisión adversarial y `contratos §13` ya cerradas).

## Reparto
| ID | Encargo | Modelo | Worktree | Estado |
|---|---|---|---|---|
| 4-0a | entorno, registro idempotente, `boda-clasica@1.0.1` | Opus | `/home/user/wt/0a` | lanzado |
| 4-0b | `sectionCatalog` + introspección del esquema | Opus | `/home/user/wt/0b` | lanzado |
| 4-0c | deuda AA de `diseno/ejemplos/` y `packages/schema/golden/` | Opus | `/home/user/wt/0c` | lanzado |
| 4-2 | herramienta de conversión F1 → paquete | Opus | `/home/user/wt/42` | lanzado |
| 4-1 | kit de autor (CLI, validador, previsualizador, capturas) | Opus | — | pendiente de 4-0b |
| 4-3 | guía y lista de verificación | Sonnet + revisor | — | pendiente de 4-1 |
| 4-4 | conversión de las 9 legadas (3 cohortes) | Sonnet ×3 + rev. Opus | — | pendiente |
| 4-5 | plantilla nueva sólo con el kit, cronometrada | Sonnet ajeno al kit | — | pendiente |

## Reglas de integración
`git merge --no-ff` desde la rama `wip/f4-<id>` del worktree; tras cada merge, `pnpm -r test`,
`typecheck`, `build` y `./gradlew check`; commit y push por bloque; nunca se abre PR.

## Si esta sesión se corta
Lo integrado está en `claude/fase-4-kit-de-autor`; lo demás vive en las ramas `wip/f4-*` y en los
handoffs `memoria/handoffs/4-*.md` (los `-parcial.md` son relevos: un agente nuevo continúa desde ahí).
