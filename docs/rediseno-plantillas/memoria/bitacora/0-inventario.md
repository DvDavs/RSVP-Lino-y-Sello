# Bitácora — sub-agente 0-inventario (fase 0)

## Qué hice

1. Leí el prompt maestro (`docs/analisis-plantillas/PROMPT-REDISENO-MODULO-PLANTILLAS.md`) completo (no solo §1/2/3/7, para poder citar §9 y §10 con precisión al escribir los resúmenes por rol) y la memoria existente (`00-INDICE.md`, `contratos.md`, `glosario.md`, `brief-comun.md`).
2. Leí el informe final de la auditoría (`docs/analisis-plantillas/ANALISIS-GENERACION-PLANTILLAS.md`) completo: §1-9 (resumen ejecutivo, mapa del subsistema, anatomía del generador, ciclo de vida de plantilla, catálogo de 60 hallazgos H-01 a H-60, contrato implícito §6, hipótesis, preguntas abiertas, 3 opciones de rediseño §9).
3. Exploré el árbol de módulos backend (`find src/main/kotlin/.../modules`, `.../core`) y leí el código real de los puntos de integración: `InvitationEntity.kt`, `InvitationGuestEntity.kt`/`InvitationGuestsRepository.kt`, `PublicGuestInfoController.kt`/`PublicInvitationInfoController.kt`, `core/s3/**` (5 archivos), `core/auth/**` (`JwtTokenFilter.kt`, `HierarchyValidationService.kt`), `core/error/GeneralExceptionHandler.kt`, y busqué configuración de `ObjectMapper` (no existe un bean global — confirmado con `grep`).
4. Leí `build.gradle.kts`, `gradle.properties`, `gradle-wrapper.properties`, `settings.gradle.kts`, `docker-compose.yml`, `docker-compose.dev.yml`, `application.yml`, listé `db/migration` (V1-V28) y confirmé la ausencia de `.github/workflows` y de `src/test`.
5. Ejecuté `./gradlew test` tres veces: con `--offline` (falla al resolver el plugin de Kotlin, no cacheado), sin `--offline` (los plugins resuelven vía el proxy de la sesión, pero falla en la fase de configuración por falta de un JDK 17 — solo hay JDK 21 instalado y no hay plugin resolver de toolchains en `settings.gradle.kts`), y con `-Porg.gradle.java.installations.auto-download=true` (mismo resultado: sin el plugin `foojay-resolver-convention`, esa propiedad no tiene efecto). Reporté el resultado real y su causa exacta, sin intentar parchear el entorno (no toqué ningún archivo del repo para esto).
6. Medí líneas de los archivos del módulo antiguo listados en el prompt §2 y de los `data*Premium.ts`/`invitaciones.sql` de la raíz; noté que `ExtraModulesHandler.kt` (nombre citado en el prompt) no existe — el archivo real es `ExtraModuleHelper.kt` (26 líneas).
7. Consulté el registro de npm (`npm view <pkg> version`) para los 18 paquetes pedidos; todos respondieron sin error.
8. Escribí `handoffs/0-inventario.md` (114 líneas) y los 7 `handoffs/0-resumen-auditoria-<rol>.md` (27-39 líneas cada uno).

## Evidencia clave que no cabía en los entregables

- `find .github` → no existe el directorio; **no hay CI**.
- `find src/test` → no existe; confirma H-19 (cero pruebas) de forma directa, no solo por lectura del informe.
- `grep -rln "ObjectMapper"` sobre `src/main/kotlin` → solo 2 usos ad hoc (`MongoDataInitializer.kt:27` con `jacksonObjectMapper()`, `MasterTemplatesService.kt:32` con el bean autoconfigurado de Spring), cero `@Bean ObjectMapper`/`Jackson2ObjectMapperBuilder` propios — confirma H-35 con evidencia de primera mano.
- `java -version` en este entorno → OpenJDK 21.0.10; `settings.gradle.kts` → una sola línea (`rootProject.name = "Invitaciones"`), sin plugin de resolución de toolchains.

## Qué no pude determinar

- Si `./gradlew test` funciona en el CI real de la organización (no existe CI en el repo) o en la máquina de desarrollo del equipo — solo puedo reportar que en **este** entorno de sesión falla por el motivo exacto arriba descrito, que es plausible que también afecte a cualquier sub-agente de fase 2 en un entorno equivalente.
- El contenido exacto de las plantillas 11, 12, 14, 16, 17 (NO DETERMINABLE desde el repositorio, ya señalado por la propia auditoría en su §6.5 y §8.1 pregunta 3).
- Si npm 10.9.7 / node 22 de este entorno coincide con lo que usará el equipo de frontend; las versiones que fijé son las que ofrece el registro público en la fecha de esta sesión (2026-09-03).

## Riesgos para la fase 1

- **TypeScript 7.0.2 y Zod 4.5.4 y Tailwind 4.3.3 son saltos mayores** respecto a lo que probablemente asumía la investigación previa (`investigacion-editor-y-tecnologias.md`, que no fijó versiones exactas). El sub-agente de arquitectura frontend (fase 1, rol 4) debe verificar compatibilidad de `zod-to-json-schema` con Zod v4 antes de comprometerse al pipeline "Zod → JSON Schema → Kotlin" que fija `contratos.md` §2.
- El bloqueo de `./gradlew test` en este tipo de entorno puede repetirse en fase 2 (implementación del backend nuevo) si el entorno de esa sesión tampoco tiene JDK 17; dejarlo señalado explícitamente en `0-inventario.md` §4 para que el orquestador lo anticipe (instalar JDK 17 o añadir `id("org.gradle.toolchains.foojay-resolver-convention")` a `settings.gradle.kts` — este último sería un cambio de código que debe pasar por una decisión del orquestador, no lo hice yo).
- No encontré handoff previo de un sub-agente de fase 0 anterior sobre estructura de memoria — `bitacora/` y `handoffs/` no existían como directorios antes de esta tarea (los creé). El resto de la memoria (`00-INDICE.md`, `contratos.md`, `decisiones.md`, `glosario.md`, `preguntas-abiertas.md`, `tablero.md`, `brief-comun.md`) ya estaba creada por el orquestador.

## No modifiqué código ni hice commits, según las reglas de la tarea.

Nota: para ejecutar `./gradlew test` fue necesario `chmod +x gradlew` (el archivo no traía el bit de ejecución en el checkout). Al terminar revertí el permiso a su estado original (`chmod 644 gradlew`) para dejar `git status --short` limpio; no quedó ningún cambio de código ni de configuración en el árbol de trabajo.
