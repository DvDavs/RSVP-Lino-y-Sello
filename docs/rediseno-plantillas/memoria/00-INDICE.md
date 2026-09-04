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
- **Fase 1 — Diseño: CERRADA el 2026-09-03.** Los 7 documentos de diseño existían desde una sesión anterior, pero los había escrito un solo agente Sonnet en secuencia, sin revisión independiente. La **ronda 1R** los revisó adversarialmente y los profundizó hasta grado de implementación: cuatro revisores Opus en paralelo sobre bloques disjuntos, un dirimidor Opus para las 16 contradicciones entre bloques, y una verificación mecánica. 44 objeciones altas encontradas y corregidas, 0 abiertas. 88 ADR aceptadas (34 originales, 15 de ellas con enmienda, más 54 de la ronda). El esquema Zod se verificó **ejecutándolo**, no leyéndolo.
- **Fase actual: 2 — Backend del módulo nuevo (en curso desde 2026-09-04).**
- **Rama de la fase 2: `claude/fase-2-backend-orchestration-ksyuzi`**, creada desde `claude/agent-network-invitation-41nx5y` en `88238b2` (fase 1 cerrada en `4681b2c` + el prompt de la fase 2). El entorno de esta sesión obliga a trabajar sobre una rama propia por fase; `contratos.md §1` y `brief-comun.md` siguen nombrando la rama de la fase 1, que es la base, no la de trabajo actual.
- Fases: 0 Preparación (cerrada) · 1 Diseño (cerrada) · **2 Backend (siguiente)** · 3 Frontend · 4 Plantillas y kit · 5 Migración · 6 Calidad y entrega.
- Nota de entorno: en este entorno los sub-agentes **no** pueden lanzar sub-agentes. El orquestador de cada fase lanza todos los agentes directamente (red de un solo nivel).

## Fase 1 cerrada — qué leer para empezar la fase 2, en este orden
1. **`memoria/contratos.md`** — es el contrato vigente y manda sobre cualquier documento de `diseno/` que lo contradiga. Trae esquema, API, persistencia, pruebas, frontend, migración y contrato de IA, con el estado real del entorno de build.
2. `diseno/01-dominio-y-esquema.md` + `diseno/esquema/*.ts` + `diseno/ejemplos/**` — el contrato de datos completo, con firmas en TypeScript y Kotlin, pseudocódigo del merge y los hashes. Verificado ejecutándolo.
3. `diseno/02-persistencia-y-catalogo.md` — DDL final copiable (migraciones `V29`-`V37`) y el árbol de clases Kotlin nombradas una por una.
4. `diseno/03-api.md` — las 19 rutas con contrato completo, la matriz rol × ruta y los códigos `TPL_*`.
5. `memoria/preguntas-abiertas.md` — 63 supuestos agrupados por área que la fase 2 **no debe volver a decidir por su cuenta**.
6. `memoria/handoffs/1R-dirimidor.md` — qué se decidió en cada contradicción y por qué; evita reabrir debates ya cerrados.
7. `diseno/08-*.md` y `09-*.md` — el rastro adversarial: por qué el diseño es como es. No hacen falta para empezar, sí para no deshacer una corrección sin saberlo.
8. `diseno/04`, `05`, `06`, `07` — para las fases 3, 5, transversal de calidad y futura de IA. No bloquean el arranque del backend, salvo `06` (umbrales y CI, que la fase 2 debe implementar) y dos tareas que `04` deja para el backend: el webhook de revalidación y el CORS de las tipografías.

**Lo primero que debe hacer la fase 2**, antes de escribir código de negocio: arreglar el build (el toolchain Java 17 no compila hoy; ver `handoffs/0-build-jdk.md`), crear el `ci.yml` de `06 §9`, y comprobar lo único que quedó sin verificar por falta de JDK — que `com.networknt:json-schema-validator` acepte el bundle con `$defs` y que el espejo Kotlin de las invariantes case con el de TypeScript.
