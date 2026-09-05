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

**EN CURSO desde 2026-09-04.** Rama `claude/fase-2-backend-orchestration-ksyuzi`, creada desde `claude/agent-network-invitation-41nx5y` (`88238b2`). Orquestador raíz Opus 5 en un entorno que **sí** expone la herramienta `Agent`; red de **un solo nivel** (los sub-agentes no pueden lanzar sub-agentes, así que el orquestador lanzó todos). Los bloques que implementan en paralelo corrieron en **worktrees git aislados**, integrados por el orquestador con `git merge --no-ff` y suite completa tras cada merge.

**Desviación de reparto respecto al prompt de la fase, con motivo:** el prompt pedía los bloques 2-1, 2-2 y 2-3 **en paralelo**. Se ejecutaron **2-1 ∥ 2-2** y luego **2-3**, porque 2-3 escribe en `templates2.persistence` y `templates2.api` —los mismos paquetes que 2-1— y en un worktree aislado no compilaría sin los repositorios de 2-1. Gana la regla dura "nunca dos agentes sobre el mismo paquete Kotlin a la vez". Registrado en `preguntas-abiertas.md`.

**Ampliación de alcance del bloque 0b, con motivo:** además de las dos verificaciones pendientes, 2-0b entregó `templates2.domain` y `templates2.schema` completos. Sin ese cimiento común, los tres bloques paralelos habrían inventado cada uno sus propios tipos de dominio en worktrees aislados y no se habrían podido integrar.

| Tarea | Agente | Modelo real | Reintentos | Estado |
|---|---|---|---|---|
| Cimientos: build 21, monorepo `frontend/packages/schema`, emisión del bundle, golden files, `pg-ephemeral.sh`, `ci.yml` | 2-0a | **Sonnet** | 0 | **aceptada** con reservas — 375 pruebas TS, cobertura 100/100/88,04 |
| Revisión adversarial de 2-0a (obligatoria: Sonnet tocando esquema) | 2-0a-REV | **Opus** | 0 | **aceptada** — 20 objeciones, 2 ALTAS, 5 defectos corregidos en sitio |
| Verificación Kotlin pendiente de la fase 1 + cimiento compartido (`domain`, `schema`) | 2-0b | **Opus** | 0 | **aceptada** — networknt OK, paridad 102/102, 482 pruebas |
| Persistencia: Flyway `V29`–`V37`, 8 entidades, 9 repositorios | 2-1 | **Sonnet** | 0 | **aceptada** con reservas — 536 pruebas |
| Revisión adversarial de 2-1 (obligatoria: Sonnet tocando persistencia) | 2-1-REV | **Opus** | 0 | **aceptada** — 15 objeciones, sabotaje de `ddl-auto`, +21 pruebas (557) |
| Composición R1–R9, reductor único, migración y `switchTemplate` | 2-2 | **Opus** | 0 | **aceptada** — 716 pruebas Kotlin, 453 TS; cierra O-01/O-06/O-10/O-12 |
| Catálogo y registro de plantillas en un paso | 2-3 | **Opus** | 0 | **aceptada** — 862 pruebas; registra las 2 plantillas de ejemplo |
| Documento, operaciones, snapshots y publicación | 2-4 | **Opus** | 0 | **aceptada** — 943 pruebas; `public_token` con imprevisibilidad medida |
| API completa e integración | 2-5 | **Opus** | 0 | **aceptada** — 1 100 pruebas; 19/19 rutas, 35 códigos `TPL_*` alcanzables |
| Revisión adversarial global de cierre | 2-ADV | **Opus** | 0 | **aceptada** — 17 objeciones; encontró un defecto VIVO que ninguna prueba veía |
| Consolidación de cierre (6 objeciones abiertas) | 2-6 | **Opus** | 0 | **aceptada** — 1 184 pruebas; webhook de revalidación incluido |
| Cierre: 50 ADR aceptadas, `contratos.md`, memoria, seguridad del bucket | orquestador | **Opus** | — | **cerrada** — 1 186 pruebas, 0 fallos |

**Ningún agente murió por sobrecarga (error 529)**, así que la escalera de reintento (esperar 60 s y reanudar el mismo agente con `SendMessage`; a la tercera muerte relanzar con el siguiente modelo) **no llegó a usarse**. Sí se usó `SendMessage` una vez, para inyectar en vuelo al bloque 2-0b las dos objeciones ALTAS que la revisión de 2-0a acababa de encontrar.
## Fase 3 — Frontend
(pendiente)
## Fase 4 — Plantillas y kit
(pendiente)
## Fase 5 — Migración
(pendiente)
## Fase 6 — Calidad y entrega
(pendiente)


**Resultado de la fase 2:** 1 186 pruebas Kotlin y 458 TypeScript, 0 fallos, 0 omitidas. Cobertura BUNDLE 94,62 % líneas / 81,22 % ramas. 50 ADR aceptadas, ninguna rechazada. **Ningún sub-agente hubo que repetirlo**: los seis entregaron a la primera y las tres revisiones se cerraron sin reintento.

## Fase 3-B — cierre de la fase 3 (2026-09-05)

Modelo real de trabajo: **un solo nivel de agentes**, el orquestador lanzó todos. Máximo 3
implementadores en paralelo, cada uno en su worktree y con su puerto y su clúster de Postgres
propios. Integración con `git merge --no-ff` y suite tras cada merge; commit y push tras cada issue
cerrada, para que una sesión agotada no se lleve nada por delante.

| Issue | Agente | Modelo | Estado | Verificación del orquestador |
|---|---|---|---|---|
| I-01 marks → 500 | A1 | Opus | aceptada | saboteó el arreglo: 9 fallos; restaurado, verde. Y 500→200 por HTTP |
| I-03 compuerta CSP | A2 | Opus | aceptada | comentó el import causal: 2 failed; restaurado, 3 passed |
| I-04 smoke 19/19 | A3 | Sonnet | aceptada | tercera corrida independiente: 19/19, exit 0 |
| I-02 seguridad auth | B1 | Opus | aceptada | oráculo propio con el mismo método: 15,0× → 1,01×; 429 a mano |
| I-06 cambiar la fecha | B2 | Opus | aceptada | suite Kotlin completa tras el merge |
| I-09 alias de assets | B3 | Opus | aceptada | en vivo: 13 → 14 imágenes; `rsvp.background` resuelve |
| I-07 webhook | C1 | Sonnet | aceptada | suite Kotlin completa; el diagnóstico de la issue era falso |
| I-05 WCAG | C2 | Opus | aceptada | devolvió el velo a 55 %: 5 fallos, uno por paleta |
| I-11 protocolo LCP | C3 | Sonnet | aceptada | puerto ajeno → se niega a medir, código de salida 3 |
| I-05b portada | — | Opus | aceptada | quitó el papel: 39 fallos. Capturas juzgadas a ojo por el orquestador |
| I-08 coste de plantilla | orquestador | — | medida | no era un defecto: se cronometró |
| I-12 trabajo rescatado | orquestador | — | aceptada | 14 ficheros integrados, 1 rechazado con motivo |
| I-10 cierre formal | orquestador | — | entregada | 69 ADR resueltas |
| Revisión adversarial | 3B-ADV | Opus | **NO CERRABLE** | 5 altas originales cerradas, **2 nuevas** |

**Lo que se repitió y por qué:** ningún sub-agente hubo que repetirlo. Sí hubo que **reanudar** a
C3 (I-11), que se detuvo esperando una notificación que un sub-agente nunca recibe.

**Dos rojos de la re-verificación fueron del orquestador, no del código**: `gradlew clean` borró el
almacén de assets (10 fallos) y una corrida sin `TPL_DEV_DB` apuntó los ayudantes a otra base
(6 fallos). Con el entorno sano: **50/50**.
