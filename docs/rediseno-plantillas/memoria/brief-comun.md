# Brief común para todo sub-agente del rediseño

Este archivo lo lee **cada** sub-agente (orquestador de fase o ejecutor) antes de empezar. Complementa el brief específico que recibes en tu prompt.

## Contexto del sistema (resumen de la sección 1 del prompt maestro)
Producto SaaS de invitaciones digitales con RSVP (bodas, XV, bautizos, comuniones, cumpleaños, graduaciones, eventos). El cliente compra un plan, elige plantilla, personaliza en un editor y sus invitados abren un enlace público. Backend Kotlin 1.9 + Spring Boot 3.4 (Gradle KTS), paquete raíz `mx.evolutiondev.invitaciones`, Postgres (Flyway) + Mongo. La config de cada invitación hoy es un JSON gigante generado por un servicio de 2.744 líneas con merges posicionales, hardcodeos y cero pruebas. **No hay frontend en el repo: se construye desde cero.**
Objetivo: módulo nuevo de plantillas + editor que sustituye al actual: plantillas como paquetes versionados (agregar una plantilla no toca Kotlin), 4 capas (plantilla → theme → structure → content; negocio en Postgres), composición pura y regenerable con merge por id estable, un solo almacén transaccional (Postgres JSONB), editor simple (sin CSS ni posicionamiento libre, con undo y autoguardado), contrato de IA estructurado (solo diseño), calidad de frontera (tipado e2e, pruebas unitarias/contrato/e2e, a11y, rendimiento, seguridad).
Fuera de alcance: RSVP, invitados, notificaciones, auth, pagos, admin. Solo integración de lectura y publicación.

## Documentos de referencia obligatorios
- Prompt maestro: `docs/analisis-plantillas/PROMPT-REDISENO-MODULO-PLANTILLAS.md` (secciones 1, 3 (P1–P10), 7 (stack), 8 (control de calidad), 9 (terminado), 10 (plantilla de brief)).
- Memoria: `docs/rediseno-plantillas/memoria/` → `00-INDICE.md`, `decisiones.md` (solo ADR *aceptadas*), `contratos.md`, `glosario.md`, y los `handoffs/` que indique tu brief.
- Auditoría: `docs/analisis-plantillas/` (informe final y `fases/`); los resúmenes por rol están en `memoria/handoffs/0-resumen-auditoria-<rol>.md`.

## Principios P1–P10 (una línea cada uno)
P1 Esquema único tipado y validado compartido backend/frontend; nada se descarta en silencio. · P2 Merge por id estable, nunca por índice ni por texto. · P3 Cero presentación en el backend (tokens, iconos, tamaños viven en plantilla/tema). · P4 Plantillas como paquetes semver con manifiesto, esquema, defaults, assets y migraciones; registro en un paso, idempotente, sin reinicio. · P5 Composición determinista y pura con golden files; regenerar nunca destruye ediciones. · P6 Consistencia transaccional (Postgres JSONB). · P7 Editor simple: contenido y opciones curadas, undo, autoguardado. · P8 Seguridad en el contrato: ids del servidor, validación de payload, propiedad comprobada. · P9 Pruebas desde el primer commit. · P10 Convivencia detrás de bandera y migración automática validada.

## Reglas para todos
- Rama de trabajo: `claude/agent-network-invitation-41nx5y`. Nunca pushees. Solo el orquestador de tu fase hace commits; los ejecutores no.
- No toques nada fuera de: el paquete del módulo nuevo, la carpeta del frontend nuevo (`frontend/`), la memoria/diseño/guías en `docs/rediseno-plantillas/`, las pruebas del módulo nuevo y la configuración de build estrictamente necesaria (declárala en tu bitácora). Cualquier cambio en RSVP, invitados, auth, pagos o el módulo antiguo es rechazo automático.
- Cita evidencia (archivo:línea, ADR-xxx, H-xx) en cada afirmación de diseño. El código trae pruebas que pasan; reporta la salida real de las pruebas, aunque fallen.
- Si necesitas una decisión que no está en la memoria: toma la opción más conservadora, regístrala en `preguntas-abiertas.md` con tu supuesto y sigue. Nada bloquea por una pregunta.
- Distingue lo verificado, lo inferido y lo que no pudiste determinar.
- Economía de tokens: lee solo lo que tu brief indica; no vuelvas a leer el módulo antiguo entero si el resumen por rol te basta; responde en el chat con ≤ 15 líneas.

## Al terminar (obligatorio; sin memoria no hay aceptación)
1. `memoria/bitacora/<fase>-<ID>.md`: qué hiciste, evidencia, qué no pudiste, riesgos.
2. `memoria/handoffs/<fase>-<ID>.md` (≤ 60 líneas, estructurado) si otro agente continúa tu trabajo.
3. ADR con estado "propuesta" en `memoria/decisiones.md` si tomaste decisiones de diseño (formato del encabezado de ese archivo).
4. Preguntas para el dueño en `memoria/preguntas-abiertas.md`.
5. Resumen en el chat ≤ 15 líneas: entregables (rutas), decisiones propuestas, preguntas abiertas, pruebas ejecutadas y su resultado.

## Para orquestadores de fase (además de lo anterior)
- Tú no diseñas ni programas: repartes en sub-agentes con briefs autosuficientes (plantilla de la sección 10 del prompt maestro, apuntando a este archivo para el contexto común), eliges modelo por complejidad (sección 5: Opus para diseño/núcleo/revisión/seguridad/migración; Sonnet para lo mecánico a partir de contrato aceptado; Haiku para verificación trivial), lanzas en paralelo lo independiente, controlas calidad (sección 8) y haces repetir lo que no cumple (máximo dos reintentos, luego cambia el reparto).
- Todo entregable de Sonnet en núcleo/esquema/migración/seguridad pasa por revisor Opus. Contradicciones entre sub-agentes: sub-agente dirimidor Opus, nunca decides tú.
- Solo tú aceptas ADR (cambias estado a aceptada/rechazada con motivo) y actualizas `contratos.md`, `tablero.md` y `00-INDICE.md` (estado de la fase).
- Commits pequeños y descriptivos en la rama de trabajo al cerrar cada bloque de la fase; terminan con las dos líneas de atribución que te indique tu brief. No pushees, no abras PR.
- Reporte final en el chat (≤ 40 líneas): sub-agentes lanzados con modelo y cuáles repetiste y por qué; ADR aceptadas/rechazadas en una línea cada una; preguntas abiertas agrupadas; definición de terminado de la fase punto por punto (cumplido / no cumplido y por qué); hash del commit final.
