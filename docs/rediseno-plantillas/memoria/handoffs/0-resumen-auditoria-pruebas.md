# Resumen de auditoría para el rol "Estrategia de pruebas y calidad" (fase 1, sub-agente 6)

Fuente completa: `docs/analisis-plantillas/ANALISIS-GENERACION-PLANTILLAS.md` §5.2 H-19, §9.3 (trade-offs, último punto). Detalle: `fases/D-consumo.md` hallazgo 7, `fases/H-hipotesis.md` (metodología de verificación adversarial y prueba empírica), `fases/X-dirimidor-seed.md` (metodología de dirimencia por ejecución).

## Hallazgo central

- **H-19 — cero pruebas, con siete dependencias de test declaradas.** `build.gradle.kts:79-85` declara `spring-boot-starter-test`, `kotlin-test-junit5`, `spring-security-test`, `mockito-kotlin:5.1.0`, `junit-platform-launcher`, `h2` (runtime), `de.flapdoodle.embed:de.flapdoodle.embed.mongo:4.11.0` — **verificado en esta sesión**: `src/test` no existe como directorio en el repositorio. La infraestructura para pruebas unitarias, de integración con Mongo embebido y de seguridad ya está declarada y no la usa ni un archivo → informe §5.2 H-19, `fases/D-consumo.md` hallazgo 7.
- **Confirmado en esta sesión**: `./gradlew test` no llega a ejecutar ni una prueba en este entorno — falla en la fase de configuración por falta de JDK 17 y de un plugin de resolución de toolchains (`settings.gradle.kts` de una sola línea). Ver `handoffs/0-inventario.md` §4 para el detalle exacto y cómo desbloquearlo.

## Hallazgos que ilustran qué probar primero (por severidad de consecuencia silenciosa)

- **H-01/H-02/H-03/H-06** (familia, mesa de regalos, datos de demo): los 4 hallazgos de mayor impacto reputacional son **silenciosos** — sin prueba de caracterización, un rediseño puede reintroducirlos sin que ningún build falle.
- **H-12**: la metodología que lo confirmó — **control causal** (comentar la anotación y comparar el resultado con/sin ella) — es el patrón a replicar para golden files: fijar el comportamiento actual antes de tocar código (`fases/H-hipotesis.md` §5).
- **H-35**: asimetría de `ObjectMapper` entre el seeder (`jacksonObjectMapper()`, falla en claves desconocidas) y la API (Spring Boot autoconfig, tolera claves desconocidas) — candidato directo a prueba de contrato del esquema nuevo (P1): una sola configuración de (de)serialización, probada contra ambos caminos.
- **H-54**: 3 funciones completas duplicadas (código vivo vs. comentado) con reglas de precedencia **distintas** — sin pruebas que fijen cuál es la viva, cualquier refactor puede resucitar la versión equivocada.

## Contrato implícito como fuente de casos de prueba (informe §6, resumen)

Cada fila de las tablas §6.1 (`default_visual_configs`, 12 reglas) y §6.2 (`default_content_configs`, 12 reglas) es, literalmente, un caso de prueba de contrato que hoy no existe: plantilla sin datos de usuario, plantilla con menos/más ítems que el usuario, claves desconocidas, `visibility: false` deliberado, ids duplicados, tipos de dress code no reconocidos. El "contrato implícito" completo (§6 del informe) es el punto de partida más barato para escribir la matriz de pruebas de caracterización recomendada en §9.3.

## Recomendación transversal del informe (§9.3, última viñeta, cita directa del razonamiento)

"Sin ninguna prueba (H-19) y con un solo commit de historia, cualquiera de los tres caminos avanza a ciegas. La inversión de menor riesgo y mayor efecto habilitante no es ninguna de las tres opciones, sino **una batería de pruebas de caracterización** que fije el comportamiento actual del merge para las ocho plantillas sembradas antes de tocar nada."

## 3 opciones de rediseño y su exigencia de pruebas (informe §9.2, 3 líneas)

- **Opción A**: exige el validador de plantilla (≥12 reglas de §6.1) con pruebas propias — es la única pieza de pruebas que trae consigo, y no cubre generación/regeneración.
- **Opción B**: exige probar que el JSON compuesto en cada lectura es **equivalente** al que se servía antes, invitación por invitación — sin H-19 resuelto primero, esto se construye desde cero (riesgo "Alto" ya marcado en el informe §9.2 opción B).
- **Opción C** (**la adoptada**, P9 del prompt): composición pura con **golden files por plantilla** y pruebas de migración de versión, contrato de esquema compartido Kotlin/TypeScript, e2e Playwright del flujo completo del editor — es la que más reduce la superficie a probar (de 2743 líneas de merge visual a un contrato de datos pequeño, informe §9.2 opción C).
