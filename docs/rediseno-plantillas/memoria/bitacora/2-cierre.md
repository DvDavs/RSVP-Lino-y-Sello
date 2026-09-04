# 2-cierre — cierre de la fase 2 (backend del módulo nuevo)

Orquestador raíz Opus 5. Rama `claude/fase-2-backend-orchestration-ksyuzi`, creada desde
`claude/agent-network-invitation-41nx5y` (`88238b2`; fase 1 cerrada en `4681b2c`).

## 1. Salida real de la suite al cierre

Ejecutada por el orquestador sobre la rama integrada, no reportada por un sub-agente.

```
$ TPL_TEST_STATE_DIR=/tmp/templates2-pg-cierre sh ./gradlew clean check jacocoTestCoverageVerification
> Task :test
> Task :jacocoTestReport
> Task :jacocoTestCoverageVerification
> Task :verifyJsonSchemaEmitted
> Task :check
BUILD SUCCESSFUL in 3m 7s
10 actionable tasks: 10 executed
EXIT=0
```

Recuento leído de `build/test-results/test/TEST-*.xml`:
```
KOTLIN: clases=79 tests=1184 failures=0 errors=0 skipped=0
```

```
$ pnpm --filter @invitaciones/schema test
Test Files  13 passed (13)
     Tests  458 passed (458)
```

Cobertura JaCoCo por paquete (`build/reports/jacoco/test/jacocoTestReport.xml`):
```
  persistence    line 91.08%  branch 71.76%
  schema         line 97.53%  branch 87.14%
  catalog        line 88.65%  branch 70.14%
  api            line 93.94%  branch 75.39%
  composition    line 99.19%  branch 88.13%
  migration      line 99.67%  branch 87.42%
  domain         line 94.77%  branch 100.00%
  BUNDLE(total)  line 94.62%  branch 81.22%
```
Umbrales de `contratos §6` cumplidos: `composition*`/`migration*` ≥ 85 líneas y ≥ 70 ramas; `Invariants*`
(CLASS) 100 % ≥ 95; BUNDLE 94,62 ≥ 80.

**CI en GitHub: NO se ha podido verificar desde esta sesión.** El workflow existe
(`.github/workflows/ci.yml`) y su YAML está validado, pero no hay `gh` y no se ha ejecutado nunca en el
runner. Además, el job `backend` levantaría el contexto completo y hoy **fallaría** por el defecto
ajeno de `graduates_name` (ver §4).

## 2. Las dos verificaciones que la fase 1 dejó pendientes — resueltas

1. **`com.networknt:json-schema-validator:1.5.4` acepta el bundle**: compila `templates2.schema.json`
   (15 `$defs`, `$id` absoluto) y los 10 punteros resuelven su `$ref` contra el bundle **preinstalado
   por `$id`**, con **0 accesos de red** — probado con un `SchemaLoader` propio y un `ProxySelector`
   que **lanzan** ante cualquier acceso, no asumiendo que no ocurre. **10/10** ejemplos de
   `diseno/ejemplos/` válidos: **el mismo veredicto que Zod y ajv** en la fase 1. No hizo falta
   ninguna alternativa de `1R-backend.md`; no hay ADR de contingencia.
2. **Paridad de invariantes Kotlin↔TypeScript**: `InvariantParityTest` corre los **30 ficheros / 102
   casos** de `golden/invariants/` y exige el mismo conjunto de códigos: **102/102 a la primera**.
   `I-29` corre sobre el JSON crudo **antes** de `parse`, como manda `contratos §3`. `I-31` no se
   declara (X-03).

## 3. Lo que las revisiones encontraron y que ninguna prueba veía

Tres revisiones Opus (dos obligatorias sobre entregables Sonnet, una global de cierre) encontraron
defectos que las suites en verde **no** detectaban. Se registran aquí porque son el argumento de por
qué la revisión adversarial no es ceremonia:

- **Bucket de S3 divergente (ADV-01, defecto vivo)**: cuatro puntos del módulo resolvían el bucket por
  defecto con dos valores distintos. En producción, **toda** subida de asset del editor habría ido a un
  bucket inexistente, y la URL de **todo** asset de plantilla dentro del `composed` congelado en
  `tpl_release` habría apuntado a otro. **Ninguna de las 1 100 pruebas lo veía porque todas inyectan
  un bucket de prueba.**
- **Golden que se reescribía a sí mismo (O-07)**: el generador escribía los golden **antes** de
  compararlos con los ejemplos y sólo avisaba por consola. Una regresión de `compose()` habría
  reescrito el golden con la salida errónea y la prueba habría seguido en verde comparándose consigo
  misma.
- **Normalización de los `.default()` de Zod (O-02)**: `golden/templates/*/template.json` es la salida
  de `parse`, con 28 defaults ya inyectados, mientras el JSON Schema emitido los marca **opcionales**.
  Un manifiesto crudo válido habría hecho violar `I-22` en Kotlin sobre algo que TypeScript acepta.
- **`ddl-auto: validate` no comprueba la nulabilidad**: descubierto **saboteando** la prueba. Renombrar
  una columna o cambiar su tipo JDBC la tumban; pasar `nullable=false` a `true` sobre una columna
  `NOT NULL` **pasa en verde**. El KDoc afirmaba lo contrario.
- **ULID monótono y `public_token` (ADR-2-ORQ-01)**: medido que dos tokens del mismo milisegundo se
  diferencian en **+1**. Como el render público sirve por ese token **sin autenticación**, adivinarlo
  *es* el acceso. Corregido con `SecureRandom`.
- **Compuertas que no podían fallar**: `invariant-gaps` con tres de seis comprobaciones equivalentes a
  "el JSON no está vacío"; tres `it.todo` que habrían seguido en amarillo aunque alguien retirase la
  comprobación del reductor; y `MagicBytes` con las ramas de SVG, MP3 y WOFF2 sin una sola prueba,
  siendo un control de seguridad sobre archivos del cliente.

## 4. Riesgo abierto, ajeno al módulo

`InvitationGuestEntity.kt:28` mapea `invitation_guest.graduates_name`; **ninguna migración la crea** y
`application.yml:32` fija `ddl-auto: validate`. Verificado: una base construida sólo con Flyway **no
arranca la aplicación**. Es el **único** desajuste esquema/entidad del proyecto (medido en 2-1-REV).
Consecuencia que hay que decir con todas las letras: **las 19 rutas nunca se han visto responder sobre
un Tomcat real**, ni en local ni en CI; todas las pruebas de contrato corren sobre contextos Spring
**acotados** al módulo. No se corrigió por estar en área prohibida (invitados, ADR-2-ORQ-02).
