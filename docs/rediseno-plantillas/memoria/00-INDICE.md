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
- **Fase actual:** 1 — Diseño, DETENIDA por el dueño el 2026-09-03 durante la ronda 1R. Los 7 documentos de diseño y 34 ADR existen, pero fueron producidos por un solo agente Sonnet sin revisión independiente de un modelo mayor. La ronda 1R (cuatro revisores por bloque: dominio, backend, frontend, calidad) no llegó a escribir nada por sobrecarga reiterada del servidor (errores 529). Para retomar: relanzar los cuatro briefs 1R (resumidos en `tablero.md`), dirimir contradicciones, aceptar ADR y consolidar `contratos.md` antes de abrir la fase 2. Nota: en este entorno los sub-agentes no pueden lanzar sub-agentes; el orquestador raíz lanza todo directamente.
- Fases: 0 Preparación (cerrada) · 1 Diseño (cerrada) · 2 Backend (siguiente) · 3 Frontend · 4 Plantillas y kit · 5 Migración · 6 Calidad y entrega.

## Fase 1 cerrada — qué leer para empezar la fase 2
1. `memoria/contratos.md` (esquema, API, persistencia, pruebas, nombre del paquete Kotlin, estructura de `frontend/`).
2. `diseno/01-dominio-y-esquema.md` + `diseno/esquema/*.ts` + `diseno/ejemplos/{boda-clasica-1.0.0,xv-jardin-1.0.0}/*.json` — el contrato de datos completo.
3. `diseno/02-persistencia-y-catalogo.md` — DDL exacto (migraciones `V29`-`V36`).
4. `diseno/03-api.md` — rutas, contratos, errores.
5. `diseno/08-verificacion-adversarial-esquema.md` y `09-verificacion-adversarial-seguridad.md` — objeciones y su resolución (0 altas abiertas); las correcciones ya están incorporadas en 01-03, estos dos documentos son el rastro de por qué existen.
6. `memoria/preguntas-abiertas.md` — supuestos tomados que un sub-agente de fase 2 no debe volver a decidir por su cuenta sin consultarlos primero.
7. `diseno/04-frontend-y-editor.md`, `05-migracion.md`, `06-pruebas-y-calidad.md`, `07-extension-ia.md` — para fase 3, 4/5, y referencia transversal de calidad, respectivamente (no bloquean el arranque de fase 2 backend).
