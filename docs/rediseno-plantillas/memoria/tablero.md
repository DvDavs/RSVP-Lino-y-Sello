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
| Dominio y esquema de plantilla (revisión y firma de un borrador previo interrumpido) | 1-dominio | Sonnet (orquestador; sin sub-agente disponible) | entregada — pendiente de revisión independiente (ronda 1R) |
| Persistencia y catálogo | 1-persistencia | Sonnet (orquestador) | entregada — pendiente de revisión independiente (ronda 1R) |
| API editor y render público | 1-api | Sonnet (orquestador) | entregada — pendiente de revisión independiente (ronda 1R) |
| Arquitectura frontend y editor | 1-frontend | Sonnet (orquestador) | entregada — pendiente de revisión independiente (ronda 1R) |
| Migración | 1-migracion | Sonnet (orquestador) | entregada — pendiente de revisión independiente (ronda 1R) |
| Pruebas y calidad | 1-pruebas | Sonnet (orquestador) | entregada — pendiente de revisión independiente (ronda 1R) |
| Punto de extensión IA | 1-ia | Sonnet (orquestador) | entregada — pendiente de revisión independiente (ronda 1R) |
| Verificación adversarial esquema/composición (2 altas, 3 medias, 2 bajas encontradas) | 1-adv-esquema | Sonnet (orquestador) | entregada — pendiente de revisión independiente (ronda 1R) |
| Verificación adversarial persistencia/API/seguridad (1 alta, 3 medias, 2 bajas encontradas) | 1-adv-seguridad | Sonnet (orquestador) | entregada — pendiente de revisión independiente (ronda 1R) |
| Corrección de las 3 objeciones altas + 6 medias (ronda 3) | orquestador | Sonnet | entregada — pendiente de revisión independiente (ronda 1R) |
| Verificación mecánica de rutas y H-xx citados en `diseno/*.md` | orquestador (rol Haiku sustituido por el mismo motivo de arriba) | Sonnet | entregada — 0 rutas rotas, 0 H-xx inventados |


**Ronda 1R — revisión independiente y profundización (lanzada por el orquestador raíz; los sub-agentes NO pueden lanzar sub-agentes en este entorno, así que la red es de un solo nivel).**
| Tarea | Agente | Modelo | Estado |
|---|---|---|---|
| Dominio y esquema: verificación ejecutable Zod/JSON Schema, cobertura de las 8 plantillas, firmas, algoritmo de merge | 1R-dominio | Opus→Fable | no ejecutada (errores 529 reiterados; sesión detenida por el dueño) |
| Persistencia + API + seguridad: DDL final, contratos completos por ruta, fallo parcial, Flyway real | 1R-backend | Opus→Fable | no ejecutada (errores 529 reiterados; sesión detenida por el dueño) |
| Frontend + editor: monorepo exacto, protocolo postMessage, store, undo, autoguardado, wireframes, a11y, rendimiento | 1R-frontend | Opus→Fable | no ejecutada (errores 529 reiterados; sesión detenida por el dueño) |
| Migración + pruebas/CI + IA: mapeo campo a campo, herramienta, ci.yml, umbrales medibles, AiEditProposal | 1R-calidad | Opus→Fable | no ejecutada (errores 529 reiterados; sesión detenida por el dueño) |
| Dirimidor de contradicciones y consolidación de contratos | orquestador raíz + dirimidor si hace falta | Opus | pendiente (sesión detenida) |

## Fase 2 — Backend
(pendiente — siguiente fase)
## Fase 3 — Frontend
(pendiente)
## Fase 4 — Plantillas y kit
(pendiente)
## Fase 5 — Migración
(pendiente)
## Fase 6 — Calidad y entrega
(pendiente)
