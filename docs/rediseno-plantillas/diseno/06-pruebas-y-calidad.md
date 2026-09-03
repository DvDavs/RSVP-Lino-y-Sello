# 06 — Estrategia de pruebas y calidad

Autor: fase 1, rol `1-pruebas`. **Revisado y profundizado en la ronda 1R por `1R-calidad` (2026-09-03)** — ver §12.
Estado: propuesto para aceptación (ADR-024…026, y las ADR nuevas `ADR-1R-C-08…12`).
Evidencia: `handoffs/0-resumen-auditoria-pruebas.md`, `contratos.md` §7, `handoffs/0-build-jdk.md`, `01-dominio-y-esquema.md`, `02-persistencia-y-catalogo.md`, `03-api.md`, `04-frontend-y-editor.md`, `esquema/invariants.ts`, `esquema/blocks.ts`.

> Marcas de confianza: **[V]** verificado ejecutándolo en esta sesión · **[I]** inferido · **[ND]** no determinable.

---

## 1. Pirámide de pruebas por capa

```
                    e2e (Playwright)              pocas, caras, flujo completo
                 ───────────────────
              contrato (esquema + API)          medianas, una por regla/código
           ───────────────────────────
        unitarias (composición, migración,     muchas, baratas, el núcleo real
        invariantes, reductor de operaciones)
```

| Capa | Qué cubre | Herramienta | Ubicación |
|---|---|---|---|
| Unitaria backend | `compose()`, `migrate()`, `TemplateRegistrar`, `Invariants.kt`, reductor Kotlin | JUnit5 + MockK (`mockito-kotlin:5.1.0` ya está declarado, `build.gradle.kts:82`, y sirve si no se añade MockK) | `src/test/kotlin/mx/evolutiondev/invitaciones/modules/templates2/**` |
| Unitaria frontend | `packages/sections`, reductor TS, `invariants.ts` | Vitest 3 + Testing Library | `frontend/packages/*/src/**/*.test.ts(x)` |
| Contrato de esquema | Cada schema exportado con caso positivo y negativo; el `.schema.json` generado == el commiteado | Vitest (TS) + JUnit5 con `com.networknt:json-schema-validator` (Kotlin), **la misma tabla de casos** (§4) | `frontend/packages/schema/src/**/*.contract.test.ts`, `src/test/kotlin/.../schema/*ContractTest.kt` |
| Contrato de API | Cada ruta de `03 §2`, cada código `TPL_*` de `03 §5` | JUnit5 + `MockMvc` contra Postgres real (§6) | `src/test/kotlin/.../templates2/api/**` |
| Golden files | Composición determinista R1-R9 sobre los 2 ejemplos + las 9 plantillas migradas | JUnit5 + Vitest, **misma carpeta** (§3) | `frontend/packages/schema/golden/**` (ruta única) |
| Accesibilidad | Render público de los 2 ejemplos + editor | `@axe-core/playwright` | `frontend/apps/web/e2e/a11y.spec.ts` |
| e2e | §8 | Playwright | `frontend/apps/web/e2e/*.spec.ts` |

## 2. Umbrales de cobertura: medibles y verificables (ADR-024 + ADR-1R-C-08)

La versión previa fijaba porcentajes por paquete sin decir con qué herramienta se miden ni qué comando falla. Los dos huecos se cierran aquí, con la elección **verificada ejecutándola** en este entorno.

### 2.1 Kotlin: **JaCoCo 0.8.12**, no Kover (decisión con evidencia)

Se probaron los dos, con Gradle 8.14.3, Kotlin 1.9.25 y toolchain 21 (proyectos aislados en `scratchpad/1R-calidad/{kover,jacoco}-probe`) **[V]**.

- **Kover 0.9.1 resuelve y falla el build correctamente** para un umbral global:
  ```
  > Rule 'global >= 80%' violated: lines covered percentage is 0.000000, but expected minimum is 80
  BUILD FAILED · EXIT=1
  ```
  Pero **no admite umbrales distintos por paquete en un mismo conjunto de reglas**. Verificado por introspección del jar del plugin **[V]**:
  ```
  $ javap kotlinx.kover.gradle.plugin.dsl.KoverVerifyRule
  public interface KoverVerifyRule {
    Property<GroupingEntityType> getGroupBy();  Property<Boolean> getDisabled();
    void bound(Action<KoverVerifyBound>);  void minBound(int); void maxBound(int); ...
  }
  ```
  No hay `filters`. El intento de escribirlo falla en compilación del script:
  ```
  Line 11: filters { includes { classes("...templates2.composition.*") } }
           ^ 'fun filters(...)' can't be called in this context by implicit receiver
  ```
  La única agrupación disponible es `groupBy = PACKAGE`, que aplica **el mismo** umbral a todos los paquetes — inservible para ADR-024, que exige 85 % en `composition`/`migration` y 80 % en el resto.
- **JaCoCo sí lo hace de forma nativa**, con dos reglas y dos umbrales, y falla el build **[V]**:
  ```
  [ant:jacocoReport] Rule violated for bundle jacoco-probe: lines covered ratio is 0.50, but expected minimum is 0.80
  [ant:jacocoReport] Rule violated for package mx.evolutiondev.invitaciones.modules.templates2.composition: lines covered ratio is 0.50, but expected minimum is 0.85
  BUILD FAILED · EXIT=1
  ```

Configuración exacta a añadir en `build.gradle.kts` en fase 2 (es el **único** cambio de build que este documento pide, además del toolchain 21 de `handoffs/0-build-jdk.md`):

```kotlin
plugins {
    // … los existentes …
    jacoco
}

jacoco { toolVersion = "0.8.12" }

tasks.test {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports { xml.required = true; html.required = true }
    // El módulo antiguo no se mide: no tiene pruebas (H-19) y arrastraría el bundle a ~0 %.
    classDirectories.setFrom(files(classDirectories.files.map {
        fileTree(it) { include("mx/evolutiondev/invitaciones/modules/templates2/**") }
    }))
}

tasks.jacocoTestCoverageVerification {
    dependsOn(tasks.jacocoTestReport)
    classDirectories.setFrom(tasks.jacocoTestReport.get().classDirectories)
    violationRules {
        rule {   // ADR-024: núcleo de lógica entrelazada
            element = "PACKAGE"
            includes = listOf(
                "mx.evolutiondev.invitaciones.modules.templates2.composition*",
                "mx.evolutiondev.invitaciones.modules.templates2.migration*",
            )
            limit { counter = "LINE";   value = "COVEREDRATIO"; minimum = "0.85".toBigDecimal() }
            limit { counter = "BRANCH"; value = "COVEREDRATIO"; minimum = "0.70".toBigDecimal() }
        }
        rule {   // ADR-024: resto del módulo
            element = "BUNDLE"
            limit { counter = "LINE"; value = "COVEREDRATIO"; minimum = "0.80".toBigDecimal() }
        }
        rule {   // ADR-1R-C-08: ninguna clase de invariantes puede quedar sin tocar
            element = "CLASS"
            includes = listOf("mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants*")
            limit { counter = "LINE"; value = "COVEREDRATIO"; minimum = "0.95".toBigDecimal() }
        }
    }
}

tasks.check { dependsOn(tasks.jacocoTestCoverageVerification) }
```

**Comando que falla la build:** `./gradlew test jacocoTestReport jacocoTestCoverageVerification` (o simplemente `./gradlew check`). Sale con código 1 y nombra la regla y el paquete violados **[V]**.

`element = "BUNDLE"` mide el bundle ya filtrado a `templates2/**` por `classDirectories`; sin ese filtro el 80 % global sería inalcanzable mientras exista el módulo antiguo sin pruebas (H-19).

### 2.2 TypeScript: Vitest 3 con provider `v8`

Probado en este entorno con `vitest@3.2.7` + `@vitest/coverage-v8@3.2.x` **[V]**:

```
% Coverage report from v8
Statements : 100% ( 5/5 )   Branches : 100% ( 2/2 )
Functions  : 50%  ( 1/2 )   Lines    : 100% ( 5/5 )
ERROR: Coverage for functions (50%) does not meet global threshold (90%)
EXIT=1
```

Dos observaciones **[V]** que condicionan los umbrales:
1. El provider `v8` **sí** marca como no cubiertas las líneas del cuerpo de una función nunca llamada cuando el cuerpo tiene más de una sentencia (`45.45 % · Uncovered Line #s 6-11`).
2. Pero con un cuerpo de **una sola sentencia** (`return a * 2;`) reportó `Lines 100 %` y solo `Functions 50 %`. Por tanto **un umbral solo de líneas es insuficiente en TS**: hay que fijar además `functions`.

Configuración por paquete (`frontend/packages/*/vitest.config.ts`), con umbrales distintos:

```typescript
// packages/schema/vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.{test,contract.test}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "lcov"],
      all: true,
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: { lines: 90, functions: 95, branches: 85, statements: 90 },
    },
  },
});
// packages/sections/vitest.config.ts → thresholds: { lines: 70, functions: 75, branches: 60, statements: 70 }
// apps/web/vitest.config.ts          → thresholds: { lines: 60, functions: 65, branches: 50, statements: 60 }
```

**Comando que falla la build:** `pnpm -r --filter "./packages/**" --filter "./apps/**" exec vitest run --coverage`. Sale con código 1 y nombra la métrica y el umbral **[V]**.

### 2.3 Tabla de umbrales (sustituye a la de la versión previa)

| Ámbito | Herramienta y regla | Umbral | Comando que lo aplica |
|---|---|---|---|
| `templates2.composition*`, `templates2.migration*` | JaCoCo `element=PACKAGE` | líneas ≥ 85 %, ramas ≥ 70 % | `./gradlew jacocoTestCoverageVerification` |
| `templates2.schema.Invariants*` | JaCoCo `element=CLASS` | líneas ≥ 95 % | idem |
| `templates2` completo | JaCoCo `element=BUNDLE` (filtrado) | líneas ≥ 80 % | idem |
| `packages/schema` | Vitest v8 | líneas 90 / funciones 95 / ramas 85 | `vitest run --coverage` |
| `packages/sections` | Vitest v8 | líneas 70 / funciones 75 / ramas 60 | idem |
| `apps/web` (lógica, no e2e) | Vitest v8 | líneas 60 / funciones 65 / ramas 50 | idem |
| Esquemas exportados de `packages/schema` | §5.3 (prueba mecánica, no porcentaje) | **100 %** con ≥1 caso positivo y ≥1 negativo | `vitest run schema-coverage.contract.test.ts` |
| Invariantes I-01…I-29 | §4 (tabla compartida) | **100 %** con ≥1 caso que viola y ≥1 que no | `./gradlew test` + `vitest run` |
| Tipos de bloque (14) | §5.2 | **100 %** con la matriz completa | idem |
| e2e | §8 | los 6 escenarios en verde | `playwright test` |
| a11y | `@axe-core/playwright` | 0 violaciones `critical`/`serious` en el render público de los 2 ejemplos | `playwright test e2e/a11y.spec.ts` |

## 3. Golden files: **una sola ruta** (ADR-1R-C-09)

La versión previa decía `src/test/resources/golden/**` y `frontend/packages/schema/golden/**`, "mismos archivos, symlink o copia". Dos rutas con symlink o copia es exactamente el mecanismo por el que dos representaciones divergen (H-35). **Ruta única, sin copia ni symlink:**

```
frontend/packages/schema/golden/
├── templates/<slug>-<version>/{template,defaults,theme,documento,compuesto,reporte}.json
├── invariants/I-01-range-end-before-start.json … I-29-reserved-object-key.json   # 29 ficheros
├── blocks/<blockKind>.cases.json                       # §5.2, 14 ficheros
├── operations/<op>.cases.json                          # 10 ficheros, catálogo de operations.ts
└── migrations/<slug>/<from>-to-<to>/{antes,despues-esperado}.json
```

**Formato de fichero.** JSON puro (no JSONC: lo tiene que leer Jackson con configuración estricta), UTF-8, sin BOM, indentado 2, claves en el orden en que las declara el esquema. Todo fichero de casos es un **array** de objetos con esta forma mínima:

```json
[
  { "name": "identificador estable y único dentro del fichero",
    "input": { },
    "expect": { } }
]
```

**Cómo lo lee TypeScript** — `import` directo desde el paquete:
```typescript
// packages/schema/src/testing/golden.ts
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../../golden/", import.meta.url));
export const goldenDir = (sub: string) => ROOT + sub;
export const loadCases = <T>(sub: string, file: string): T[] =>
  JSON.parse(readFileSync(ROOT + sub + "/" + file, "utf8"));
export const listCases = (sub: string): string[] => readdirSync(ROOT + sub).filter(f => f.endsWith(".json")).sort();
```

**Cómo lo lee Kotlin** — la misma carpeta se declara como directorio de recursos de prueba en `build.gradle.kts`, sin copiar nada:
```kotlin
sourceSets {
    test {
        resources {
            srcDir("frontend/packages/schema/golden")   // ruta única compartida (ADR-1R-C-09)
        }
    }
}
```
y en la prueba:
```kotlin
object Golden {
    private val mapper = jacksonObjectMapper()   // estricto: falla ante clave desconocida (mata H-35)
    fun <T> cases(sub: String, file: String, type: TypeReference<List<T>>): List<T> =
        javaClass.getResourceAsStream("/$sub/$file")!!.use { mapper.readValue(it, type) }
    fun list(sub: String): List<String> =                       // enumeración desde el classpath
        PathMatchingResourcePatternResolver().getResources("classpath:/$sub/*.json").map { it.filename!! }.sorted()
}
```

**Regla de deriva:** una prueba (`GoldenInventoryTest` en Kotlin y `golden-inventory.test.ts` en TS) enumera los ficheros de cada subcarpeta y **falla si el inventario esperado no coincide** — así, añadir un caso solo a un lado es imposible: el otro lado lo ve aparecer y, si no lo sabe interpretar, falla.

`FIXED_BUSINESS_SNAPSHOT` es un literal (`golden/templates/_business.json`), sin reloj, sin aleatoriedad (R6/ADR-007). Añadir una plantilla es copiar una carpeta bajo `golden/templates/`: la prueba es parametrizada sobre el listado, sin código nuevo por plantilla.

Golden de **migración de versión**: por cada `MigrationPlan` registrado, un par `antes.json`/`despues-esperado.json`; la prueba corre `migrate()` y compara canónicamente.

## 4. Las 29 invariantes, una por una (ADR-005, ADR-034, ronda 1R)

> **Sincronización de la ronda 1R (releído al cerrar este documento).** La versión previa decía "un archivo por invariante `I-01`…`I-21`". Cuando empecé la revisión el catálogo tenía **23** (`contratos.md` §3, ADR-034). Al cerrar, el agente `1R-dominio` había ampliado `esquema/invariants.ts` a **29** (`I-24`…`I-29`) **[V]**, y de paso había cerrado dos de mis objeciones: `richText.maxLength` ya se valida (`invariants.ts` `case "richText"`) y `z.any()` ya no aparece en `composed.ts`. La tabla de abajo cubre las **29**; los umbrales, el formato y los runners no cambian. Que el número haya pasado de 21 → 23 → 29 en una sola fase es precisamente la razón por la que la prueba de inventario de §3 y la de exhaustividad de §4.2 existen: el catálogo va a seguir creciendo y ninguna ampliación puede entrar sin su fichero de casos en los dos lados.

Enumeradas con el caso mínimo que cada fichero debe contener. Cada fichero lleva **al menos** un caso que viola y uno que no; los "casos extra" son los que la revisión adversarial exige por ser trampas conocidas.

| Invariante (código) | Validador y punto | Caso que **viola** (mínimo) | Caso que **no viola** | Caso extra obligatorio |
|---|---|---|---|---|
| **I-01** `RANGE_END_BEFORE_START` | `validateValueAgainstSpec`, `dateTimeRange` | `start 16:00`, `end 15:00` mismo día | `end` ausente | `end == start` (debe **no** violar: la comparación es `<` en `case "dateTimeRange"`) |
| **I-02** `CHOICE_UNKNOWN_OPTION` | idem, `choice` | `optionId` fuera de `spec.options` | `optionId` de la lista | `options` con un solo elemento |
| **I-03** `ITEM_ID_DUPLICATE` | idem, `group` | dos ítems con el mismo ULID | ítems distintos | 24 ítems (el máximo) todos distintos |
| **I-04** `GROUP_SIZE_OUT_OF_BOUNDS` | idem, `group` **y `listText`** | grupo con `items.length > spec.max` | dentro de rango | `listText` con `items.length > maxItems` — **el mismo código se usa para `listText`** (`case "listText"`, rama de `minItems`/`maxItems`), y la prueba debe fijarlo o el nombre engaña |
| **I-05** `BUSINESS_FIELD_MISSING` | `validateManifest` | bloque `source:"business"` sin `businessField` | con `businessField` | `source:"user"` sin `businessField` (no viola) |
| **I-06** `BUSINESS_TYPE_MISMATCH` | `validateManifest` | `businessField:"invitation.date"` en un bloque `type:"text"` | en un bloque `type:"date"` | los 6 `BusinessField` × su tipo correcto (6 casos que no violan) |
| **I-07** `GROUP_MIN_GT_MAX` | `validateManifest` | `min:5`, `max:3` | `min:0`, `max:12` | `min == max` (no viola) |
| **I-08** `DEFAULT_VARIANT_UNKNOWN` | `validateManifest` **y** `validateDocument` | `defaultVariant` fuera de `variants` | dentro | `structure[].variant` desconocido — **el mismo código lo emiten `validateManifest` (para `defaultVariant`) y `validateDocument` (para `structure[].variant`)**; ambos caminos probados |
| **I-09** `THEME_DEFAULT_UNKNOWN` | `validateManifest` | `defaultPaletteId` inexistente | existente | `defaultFontSetId` inexistente (segunda rama de la misma comprobación en `validateManifest`) |
| **I-10** `DEFAULT_KEY_UNKNOWN` | `validateManifest` | clave de `defaults.content` que no es `blockId` del manifiesto | clave válida | clave que es un `itemBlock` de un grupo (¿es válida? — fijar el comportamiento, hoy **no** lo es porque el índice `blockIds` de `validateManifest` solo recoge los bloques de nivel superior, no los `itemBlocks`) |
| **I-11** `STRUCTURE_DUPLICATE_KEY` | `validateDocument` | dos entradas con el mismo `key` | claves distintas | 16 entradas (máximo de `Structure`) sin repetir |
| **I-12** `CONTENT_KEY_UNKNOWN` | `validateDocument` | `content["noExiste"]` | clave declarada | clave de una versión anterior (debe violar, y el flujo la manda a `attic`) |
| **I-13** `BLOCK_ID_DUPLICATE` | `validateManifest` | mismo `blockId` en dos secciones | ids únicos | mismo id en dos `itemBlocks` del **mismo** grupo (índice `inner` de `validateManifest`) y el **mismo** id en grupos distintos (debe **no** violar: los itemBlocks son relativos) |
| **I-14** `SECTION_KEY_DUPLICATE` | `validateManifest` | dos secciones con la misma `key` | claves distintas | — |
| **I-15** `BLOCK_KIND_MISMATCH` | `validateValueAgainstSpec` | `TextValue` sobre un `ImageSpec` | tipos coincidentes | los 14 tipos × un tipo ajeno (matriz de §5.2) |
| **I-16** `TEXT_TOO_LONG` | idem, `text` y `listText` | `text` con `length > maxLength` | dentro | `text` con `length < minLength` — **el mismo código cubre "demasiado corto"**, el nombre engaña; un ítem de `listText` que excede `maxItemLength`; y un `richText` cuyo texto plano excede `maxLength` (`richTextLength()`, añadido en la ronda 1R) |
| **I-17** `REQUIRED_SECTION_HIDDEN` | `validateDocument` | sección `required:true` con `visible:false` | visible | sección `required:false` oculta (no viola) |
| **I-18** `ITEM_BLOCK_UNKNOWN` | `validateValueAgainstSpec`, `group` | `values` con una clave que no es `itemBlock` del grupo | clave válida | clave que sí es `blockId` de nivel superior pero no del grupo (debe violar) |
| **I-19** `STRUCTURE_KEY_UNKNOWN` | `validateDocument` | `structure` con una `key` que no está en el manifiesto | key válida | — |
| **I-20** `THEME_ID_UNKNOWN` | `validateDocument` | `doc.theme.paletteId` inexistente | existente | `fontSetId` inexistente (segunda rama de la misma comprobación en `validateDocument`) |
| **I-21** `BUSINESS_BLOCK_WRITTEN` | `validateDocument` | `content[x]` sobre un bloque `source:"business"` | bloque `source:"user"` | bloque `source:"fixed"` escrito (debe violar también: `validateDocument` rechaza todo `source !== "user"`) |
| **I-22** `ITEM_BLOCK_SOURCE_NOT_USER` | `validateManifest` | `itemBlock` con `source:"business"` | `source:"user"` | `itemBlock` con `source:"fixed"` (viola) |
| **I-23** `LOCALE_NOT_SUPPORTED` | `validateDocument` | `meta.locale:"en-US"` con `manifest.locales:["es-MX"]` | locale declarado | los 3 locales de `Locale` × declarado/no declarado |
| **I-24** `REORDER_NOT_A_PERMUTATION` | `validateReorder(order, actuales)`, llamada por el reductor **antes** de aplicar el lote | `order: ["cover","cover","cover"]`, o una lista a la que le falta una clave | permutación exacta de las claves actuales | mismo conjunto en distinto orden (no viola); una clave de más (viola) |
| **I-25** `GROUP_ROLE_MISMATCH` | `validateManifest` | bloque `type:"group"` con un rol que no está en `GROUP_ROLES`; o bloque escalar con un rol reservado a grupos | rol coherente con el tipo | `itemBlock` con rol de grupo (viola: la comprobación se repite dentro del bucle de `itemBlocks`) |
| **I-26** `SINGLETON_ROLE_DUPLICATE` | `validateManifest` | el mismo rol *singleton* (p. ej. `coverTitle`) en dos bloques del manifiesto | un solo uso | rol **no** singleton repetido (no viola) |
| **I-27** `LOCALIZED_TEXT_MISSING_LOCALE` | `validateManifest` | `label` sin `en-US` cuando `manifest.locales` lo declara | todos los locales presentes | `locales:["es-MX"]` y `label` solo con `es-MX` (no viola) |
| **I-28** `DEFAULT_FOR_BUSINESS_BLOCK` | `validateManifest` | `defaults.content[x]` sobre un bloque `source:"business"` — contenido muerto, R4 lo ignora siempre | default sobre un bloque `source:"user"` | default sobre `source:"fixed"` (fijar el comportamiento: hoy **no** viola: la comprobación de `validateManifest` solo mira `source === "business"`) |
| **I-29** `RESERVED_OBJECT_KEY` | `assertNoReservedKeys(raw)` sobre el **JSON crudo, antes de `parse()`** | `content` con la clave `__proto__` — verificado por `1R-dominio` que Zod la descarta **en silencio** y ajv la rechaza, es decir, TS y Kotlin discreparían | claves normales | `"constructor"` y `"prototype"`, que sí casan con el patrón de `BlockId`; y la misma clave dentro de `attic` y de `GroupItem.values` |

Forma del fichero (`golden/invariants/I-01-range-end-before-start.json`):
```json
[
  { "name": "end anterior a start",
    "fn": "validateValueAgainstSpec",
    "spec": { "id": "event.when", "type": "dateTimeRange", "role": "eventWhen",
              "label": {"es-MX": "Cuándo"}, "required": false, "editable": true,
              "source": "user", "aiEditable": true, "formatId": "long-h12" },
    "input": { "kind": "dateTimeRange", "start": "2026-12-12T16:00", "end": "2026-12-12T15:00" },
    "path": "content.event.when",
    "expect": ["I-01_RANGE_END_BEFORE_START"] },
  { "name": "end igual a start no viola", "fn": "validateValueAgainstSpec", "spec": { }, 
    "input": { "kind": "dateTimeRange", "start": "2026-12-12T16:00", "end": "2026-12-12T16:00" },
    "path": "content.event.when", "expect": [] }
]
```
El campo `fn` (`validateManifest` | `validateDocument` | `validateValueAgainstSpec` | `validateReorder` | `assertNoReservedKeys`) dice qué entrada usar; los cinco runners (uno por función) están parametrizados sobre el listado de `golden/invariants/`. `expect` es la lista **ordenada por código** de `Violation.code`; la comparación ignora `detail` y compara `code` + `path`.

Una sola prueba parametrizada en TS y otra en Kotlin recorren el mismo fichero. CI corre ambas sobre el mismo commit, así que una divergencia entre `invariants.ts` e `Invariants.kt` no puede mergearse.

### 4.1 Huecos que quedan en el catálogo (objeción Q-05, contradicción a dirimir CD-4)

`validateValueAgainstSpec` (`esquema/invariants.ts`) tiene `case` para `text`, `richText`, `listText`, `dateTimeRange`, `choice` y `group`. **Las restricciones declaradas en los demás specs siguen sin verificarse** **[V]** — con `richText.maxLength` ya cerrado por `1R-dominio` durante esta misma ronda:

| Restricción declarada | Dónde | Invariante que la verifica |
|---|---|---|
| `RichTextSpec.constraints.maxLength` | `blocks.ts` `RichTextSpec` | **cerrada en la ronda 1R** (`case "richText"` + `richTextLength()`) |
| `TextSpec.constraints.pattern` | `blocks.ts` `TextSpec` | **ninguna** |
| `TextSpec.constraints.multiline` | `blocks.ts` `TextSpec` | **ninguna** |
| `ImageSpec.constraints.aspect` | `blocks.ts` `ImageSpec` | **ninguna** |
| `ImageSpec.constraints.maxBytes` | `blocks.ts` `ImageSpec` | **ninguna** aquí (`03 §3.4` la mira en la subida, con otro límite) |
| `AudioSpec.constraints.maxBytes` | `blocks.ts` `AudioSpec` | **ninguna** |
| `ChoiceSpec.options[].label` no vacía | `blocks.ts` `ChoiceSpec` | cubierta por Zod |

Quedan **5 huecos**. Es el mismo patrón que ADR-005 quiso eliminar: una regla escrita en el esquema que ningún validador aplica. **No se resuelve aquí** (el bloque 01 es de otro autor y este documento no lo edita): se registra como contradicción a dirimir CD-4 y, mientras tanto, `06` fija una prueba que lo hace visible en vez de silencioso — `invariant-gaps.contract.test.ts` enumera cada `constraints.*` declarado en `blocks.ts` y falla si no hay un fichero `golden/invariants/I-xx-*.json` que lo ejercite. Hoy fallaría con 5 huecos; es la señal correcta, y bajó de 6 a 5 durante esta ronda sin que nadie tuviera que acordarse de mirarlo: exactamente para eso está la prueba.

### 4.2 Exhaustividad del catálogo

`invariant-catalog.contract.test.ts` enumera `InvariantCode` (hoy 29) y falla si algún código no tiene su fichero `golden/invariants/<código>.json`, o si un fichero no tiene al menos un caso que viola y uno que no. Es la contraparte de la prueba de inventario de §3: el catálogo puede crecer, pero no puede crecer sin pruebas ni crecer solo en un lado.

## 5. Contrato de esquema

### 5.1 Deriva del JSON Schema (ADR-004)

`pnpm --filter @invitaciones/schema schema:emit && git diff --exit-code -- packages/schema/dist/*.schema.json`. Si el fichero generado difiere del commiteado, CI falla. Es lo que mata H-35 por construcción: un solo generador, un solo artefacto.

### 5.2 Los 14 tipos de bloque, uno por uno

Un fichero `golden/blocks/<kind>.cases.json` por tipo. Cada uno contiene, **como mínimo**, estos 6 casos (matriz obligatoria):

`P` positivo mínimo · `PM` positivo máximo (todos los campos opcionales presentes, en el límite superior de cada constraint) · `N-kind` `kind` que no corresponde al spec (→ I-15) · `N-shape` forma inválida para Zod (campo requerido ausente o extra: `strictObject`) · `N-limit` valor que excede la constraint declarada · `N-null` `null` donde el esquema exige valor.

| # | `kind` | `P` mínimo | `N-limit` específico | Trampa que la prueba debe fijar |
|---|---|---|---|---|
| 1 | `text` | `{kind:"text",value:"Ana"}` | `value` de 2001 chars (`blocks.ts:8`) | `value:""` con `minLength:0` **es válido**; con `minLength:1` viola I-16 |
| 2 | `richText` | `doc` con 1 párrafo y 1 span | 41 párrafos (`RichDoc.max(40)`) | `marks:["bold","italic","bold"]` (>2, `blocks.ts:14`); `href` con `javascript:` debe fallar el patrón `HttpUrl` |
| 3 | `listText` | `{items:["a"]}` | 13 ítems (`max(12)`) | `items:[]` con `minItems:0` válido; ítem de 201 chars → I-16 |
| 4 | `image` | `{assetId:"as_<ULID>",alt:"",focal:{x:0,y:0}}` | `focal.x = 1.1` | `assetId` sin prefijo `as_`; **`alt:""` es válido** (imagen decorativa) y a11y debe tolerarlo |
| 5 | `audio` | `{assetId:"as_<ULID>"}` | — | `assetId` con ULID en minúsculas (Crockford exige mayúsculas, `common.ts:22`) |
| 6 | `date` | `{value:"2026-12-31"}` | `"2026-13-01"` | `"2026-02-30"` **pasa el regex** (`common.ts:53` no valida días por mes) — fijar que es un hueco conocido y decidir si se cierra |
| 7 | `time` | `{value:"23:59"}` | `"24:00"` | `"9:30"` (sin cero a la izquierda) debe fallar |
| 8 | `dateTimeRange` | `{start:"2026-12-31T16:00"}` | `end` anterior → I-01 | comparación de strings ISO es correcta **solo** sin zona; fijar que `start` con `Z` falla el regex |
| 9 | `link` | `{href:"https://a.mx"}` | `label` de 81 chars | `href:"javascript:alert(1)"` rechazado por `HttpUrl` (`common.ts:60`) |
| 10 | `location` | `{name:"Templo"}` | `name:""` (min 1) | `mapHref` no-http rechazado |
| 11 | `choice` | `{optionId:"cash"}` | `optionId:"CASH"` (mayúsculas: `Ident` es kebab minúscula) | `optionId` válido en forma pero ausente de `spec.options` → I-02 |
| 12 | `boolean` | `{value:true}` | `value:"true"` | — |
| 13 | `person` | `{name:"Ana"}` | `name:""` | `note` de 201 chars |
| 14 | `group` | `{items:[{itemId:ULID,values:{}}]}` | 25 ítems (`max(24)`) | `values` con clave no declarada → I-18; `itemId` duplicado → I-03; **grupo anidado dentro de `values` debe fallar** (`ScalarValue` no incluye `GroupValue`, `blocks.ts:56`) |

Prueba de exhaustividad (`block-kinds.contract.test.ts`): enumera `BlockKind.options` (14) y falla si falta un fichero de casos o si algún fichero no contiene los 6 tipos de caso. Así el catálogo no puede crecer sin pruebas.

### 5.3 "100 % de esquemas exportados": la regla mecánica

La versión previa fijaba ese 100 % sin decir cómo se comprueba. Regla concreta (`schema-coverage.contract.test.ts`):

```typescript
import * as schema from "@invitaciones/schema";
const EXPORTED = Object.entries(schema).filter(([, v]) => v instanceof z.ZodType);
// 1. Cada export Zod tiene un fichero de casos con su nombre.
// 2. Ese fichero tiene >= 1 caso "expect": "valid" y >= 1 "expect": "invalid".
// 3. Cada caso se corre contra el esquema Zod Y contra el JSON Schema emitido (Ajv 2020),
//    y ambos deben coincidir en el veredicto — si divergen, es una regla que no se exporta (ADR-005).
```
El punto 3 es el que detecta un `.refine()` colado: Zod diría inválido y el JSON Schema válido. Complementa al lint de §7, no lo reemplaza.

### 5.4 Las 10 operaciones

Un fichero `golden/operations/<op>.cases.json` por cada miembro del `discriminatedUnion` de `esquema/operations.ts:10-22` (`setBlock`, `clearBlock`, `addItem`, `removeItem`, `moveItem`, `setItemBlock`, `setSectionVisible`, `setSectionVariant`, `reorderSections`, `setTheme`). Cada uno con: forma válida; forma inválida por Zod; operación **válida en forma pero inválida contra el manifiesto** (`blockId` inexistente, `sectionKey` inexistente, `variant` no declarada, `paletteId` no declarada, `itemId` inexistente); y el resultado esperado del reductor sobre un documento base fijo. Los mismos ficheros los consume el pipeline de IA (`07 §3`).

## 6. Postgres efímero en pruebas (ADR-025 + ADR-1R-C-10)

### 6.1 El contrato: una variable de entorno, dos formas de satisfacerla

`IntegrationTestBase` **no** decide cómo arranca Postgres. Lee `TPL_TEST_JDBC_URL` / `TPL_TEST_DB_USER` / `TPL_TEST_DB_PASSWORD`; si `TPL_TEST_JDBC_URL` está definida, la usa tal cual y no arranca nada; si no, levanta el clúster efímero de §6.2. Así el código de prueba es idéntico en local, en CI y en cualquier entorno futuro con Docker, y la decisión de infraestructura no contamina las pruebas.

### 6.2 Local sin Docker: clúster efímero, con la corrección de `root` **[V]**

Docker no está disponible en este entorno (`contratos.md` §7). PostgreSQL 16.13 sí lo está. El script de la versión previa **no funciona aquí**, verificado:

```
$ /usr/lib/postgresql/16/bin/initdb -D "$PGDATA" -U postgres --auth=trust
initdb: error: cannot be run as root
initdb: hint: Please log in (using, e.g., "su") as the (unprivileged) user that will own the server process.
```

Script corregido y **ejecutado con éxito en esta ronda** (`scripts/pg-test-cluster.sh`, lo crea fase 2):

```bash
#!/usr/bin/env bash
# Arranca un clúster PostgreSQL 16 efímero para la suite de integración de templates2.
# Uso: source scripts/pg-test-cluster.sh start | stop
set -euo pipefail
PGBIN=/usr/lib/postgresql/16/bin
PGPORT="${TPL_TEST_PGPORT:-55432}"
PGDATA="${TPL_TEST_PGDATA:-/tmp/templates2-pg-$$}"

start() {
  mkdir -p "$PGDATA"
  # initdb se niega a correr como root. Si somos root, delegamos en el usuario 'postgres'.
  if [ "$(id -u)" -eq 0 ]; then RUN="su postgres -c"; chown postgres:postgres "$PGDATA"
  else RUN="bash -c"; fi
  chmod 700 "$PGDATA"
  $RUN "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust -E UTF8 --locale=C" >/dev/null
  $RUN "$PGBIN/pg_ctl -D $PGDATA -w -l $PGDATA/server.log \
        -o '-p $PGPORT -k $PGDATA -c listen_addresses=127.0.0.1 \
            -c fsync=off -c full_page_writes=off -c synchronous_commit=off'  start"
  "$PGBIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U postgres templates2_test
  export TPL_TEST_JDBC_URL="jdbc:postgresql://127.0.0.1:$PGPORT/templates2_test"
  export TPL_TEST_DB_USER=postgres TPL_TEST_DB_PASSWORD=
}
stop() {
  if [ "$(id -u)" -eq 0 ]; then su postgres -c "$PGBIN/pg_ctl -D $PGDATA -m immediate -w stop" || true
  else "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate -w stop || true; fi
  rm -rf "$PGDATA"
}
case "${1:-start}" in start) start;; stop) stop;; *) echo "uso: $0 start|stop" >&2; exit 2;; esac
```

Salida real de la comprobación de que los operadores JSONB funcionan de verdad **[V]**:
```
CREATE TABLE
INSERT 0 1
 v | contains
---+----------
 1 | t
PostgreSQL 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1) on x86_64-pc-linux-gnu …
waiting for server to shut down.... done · server stopped
```
`fsync=off`/`synchronous_commit=off` son seguros y deseables aquí: el clúster se borra al terminar. `--locale=C` hace determinista el `ORDER BY` sobre texto entre máquinas.

**Ciclo de vida en JUnit5:** un `@BeforeAll` a nivel de **suite**, no de clase, vía `@TestInstance(PER_CLASS)` sobre una clase base con un `static` guardado en `ExtensionContext.Store` de raíz, o —preferido por simplicidad— un `TestExecutionListener` registrado en `META-INF/services/org.junit.platform.launcher.TestExecutionListener` que arranca en `testPlanExecutionStarted` y para en `testPlanExecutionFinished`. Un solo arranque por corrida de Gradle. Flyway aplica `V29`-`V36` (más las de fase 2) contra ese clúster antes del primer test; entre clases de prueba se hace `TRUNCATE ... RESTART IDENTITY CASCADE` de las tablas `tpl_*`, nunca se recrea el esquema.

**H2 queda descartado**, sin excepción: no soporta `@>` ni `->>` sobre JSONB, que es exactamente lo que hay que probar (`02 §2.2`, filtro de catálogo por `event_kinds`), ni los índices `GIN`, ni `INSERT … ON CONFLICT … DO UPDATE` con la semántica de `02 §2.4`/`05 §7.1`.

### 6.3 En GitHub Actions: `services: postgres` (decisión)

El runner `ubuntu-latest` **sí** tiene Docker, así que `services:` funciona; y corre como usuario no privilegiado, así que el script de §6.2 también funcionaría. **Se elige `services: postgres`** para CI por tres razones: (1) el runner lo arranca antes del primer paso y lo cuida con `--health-cmd`, sin código propio que mantener; (2) fija la versión de imagen (`postgres:16`) de forma reproducible, mientras que el binario preinstalado del runner puede cambiar entre imágenes; (3) no depende de que la imagen del runner traiga los binarios de Postgres, que es una promesa que GitHub puede retirar. El script de §6.2 sigue siendo el camino **primario en local** y el de respaldo si un día el runner pierde Docker — y como el contrato es la variable de entorno (§6.1), cambiar de uno a otro no toca ni una línea de prueba.

**Testcontainers queda descartado** para este proyecto: exige Docker en el punto donde hoy no lo hay (local) y no aporta nada donde sí lo hay (CI, donde `services:` ya lo cubre).

## 7. Lint de esquema (ADR-005)

Regla ESLint (`packages/schema/eslint.config.js`) con `no-restricted-syntax`:

```javascript
{
  files: ["src/**/*.ts"],
  rules: { "no-restricted-syntax": ["error",
    { selector: "CallExpression[callee.property.name='refine']",
      message: "ADR-005: .refine() se descarta en silencio al emitir JSON Schema. Usa invariants.ts." },
    { selector: "CallExpression[callee.property.name='superRefine']", message: "ADR-005: idem." },
    { selector: "CallExpression[callee.property.name='transform']", message: "ADR-005: idem." },
    { selector: "CallExpression[callee.property.name='catch']", message: "ADR-005: .catch() enmascara errores de validación." },
    { selector: "CallExpression[callee.object.name='z'][callee.property.name='any']",
      message: "ADR-005/P1: z.any() acepta cualquier cosa y no genera esquema útil." },
  ] },
}
```
Las dos últimas reglas son adición de esta ronda: `.catch()` convierte un valor inválido en el default sin avisar (mismo defecto que P1 prohíbe), y `z.any()` aparecía una vez en el árbol (`esquema/composed.ts`, `richText: z.any()`). **Al cerrar esta ronda, `1R-dominio` ya lo había retirado** **[V]**, de modo que la regla se aplica a todo `src/**` sin excepciones y **CD-5 queda resuelto**. Si en el futuro alguien necesita `z.any()` en un esquema que no se exporta a JSON Schema, la excepción se declara con `eslint-disable-next-line` y un comentario que diga por qué — nunca ampliando el `files` de la regla.

## 8. Escenarios e2e y política anti-flake (ADR-1R-C-11)

### 8.1 Los seis escenarios, con nombre de fichero

| id | Fichero | Escenario | Criterio de aceptación |
|---|---|---|---|
| **E2E-01** | `e2e/flujo-principal.spec.ts` | Elegir plantilla → editar título de portada y subir una foto → publicar → abrir `/i/{publicToken}` en contexto anónimo | El texto y la foto editados aparecen en el render público; el render no carga JS de editor |
| **E2E-02** | `e2e/deshacer.spec.ts` | Editar tres bloques, `Ctrl+Z` dos veces, recargar la página | Tras recargar, el documento del servidor coincide con el estado tras los dos deshacer (ADR-019 + `03 §4`) |
| **E2E-03** | `e2e/estructura.spec.ts` | Ocultar una sección opcional, reordenar dos secciones con `dnd-kit`, cambiar `variant` | El lienzo refleja los tres cambios; una sección `required` no ofrece el switch de ocultar (I-17) |
| **E2E-04** | `e2e/preflight-y-demo.spec.ts` | Publicar sin tocar nada | El preflight bloquea por `report.stillDefault` en bloques obligatorios; el botón "Publicar" queda deshabilitado con el motivo visible (cierra H-03 en el producto, no solo en el dato) |
| **E2E-05** | `e2e/conflicto-revision.spec.ts` | Dos pestañas sobre la misma invitación, la segunda guarda con `baseRevision` viejo | `409 TPL_REVISION_CONFLICT` y la UI ofrece recargar sin perder el borrador local (`03 §3.3`) |
| **E2E-06** | `e2e/a11y.spec.ts` | `@axe-core/playwright` sobre `/i/{token}` de `boda-clasica` y `xv-jardin`, y sobre el chrome del editor | 0 violaciones `critical`/`serious` |

E2E-01 a E2E-03 son los que ADR-024 exige "en verde antes de cualquier PR de fase 3". E2E-04 y E2E-05 son adición de esta ronda: cubren los dos hallazgos de mayor consecuencia (H-03 y la concurrencia de H-44/`revision`) en el único sitio donde son observables, que es el flujo completo.

### 8.2 Política anti-flake

1. **`retries: 0` en local, `retries: 1` en CI** (`playwright.config.ts`: `retries: process.env.CI ? 1 : 0`). Un solo reintento, y **solo** para absorber arranques lentos del servidor; una prueba que pasa en el reintento se reporta como `flaky` y **el job falla igual** si `flaky > 0` en `main`/rama de trabajo (`--fail-on-flaky-tests`, disponible desde Playwright 1.45).
2. **Prohibido `page.waitForTimeout`** — regla ESLint `no-restricted-syntax` sobre `CallExpression[callee.property.name='waitForTimeout']` en `e2e/**`. Se espera por estado observable: `expect(locator).toBeVisible()`, `page.waitForResponse(/\/document\/operations$/)`, `expect.poll`.
3. **Selección por rol y nombre accesible** (`getByRole`, `getByLabel`), nunca por clase CSS ni por `nth-child`: un cambio de estilo no debe romper un e2e (y de paso alimenta E2E-06).
4. **Aislamiento de datos**: cada prueba crea **su propia** invitación vía un endpoint de fixture (`POST /test/fixtures/invitation`, activo solo con el perfil `test`) y la borra en `afterEach`. Prohibido compartir una invitación entre pruebas o depender del orden. `fullyParallel: true` con `workers: 4` en CI; si una prueba solo pasa con `workers: 1`, es un fallo de aislamiento, no una excepción a conceder.
5. **Reloj y aleatoriedad fijos**: `page.clock.install({ time: FIXED_DATE })` antes de cada navegación, y `--seed` fijo para cualquier generador. La composición ya es determinista (R6), pero la UI no lo es (relativos "hace 2 minutos", countdown).
6. **Cuarentena prohibida sin issue**. `test.skip`/`test.fixme` solo se acepta con un comentario en la línea anterior con la forma `// QUARANTINE: <url del issue> · <fecha límite>`, y una prueba de lint (`quarantine.test.ts`) falla si hay un `skip` sin ese comentario o con fecha límite pasada. Nunca se desactiva una prueba "temporalmente" sin rastro.
7. **Traza siempre en el primer reintento** (`trace: "on-first-retry"`, `video: "retain-on-failure"`), subida como artefacto (§9) — un flake sin traza no se puede diagnosticar y se repite.
8. **Presupuesto de tiempo**: `timeout: 30_000` por prueba, `expect.timeout: 5_000`. Una prueba que necesita más está probando demasiado y se parte.

## 9. CI completo (ADR-026 + ADR-1R-C-12)

No existe `.github/workflows` hoy (`handoffs/0-inventario.md` §5). **Este bloque es el contenido del fichero que crea la fase 2**; este documento no lo materializa.

```yaml
# .github/workflows/templates2-ci.yml — lo crea la fase 2, tal cual.
name: templates2-ci

on:
  pull_request:
    branches: [claude/agent-network-invitation-41nx5y, main]
  push:
    branches: [claude/agent-network-invitation-41nx5y]

concurrency:
  group: templates2-ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  JAVA_VERSION: "21"          # toolchain 21: el 17 del build.gradle.kts no compila hoy (handoffs/0-build-jdk.md)
  NODE_VERSION: "22.22.0"
  PNPM_VERSION: "10.33.0"

jobs:
  backend:
    name: backend (JDK 21 + Postgres 16)
    runs-on: ubuntu-latest
    timeout-minutes: 25
    services:
      postgres:                                  # 06 §6.3: el runner tiene Docker; en local se usa pg-test-cluster.sh
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: templates2_test
        ports: ["55432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4

      - name: JDK 21
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: ${{ env.JAVA_VERSION }}

      - name: Gradle con caché
        uses: gradle/actions/setup-gradle@v4
        with:
          cache-read-only: ${{ github.event_name == 'pull_request' }}

      - run: chmod +x gradlew

      - name: Pruebas + cobertura (06 §2.1)
        run: ./gradlew --no-daemon test jacocoTestReport jacocoTestCoverageVerification
        env:
          TPL_TEST_JDBC_URL: jdbc:postgresql://127.0.0.1:55432/templates2_test
          TPL_TEST_DB_USER: postgres
          TPL_TEST_DB_PASSWORD: postgres

      - name: Informes
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: backend-reports
          path: |
            build/reports/tests/test/**
            build/reports/jacoco/test/**
          retention-days: 7

  frontend:
    name: frontend (Node 22 + pnpm)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - name: Deriva del JSON Schema (ADR-004)
        run: |
          pnpm --filter @invitaciones/schema schema:emit
          git diff --exit-code -- packages/schema/dist

      - name: Lint (incluye la regla de ADR-005, 06 §7)
        run: pnpm -r lint

      - name: Tipos
        run: pnpm -r typecheck

      - name: Pruebas + cobertura (06 §2.2)
        run: pnpm -r exec vitest run --coverage

      - name: Inventario de golden files (06 §3)
        run: pnpm --filter @invitaciones/schema exec vitest run golden-inventory

      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage
          path: frontend/**/coverage/**
          retention-days: 7

  e2e:
    name: e2e (Playwright/Chromium)
    needs: [backend, frontend]
    runs-on: ubuntu-latest
    timeout-minutes: 30
    defaults:
      run:
        working-directory: frontend
    env:
      # En el runner NO existe /opt/pw-browsers: los navegadores se instalan y se cachean aquí.
      # En el entorno local de desarrollo esta variable ya apunta a /opt/pw-browsers y NO
      # debe ejecutarse `playwright install` (contratos.md §7).
      PLAYWRIGHT_BROWSERS_PATH: ${{ github.workspace }}/.pw-browsers
      CI: "true"
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: templates2_e2e
        ports: ["55432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: ${{ env.JAVA_VERSION }}

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - name: Caché de navegadores
        id: pw-cache
        uses: actions/cache@v4
        with:
          path: ${{ env.PLAYWRIGHT_BROWSERS_PATH }}
          key: pw-${{ runner.os }}-${{ hashFiles('frontend/pnpm-lock.yaml') }}

      - name: Instalar Chromium
        if: steps.pw-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install --with-deps chromium

      - name: Dependencias del sistema para Chromium (cuando el navegador vino de caché)
        if: steps.pw-cache.outputs.cache-hit == 'true'
        run: pnpm exec playwright install-deps chromium

      - name: Backend en segundo plano (perfil test)
        working-directory: .
        run: |
          chmod +x gradlew
          ./gradlew --no-daemon bootRun --args='--spring.profiles.active=test' &
          for i in $(seq 1 60); do
            curl -sf http://127.0.0.1:8080/actuator/health && break || sleep 5;
          done
        env:
          TPL_TEST_JDBC_URL: jdbc:postgresql://127.0.0.1:55432/templates2_e2e
          TPL_TEST_DB_USER: postgres
          TPL_TEST_DB_PASSWORD: postgres

      # El servidor web del frontend lo arranca Playwright (`webServer` de playwright.config.ts),
      # NO un `&` suelto en este paso: un proceso lanzado con `&` en un step muere al terminarlo.
      - name: e2e + a11y
        run: pnpm --filter web exec playwright test --fail-on-flaky-tests

      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            frontend/apps/web/playwright-report/**
            frontend/apps/web/test-results/**
          retention-days: 7
```

Con, en el frontend:

```typescript
// frontend/apps/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry", video: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {                       // arranque y espera gestionados por Playwright (06 §8.2 punto 1)
    command: "pnpm --filter web build && pnpm --filter web start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

Los tres jobs son obligatorios para mergear (ADR-026). `backend` y `frontend` corren en paralelo; `e2e` espera a ambos.

## 10. Qué se prueba primero (orden de escritura en fase 2)

Por severidad de consecuencia silenciosa, siguiendo `handoffs/0-resumen-auditoria-pruebas.md`:

1. Tabla de invariantes I-01…I-29 en ambos lados (§4) — sin ella, ADR-005 es una promesa.
2. Golden de composición de los 2 ejemplos (§3) — fija R1-R9 antes de tocar el motor.
3. Matriz de los 14 tipos de bloque (§5.2).
4. Casos de las 10 operaciones + reductor (§5.4).
5. Contrato de API por código `TPL_*` (`03 §5`), con Postgres real.
6. Golden de migración de versión.
7. E2E-01…E2E-06.

## 11. Lo que no pude determinar

- **[ND]** Si el runner de GitHub Actions de **este** repositorio concreto tiene Docker (se asume que sí por ser `ubuntu-latest` estándar). El diseño no depende de la respuesta: §6.1 hace que el contrato sea la variable de entorno.
- **[ND]** Cobertura real de partida: 0 % (H-19, `src/test` no existe **[V]**). No cambia el umbral objetivo.
- **[ND]** Si el proyecto tiene `actuator` habilitado para el `curl` de salud del job `e2e`; si no lo tiene, fase 2 sustituye ese sondeo por `GET /public/i/__healthcheck__/exists` o el que exista. Registrado en `preguntas-abiertas.md`.

---

## 12. Revisión independiente (1R-calidad)

Ronda 1R, 2026-09-03. Revisor: `1R-calidad`. Método: relectura adversarial contra `esquema/*.ts` y `build.gradle.kts`, con **ejecución real** de Kover, JaCoCo, Vitest y del clúster Postgres efímero en `scratchpad/1R-calidad/`.

| id | Sev. | Objeción | Evidencia | Corrección aplicada | Estado |
|---|---|---|---|---|---|
| **Q-01** | **Alta** | El `ci.yml` propuesto no funcionaría: `pnpm --filter web start &` muere al acabar el step, `e2e` no define `PLAYWRIGHT_BROWSERS_PATH` ni instala navegadores, ningún job arranca Postgres (el `apt-get install postgresql-16` no lo inicia y falta `apt-get update`), no hay `working-directory: frontend`, ni `setup-node`, ni caché, ni artefactos | texto original `06:102-134` | §9: workflow completo y ejecutable, con `services: postgres`, caché de pnpm/Gradle/navegadores, `webServer` de Playwright, artefactos y `timeout-minutes` | corregido |
| **Q-02** | **Alta** | Los umbrales de ADR-024 no eran verificables: `jacocoTestCoverageVerification` sin ninguna configuración, y `08 §2` mencionaba Kover como alternativa. **Kover 0.9.1 no admite umbrales por paquete** | `javap KoverVerifyRule` (sin `filters`); error de compilación del script; ejecución de JaCoCo con dos reglas y dos umbrales, `EXIT=1` | §2.1: JaCoCo 0.8.12 elegido con evidencia, configuración Gradle completa, comando que falla la build (ADR-1R-C-08) | corregido |
| **Q-03** | **Alta** | El script de `initdb`/`pg_ctl` de §6 **no funciona en este entorno**: `initdb: error: cannot be run as root` | ejecución propia | §6.2: script corregido con delegación en el usuario `postgres`, ejecutado con éxito (salida literal incluida) — ADR-1R-C-10 | corregido |
| **Q-04** | **Alta** | §4 hablaba de "las 21 invariantes I-01…I-21"; al empezar la revisión el catálogo tenía **23** (ADR-034) y al cerrarla **29** (`1R-dominio` añadió I-24…I-29 en paralelo), y ninguna estaba enumerada con sus casos | `esquema/invariants.ts` `InvariantCode`; `contratos.md` §3 | §4: las **29** enumeradas con caso que viola, caso que no y caso extra; formato de fichero fijado; §4.2 prueba de exhaustividad para que la próxima ampliación no vuelva a pasar desapercibida | corregido |
| **Q-05** | **Alta** | 6 restricciones declaradas en `blocks.ts` no las verificaba ninguna invariante: es el defecto que ADR-005 quiso eliminar, en otro sitio. `1R-dominio` cerró `richText.maxLength` durante la ronda; **quedan 5** (`text.pattern`, `text.multiline`, `image.aspect`, `image.maxBytes`, `audio.maxBytes`) | `esquema/invariants.ts` (switch de 6 casos) vs `blocks.ts` | §4.1: tabla del hueco + prueba `invariant-gaps.contract.test.ts` que lo hace fallar en vez de silenciarlo. **No se corrige el esquema aquí** (otro bloque): contradicción a dirimir CD-4, ya reducida | registrado |
| **Q-06** | **Alta** | No había casos de contrato por tipo de bloque (14) ni por operación (10); "100 % de esquemas exportados" no era mecánicamente comprobable | brief 1R; `blocks.ts:74-77`, `operations.ts:10-22` | §5.2 (matriz de 6 casos × 14 tipos, con la trampa concreta de cada uno), §5.3 (regla mecánica de 3 puntos), §5.4 (10 operaciones) | corregido |
| **Q-07** | Media | Golden files en **dos** rutas con "symlink o copia" — el mecanismo por el que dos representaciones divergen (H-35) | texto original `06:25`,`06:44` | §3: ruta única `frontend/packages/schema/golden/**`, leída por Gradle con `sourceSets.test.resources.srcDir(...)` y por TS con `import.meta.url`; prueba de inventario contra la deriva (ADR-1R-C-09) | corregido |
| **Q-08** | Media | Umbral TS solo de líneas. Verificado que con el provider `v8` una función de una sola sentencia nunca llamada puede reportar `Lines 100 %` y solo `Functions 50 %` | ejecución propia de `vitest@3.2.7` | §2.2: umbral obligatorio de `functions` además de `lines`, `branches` y `statements` | corregido |
| **Q-09** | Media | No había escenarios e2e nombrados ni política anti-flake | brief 1R | §8.1 (6 escenarios con fichero y criterio) y §8.2 (8 reglas, con cuarentena prohibida sin issue y fecha límite) — ADR-1R-C-11 | corregido |
| **Q-10** | Media | La decisión "Testcontainers si el runner tiene Docker" dejaba dos caminos vivos y ninguna forma de que el código de prueba fuera el mismo | `06 §6` original | §6.1: contrato por variable de entorno; §6.3: `services: postgres` en CI, clúster efímero en local, Testcontainers descartado | corregido |
| **Q-11** | Baja | El lint de ADR-005 no cubría `.catch()` ni `z.any()`, y `z.any()` aparecía en `composed.ts` | `esquema/composed.ts:32` (estado al empezar la ronda) | §7: dos reglas nuevas. `1R-dominio` retiró el `z.any()` durante esta misma ronda, así que **CD-5 queda resuelto** y la regla de lint puede aplicarse sin excepciones | corregido |
| **Q-12** | Baja | El job `backend` medía cobertura sobre todo el proyecto, donde el módulo antiguo sin pruebas hace inalcanzable el 80 % | H-19 | §2.1: `classDirectories` filtrado a `templates2/**` | corregido |

**Contradicciones a dirimir:** **CD-4** (`validateValueAgainstSpec` no cubre 5 constraints de `blocks.ts`: `text.pattern`, `text.multiline`, `image.aspect`, `image.maxBytes`, `audio.maxBytes`). **CD-5 resuelto** durante la ronda por `1R-dominio` (retirado el `z.any()` de `composed.ts`). Ver `handoffs/1R-calidad.md`.
