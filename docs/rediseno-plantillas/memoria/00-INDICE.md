# Memoria compartida del rediseño del módulo de plantillas e invitaciones

Prompt maestro: `docs/analisis-plantillas/PROMPT-REDISENO-MODULO-PLANTILLAS.md` (secciones 1, 3, 7 y 10 son de lectura obligatoria para todo sub-agente).
Auditoría de partida: `docs/analisis-plantillas/` (informe final + `fases/`).
Rama de trabajo: `claude/agent-network-invitation-41nx5y` (sustituye a `claude/rediseno-plantillas` por instrucción del entorno).

## Cómo leer esta memoria en 5 minutos
1. Este índice: estado de la fase actual.
2. `decisiones.md`: solo las ADR con estado **aceptada**.
3. `contratos.md`: esquemas, API, stack y nombres vigentes.
4. `glosario.md`: vocabulario acordado.
5. `handoffs/` que indique tu brief.

## Archivos
| Archivo | Qué es |
|---|---|
| `decisiones.md` | Registro ADR append-only (propuesta / aceptada / rechazada) |
| `contratos.md` | Contratos vigentes (esquemas, interfaces, rutas, paquetes) |
| `glosario.md` | Vocabulario |
| `tablero.md` | Tareas por fase y estado |
| `preguntas-abiertas.md` | Preguntas para el dueño con el supuesto tomado |
| `bitacora/<fase>-<agente>.md` | Una entrada por sub-agente y tarea |
| `handoffs/<fase>-<agente>.md` | Resumen estructurado (≤ 60 líneas) para el siguiente agente |
| `../diseno/` | Entregables de diseño de la fase 1 |
| `../guias/` | Guías de uso (fase 6) |

## Estado actual
- **Fase actual:** 1 — Diseño (fase 0 cerrada: inventario en `handoffs/0-inventario.md` y resúmenes por rol `handoffs/0-resumen-auditoria-<rol>.md`).
- Fases: 0 Preparación · 1 Diseño · 2 Backend · 3 Frontend · 4 Plantillas y kit · 5 Migración · 6 Calidad y entrega.
