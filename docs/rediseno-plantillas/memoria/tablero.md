# Tablero

Estados: pendiente · en curso · entregada · aceptada · rechazada (motivo)

## Fase 0 — Preparación
| Tarea | Agente | Modelo | Estado |
|---|---|---|---|
| Rama y memoria | orquestador | — | aceptada |
| Inventario del repo y resúmenes por rol | 0-inventario | Sonnet | aceptada |

## Fase 1 — Diseño

**Nota de modelo (transversal a toda la fase):** el entorno de esta sesión no expone una herramienta de sub-agentes locales (Task/Agent) — solo `mcp__Claude_Code_Remote__create_session` (sesiones remotas completas, pensadas para paralelismo entre contenedores, no para reparto fino dentro del mismo árbol de trabajo con briefs independientes). Ante esa falta de herramienta, el orquestador (Sonnet 5) ejecutó los 9 roles directamente, en secuencia, en vez de delegarlos a sub-agentes Opus/Fable/Sonnet con la escalera de reintento por sobrecarga que pedía el brief. Se documenta explícitamente en cada bitácora, en `preguntas-abiertas.md` y en el reporte final del chat — ninguna columna "Modelo" de esta tabla reflejaría un reparto real distinto de "Sonnet, orquestador, sin sub-agente" para la fase 1 completa. La ronda de verificación adversarial (que normalmente exigiría un sub-agente independiente) se ejecutó igual como un paso separado y explícito dentro de la misma sesión, con el mismo rigor de cita de evidencia que pedía el brief, para no perder la función de control cruzado aunque no hubiera aislamiento real entre "autor" y "revisor".

| Tarea | Agente | Modelo | Estado |
|---|---|---|---|
| Dominio y esquema de plantilla (revisión y firma de un borrador previo interrumpido) | 1-dominio | Sonnet (orquestador; sin sub-agente disponible) | aceptada (revisada en la ronda 1R) |
| Persistencia y catálogo | 1-persistencia | Sonnet (orquestador) | aceptada (revisada en la ronda 1R) |
| API editor y render público | 1-api | Sonnet (orquestador) | aceptada (revisada en la ronda 1R) |
| Arquitectura frontend y editor | 1-frontend | Sonnet (orquestador) | aceptada (revisada en la ronda 1R) |
| Migración | 1-migracion | Sonnet (orquestador) | aceptada (revisada en la ronda 1R) |
| Pruebas y calidad | 1-pruebas | Sonnet (orquestador) | aceptada (revisada en la ronda 1R) |
| Punto de extensión IA | 1-ia | Sonnet (orquestador) | aceptada (revisada en la ronda 1R) |
| Verificación adversarial esquema/composición (2 altas, 3 medias, 2 bajas encontradas) | 1-adv-esquema | Sonnet (orquestador) | aceptada (revisada en la ronda 1R) |
| Verificación adversarial persistencia/API/seguridad (1 alta, 3 medias, 2 bajas encontradas) | 1-adv-seguridad | Sonnet (orquestador) | aceptada (revisada en la ronda 1R) |
| Corrección de las 3 objeciones altas + 6 medias (ronda 3) | orquestador | Sonnet | aceptada (revisada en la ronda 1R) |
| Verificación mecánica de rutas y H-xx citados en `diseno/*.md` | orquestador (rol Haiku sustituido por el mismo motivo de arriba) | Sonnet | entregada — 0 rutas rotas, 0 H-xx inventados |


**Ronda 1R — revisión independiente y profundización. CERRADA el 2026-09-03.** Ejecutada por un orquestador raíz Opus 5 en un entorno que **sí** expone la herramienta `Agent`, a diferencia de la sesión anterior. Red de un solo nivel: los sub-agentes no pueden lanzar sub-agentes, así que el orquestador raíz lanzó los seis agentes directamente. Los cuatro revisores corrieron en paralelo sobre bloques disjuntos; ninguno murió por sobrecarga, así que la escalera de reintento por error 529 (60 s → 5 min → relanzar con `sonnet`) no llegó a usarse.

| Tarea | Agente | Modelo real | Reintentos | Estado |
|---|---|---|---|---|
| Dominio y esquema: verificación ejecutable Zod/JSON Schema, cobertura de las 8 plantillas, firmas, merge | 1R-dominio | Opus | 0 | **aceptada** — `01` 347→1131 líneas, 11 altas cerradas, esquema verde |
| Persistencia + API + seguridad: DDL final, contrato por ruta, fallo parcial, Flyway real | 1R-backend | Opus | 0 | **aceptada** — `02` 219→747, `03` 135→655, 8 altas cerradas |
| Frontend + editor: monorepo, postMessage, store, undo, autoguardado, wireframes, a11y, rendimiento | 1R-frontend | Opus | 0 | **aceptada** — `04` 103→1624, 9 altas cerradas |
| Migración + pruebas/CI + IA: mapeo campo a campo, herramienta, `ci.yml`, umbrales, `AiEditProposal` | 1R-calidad | Opus | 0 | **aceptada** — `05` 93→611, `06` 140→756, `07` 61→358, 16 altas cerradas |
| Dirimidor de las 16 contradicciones entre bloques | dirimidor-1R | Opus | 0 | **aceptada** — 16 dirimidas y aplicadas en sitio; ninguna ADR rechazada |
| Verificación mecánica de rutas, `H-xx` y validación de los ejemplos | verif-1R | Haiku | 0 | **aceptada** — 0 rutas rotas, 39/39 `H-xx` reales, 10/10 ejemplos válidos |
| Cierre: aceptación de las 88 ADR, `contratos.md`, glosario, tablero, índice | orquestador raíz | Opus | — | **cerrada** |

**Objeciones altas: 44 encontradas, 44 corregidas en sitio, 0 abiertas.** Las cuatro tablas de objeciones viven en la sección "Revisión independiente (1R-xxx)" de cada documento.

## Fase 2 — Backend
(pendiente — **siguiente fase**; arranca leyendo `contratos.md`, `01`+`esquema/`, `02` y `03`)
## Fase 3 — Frontend
(pendiente)
## Fase 4 — Plantillas y kit
(pendiente)
## Fase 5 — Migración
(pendiente)
## Fase 6 — Calidad y entrega
(pendiente)
