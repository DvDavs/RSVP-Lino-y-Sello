# Bitácora 2-0a-REV — revisión Opus adversarial del bloque 0a de la fase 2

Fecha: 2026-09-04 · Rama: `claude/fase-2-backend-orchestration-ksyuzi` · Revisor: 2-0a-REV (Opus).
Sin commits, sin push, sin cambio de rama. No se tocó `src/main/kotlin/**`, `application*.yml`,
`settings.gradle.kts` ni el módulo antiguo.

Regla que motiva esta revisión: prompt maestro §5 / `brief-comun.md` — *todo entregable Sonnet que
toque esquema, composición, migración, persistencia o seguridad pasa por un revisor Opus antes de
integrarse*. 0a tocó esquema y composición.

Marcas: **[V]** verificado ejecutándolo aquí · **[I]** inferido · **[ND]** no determinable.

---

## 0. Veredicto

**INTEGRABLE CON RESERVAS.**

Lo entregado es correcto en lo que afirma: no encontré ningún golden que mienta sobre lo que su
código produce, ninguna versión con rango abierto, ningún caso inventado a mano. La calidad de
`golden/invariants/` es alta: los 30 ficheros siguen la tabla de `06 §4` caso por caso, incluidos los
"extras" adversariales, y son **autodescriptivos y ejecutables desde Kotlin sin conocer TypeScript**
(cada caso lleva su `spec`/`manifest`/`theme`/`defaults`/`doc` completos en línea). `I-29` corre
sobre el JSON crudo, como manda `contratos §3` [V].

Las reservas son **dos huecos de paridad TS↔Kotlin que ninguna prueba actual puede detectar** (O-01,
O-02) y que son baratos de cerrar, pero que hay que cerrar **antes** de aceptar `Invariants.kt` /
`Composer.kt` de 2-0b, no después. No bloquean el *merge* de 2-0a —nada de lo entregado es
incorrecto— pero sí deben convertirse en criterio de aceptación explícito de 2-0b.

---

## 1. Tabla de objeciones

| id | grav. | evidencia | qué hay que hacer |
|---|---|---|---|
| **O-01** | **ALTA** | `frontend/packages/schema/golden/operations/*.cases.json` (campo `expectManifestError`) + `frontend/packages/schema/scripts/gen-golden-operations.ts:33-40,53-94` + `frontend/packages/schema/test/operations.contract.test.ts:32-34` | `expectManifestError` se calculó contra un `manifestFixture(...)`/`themeFixture()` y un `KNOWN_ITEM_ID` que **viven solo en el script generador y en `scripts/fixtures.ts`, y no se emiten a `golden/`**. Kotlin no puede usar el campo: no tiene contra qué validar. TypeScript tampoco lo comprueba: el runner solo hace `Operation.safeParse`. Es un campo contractual que **no verifica nadie en ninguno de los dos lados** y que obliga al lector Kotlin a reimplementar `fixtures.ts` — el fallo grave que el criterio de revisión nombra. **Remedio:** emitir el fixture base (manifiesto + tema + documento base + `assetMeta`) como dato dentro de `golden/` y hacer que el runner de ambos lados lo consuma. |
| **O-02** | **ALTA** | `frontend/packages/schema/src/blocks.ts:165-236` y `src/manifest.ts:18,19,72,74,77,79` (28 `.default()`) · `src/document.ts:36` (`attic`) · `src/composed.ts:19` (`timezone`) · `src/invariants.ts:120` (I-22) · `scripts/fixtures.ts:33-40` · `scripts/gen-golden-templates.ts:76,102` | **Ningún golden cubre la normalización de los `.default()` de Zod, y es una divergencia P1 en vivo.** Verificado [V]: `golden/templates/*/template.json` **no** es una copia del ejemplo, es la salida de `TemplateManifest.parse(...)` — Zod inyecta `itemBlocks[].source`, `.editable`, `.aiEditable`, ausentes en `diseno/ejemplos/*/template.json`. El JSON Schema emitido (`io:"input"`) marca esos campos **opcionales** (`required` de `InvitationDocument` no incluye `attic`; el de `BusinessSnapshot` no incluye `timezone` [V]), así que un manifiesto crudo válido llega a `Invariants.kt` **sin `source`**, e `I-22` (`ib.source !== "user"`) violaría sobre un manifiesto que TypeScript acepta. Todos los `spec` de `golden/invariants/` y `golden/blocks/` vienen de `fixtures.ts`, que rellena **todos** los defaults explícitamente: un `Invariants.kt` escrito contra estos golden pasa al 100 % y diverge igualmente. **Remedio:** un golden de normalización (par crudo → normalizado) por cada esquema con `.default()`, o como mínimo `template.raw.json` junto a `template.json` y una prueba Kotlin `normalize(raw) == template.json`. |
| **O-03** | MEDIA | `frontend/packages/schema/test/invariant-gaps.contract.test.ts` (versión de 2-0a, líneas 119-136) | La prueba que sostiene el "0 huecos" de `06 §4.1` **no podía fallar**: 3 de sus 6 comprobaciones eran `check: raw => raw.length > 0` (un JSON no vacío) y otras 2 casaban una subcadena que aparece en el *nombre* de un caso (`"reductor"`, `"focal"`). `image.cases.json` ni siquiera contiene la palabra "reductor" [V]. **CORREGIDO** (ver §2). |
| **O-04** | MEDIA | `.github/workflows/ci.yml` (job `frontend`, versión de 2-0a) + `frontend/packages/schema/golden/README.md` | ADR-1R-D-09 ("golden generados, nunca a mano") **no tenía ninguna compuerta mecánica**: el CI comprobaba deriva de `json-schema/` pero no de `golden/`. Un golden editado a mano pasaba verde. **CORREGIDO** (ver §2). |
| **O-05** | MEDIA | `.github/workflows/ci.yml:33-37` (versión de 2-0a) vs `06 §9` y la nota 2 de su propia cabecera | `on.pull_request.branches` pasó de `[claude/agent-network-invitation-41nx5y, main]` a `[main]`: un PR contra la rama contractual de trabajo (`contratos §1`) **no habría disparado CI**. La cabecera dice que se *añaden* ramas; el YAML las quitó del disparador de PR. **CORREGIDO** (ver §2). |
| **O-06** | MEDIA | `frontend/packages/schema/scripts/gen-golden-templates.ts:22` y `test/compose.templates.test.ts:101` vs `docs/rediseno-plantillas/diseno/02-persistencia-y-catalogo.md:654-657` (§10.4) | La regla `url = cdn + assetId.slice(3) + ".webp"` **es una inferencia legítima** (reproduce byte a byte los dos `compuesto.json` de la ronda 1R [V]), pero **contradice la regla de producción**: `AssetUrlResolver` construye `"{templates2.assets.public-base-url}/{s3_key}"` a partir de la columna `s3_key` de `tpl_asset`, es decir, de un dato almacenado, no del `assetId`. El riesgo real es que 2-0b, al no poder reproducir `compuesto.json` con la regla de producción, lleve la convención de fixture a `AssetUrlResolver` y rompa todo asset cuya clave S3 no sea `<ULID>.webp`. Además la regla vive solo en un `.ts`: no es dato del golden. **Mitigado** con un aviso explícito en `golden/README.md` (§2); **remedio real pendiente**: emitir `golden/templates/<dir>/assets.json`. |
| **O-07** | MEDIA | `frontend/packages/schema/scripts/gen-golden-templates.ts:85-105` (versión de 2-0a) y `scripts/gen-golden.ts:6-7` | El generador de plantillas **escribía los 7 golden antes de comparar** con `diseno/ejemplos/` y, si no coincidían, solo imprimía `AVISO: no coincide` y salía con 0 — al revés de lo que afirman `golden/README.md` ("**lanza** si el resultado declarado no coincide") y `bitacora/2-0a.md §2.3`. Una regresión de `compose()` habría **reescrito el golden con la salida errónea**, y `compose.templates.test.ts` habría seguido en verde comparándose consigo mismo. **CORREGIDO** (ver §2). |
| **O-08** | MEDIA | `scripts/pg-ephemeral.sh` (versión de 2-0a, `is_running()` líneas 54-59 y `start()` líneas 69-73) | Fallo en el **segundo uso** tras una caída sin `stop`: `is_running()` hace `. "$STATE_FILE"` **en el ámbito del llamador**; si el estado está obsoleto devuelve 1 pero deja `TPL_TEST_PGPORT`/`TPL_TEST_PGDATA` muertos exportados, y `start()` los reutiliza (`${TPL_TEST_PGPORT:-$(free_port)}`). Reproducido [V] con el script original: `initdb: error: directory "…/data-STALE" exists but is not empty`. Además el PGDATA huérfano nunca se limpiaba. **CORREGIDO** (ver §2). |
| **O-09** | MEDIA | `scripts/pg-ephemeral.sh:36-37` (`STATE_FILE` único) vs `ADR-2-0a-05` ("puerto fijo colisionaría si dos ejecuciones corren en paralelo") | El puerto aleatorio se justifica por la concurrencia, pero el **fichero de estado es uno solo** por `STATE_DIR`: dos suites simultáneas con el `STATE_DIR` por defecto **comparten clúster**, y el primer `stop` mata el que la segunda sigue usando. La justificación de la ADR no se cumple con la implementación. **Documentado** en la cabecera del script (`TPL_TEST_STATE_DIR` por instancia); la ADR debe recogerlo. |
| **O-10** | MEDIA | informe de cobertura `compose.ts` 78,87 % ramas; `frontend/packages/schema/coverage/lcov.info` (BRDA con `taken=0` en líneas 20, 24, 28, 35-37, 48, 49, 56, 57, 58, 59, 63, 66, 67, 68, 69, 70, 76, 77, 79, 81, 82, **95, 97, 98**, **106, 107, 109**) | Las ramas descubiertas **no son irrelevantes: son reglas de composición sin probar**. (a) **R8 completa**: `compose.ts:95,97,98` — el fallback de paleta/fontSet y `report.themeFallback` no se ejercitan **nunca**; `themeFallback` es `null` en los dos golden. (b) **R1**: `:106` `orphanSections`, `:107` clave duplicada, `:109` variante desconocida → `defaultVariant`. Ninguna probada. (c) `:49,56,57` asset ausente del `AssetIndex` → `null` → `provenance:"empty"`. (d) 3 de los 6 `businessField` (`invitation.time`, `coverPhotoUrl`, `youngAllowed`) y el caso `date === null` nunca se componen. (e) 3 de los 5 `formatId` (`h12`, `iso`, desconocido) y la medianoche de `fH12` (`H % 12 === 0`) sin probar. (f) `es-ES`/`en-US` sin probar: los dos ejemplos declaran `locales:["es-MX"]` [V]. (g) `resolveScalar` nunca resuelve `audio`, `time` ni `boolean` de usuario. **Y lo importante:** `test/compose.branches.test.ts` y `test/invariants.branches.test.ts` suben la cobertura al 88,04 %, pero son pruebas **TS-only, no golden**: no cruzan a Kotlin. La cobertura de rama que supera el umbral **no es cobertura de paridad**. |
| **O-11** | MEDIA | `docs/rediseno-plantillas/diseno/06-pruebas-y-calidad.md` §4 ("`expect` … la comparación ignora `detail` y compara `code` **+ `path`**") vs `frontend/packages/schema/test/invariants.contract.test.ts:12` y `golden/README.md` | El `expect` entregado es solo una lista de códigos; el `path` se descarta en los dos lados. Un `Invariants.kt` que emita los códigos correctos con rutas equivocadas pasa todos los golden. Desviación **no registrada** como ADR ni como pregunta abierta. |
| **O-12** | MEDIA | `frontend/packages/schema/src/composed.ts:99` vs `src/compose.ts:89` (única aparición de `invalidValues`) y `src/compose.ts:37` | `CompositionReport.invalidValues` está declarado en el esquema y **`compose()` no lo puebla jamás**: un valor presente pero inválido para su spec se renderiza sin dejar rastro. Igual `formatDate`: `default: return fLong(...)` con el comentario "(y se registra fuera)" que **nadie cumple**. Defecto heredado de la fase 1, pero los golden ahora **lo congelan** (`"invalidValues": []` en los dos `reporte.json`), así que `Composer.kt` se escribirá para reproducir el mismo silencio: TS y Kotlin coincidirán en un comportamiento que viola P1. |
| **O-13** | MEDIA | `docs/rediseno-plantillas/memoria/contratos.md:18,21,24,31` y ~97 referencias en `diseno/01..09` | Los 10 `.ts` de `diseno/esquema/` se **borraron**. `contratos.md` —que manda sobre todo lo demás— sigue nombrando `esquema/blocks.ts` como "fuente normativa de los roles", `esquema/operations.ts` y `esquema/composed.ts`. El README de redirección mitiga para un humano, pero solo el orquestador puede editar `contratos.md`: **acción de integración pendiente**. |
| **O-14** | MEDIA | `.github/workflows/ci.yml:83-88` (job `backend`) y `:148` (`if: false`) vs `ADR-026`/`ADR-1R-C-12` ("los tres jobs son obligatorios para mergear") | Con `backend` fallando por diseño hasta que 2-0b añada JaCoCo, y `e2e` desactivado, el CI queda con **1 de 3 jobs verde** durante toda la ventana 2-0a→2-0b. Un CI permanentemente rojo enseña a ignorar el CI. La ADR-2-0a-04 solo cubre `e2e`. Recomendación: integrar 2-0a y 2-0b en el mismo cambio, o partir el paso Gradle (`test` ahora, `jacoco*` cuando exista). Decisión del orquestador. |
| **O-15** | BAJA | `golden/invariants/I-14-section-key-duplicate.json` (2 casos), `I-19-structure-key-unknown.json` (2 casos) | `contratos §6` exige "caso que viola, caso que no y caso extra" para las 30; `06 §4` marca "—" en el extra de I-14 e I-19. Manda `contratos.md`. Faltan 2 casos extra. No corregido para no alterar los recuentos ya publicados (102 casos) sin ADR. |
| **O-16** | BAJA | `frontend/packages/schema/json-schema/templates2.schema.json` — los **15** `$defs` llevan `"$schema"` anidado [V] | Draft 2020-12 §8.1.1 restringe `$schema` a la raíz de un recurso de esquema; una subesquema sin `$id` no lo es. `ajv@8.20.0` lo acepta incluso con `strict:true` [V], así que no es un problema de ajv; el comportamiento de `com.networknt:json-schema-validator:1.5.4` es **[ND]** y `contratos §7` ya lo marca como lo primero que debe comprobar la fase 2. Si diera guerra, la corrección es una línea en `emit-json-schema.ts` (borrar `$schema` de cada `def`, igual que ya se borra el `$id`). |
| **O-17** | BAJA | `frontend/packages/schema/golden/README.md:19,23` (versión de 2-0a) | Decía "Seis ficheros por carpeta" con 7 filas en la tabla, y describía `template.json` como "copiado del ejemplo" cuando es la salida de `parse` (ver O-02). **CORREGIDO** (ver §2). |
| **O-18** | BAJA | `contratos §2` ("pnpm 10.x + turbo") vs `frontend/package.json` | No hay `turbo`. Irrelevante con un solo paquete; anotarlo para la fase 3. |
| **O-19** | BAJA | `.github/workflows/ci.yml`, paso "Deriva del JSON Schema" | `git diff --exit-code` no ve ficheros **nuevos sin versionar**: si el emisor generase un puntero más, el paso pasaría en verde. El paso de golden que añadí sí lo comprueba (`git ls-files --others`); conviene replicarlo en el de `json-schema/`. |
| **O-20** | BAJA | `frontend/packages/schema/test/schema-coverage.contract.test.ts:34` (`new Ajv2020({ strict: false })`) | Con `strict:false` se pierden los avisos de higiene del esquema (es lo que oculta O-16). Con `strict:true` el bundle también compila [V]: se puede subir sin coste. El alcance de 15 de ~70 exports ya está registrado como pregunta abierta y me parece **correcto**: son los que de verdad cruzan a Kotlin. |

### Lo que verifiqué y está bien (no es objeción)

- **Bundle** [V]: 15 `$defs`, **42** `$ref`, 218 900 bytes, un solo `$id` absoluto
  (`https://invitaciones.evolutiondev.mx/schema/templates2.schema.json`), 10 punteros que lo
  referencian por ese `$id`. Cumple ADR-1R-D-08. Es **preinstalable por `$id`** sin salir a la red
  (`contratos §5`, dirimida X-11): los `$ref` internos son relativos (`#/$defs/...`) y los de los
  punteros son absolutos contra ese mismo `$id`.
- **Versiones** [V]: `typescript@5.9.3`, `zod@4.5.4`, `vitest@3.2.4`, `@vitest/coverage-v8@3.2.4`,
  `tsx@4.23.13`, `@types/node@22.20.1`, `ajv@8.20.0`. Sin `^`/`~` ni en `package.json` ni en
  `pnpm-lock.yaml` (`specifier:` == `version:` en las 7). Exactamente `contratos §2/§8`.
- **`golden/invariants/`** [V]: 30 ficheros `I-01`…`I-30`, sin huecos ni duplicados (comprobado
  contra `InvariantCode`), 102 casos, cada fichero con caso que viola y caso que no; los "extras"
  siguen literalmente la columna "caso extra obligatorio" de `06 §4` (I-01 `end == start` no viola,
  I-04 `listText` con el mismo código, I-13 mismo id en grupos distintos que **no** viola, I-21
  `fixed` que sí viola, I-28 `fixed` que **no** viola, I-30 `\r` solo, …).
- **`I-29`** [V]: `golden/invariants/I-29-reserved-object-key.json` usa `fn: "assertNoReservedKeys"`
  con `raw` = JSON crudo, **antes** de `parse`, tal como exige `contratos §3`. Cubre `__proto__`,
  `constructor`, `prototype`, y `__proto__` dentro de `attic` y de `GroupItem.values`. La paridad
  aquí **no** es falsa.
- **Las 5 funciones** del handoff (`validateValueAgainstSpec`, `validateManifest`,
  `validateDocument`, `validateReorder`, `assertNoReservedKeys`) son las correctas y las cinco están
  cubiertas por golden. `richTextLength` es un auxiliar interno de la rama `richText`.
- **`golden/blocks/`** [V]: 14 ficheros, todos con los 6 `tag` obligatorios de `06 §5.2`, varios con
  extras. Autodescriptivos (cada caso lleva su `spec`).
- **`golden/operations/`** [V]: 11 ficheros, `clearItemBlock` incluida (ADR-1R-X-01). Los códigos
  `TPL_BLOCK_UNKNOWN` / `TPL_ITEM_UNKNOWN` / `TPL_SECTION_UNKNOWN` / `TPL_VARIANT_UNKNOWN` /
  `TPL_THEME_ID_UNKNOWN` **existen** en `01 §6.5` (`OperationError`): no se inventó ninguno. (El
  problema es O-01, no los códigos.)
- **`gen:golden` es determinista** [V]: dos ejecuciones seguidas → 0 diferencias de `sha256` sobre
  los 71 ficheros de `golden/` + `json-schema/`. Por eso pude añadir la compuerta de deriva al CI.
- **ADR-2-0a-03 es una limitación REAL, no un atajo** [V]: `operations-reducer.ts` y `migrate.ts`
  **nunca existieron** en el repositorio — `git log --diff-filter=A -- 'diseno/esquema/*'` lista
  exactamente los 10 `.ts` + README, ninguno es reductor ni migrador; y `migrationsFrom` es `[]` en
  los dos ejemplos [V]. El agente no se lo ahorró.

---

## 2. Qué corregí yo

Todas las correcciones son puntuales, locales y objetivas; ninguna reescribe un generador ni cambia
semántica de esquema. Tras aplicarlas: `tsc --noEmit --strict` → EXIT 0, `gen:golden` → mismos bytes,
`pnpm --filter @invitaciones/schema test` → verde (salida literal en §3).

1. **`frontend/packages/schema/scripts/gen-golden-templates.ts`** (cierra **O-07**) — la
   autoverificación contra `diseno/ejemplos/**/compuesto.json` se mueve **antes** de escribir y
   **lanza** en vez de avisar. Ahora el generador hace lo que su README dice que hace.
2. **`.github/workflows/ci.yml`** (cierra **O-05**) — `on.pull_request.branches` restaurado a
   `[main, claude/agent-network-invitation-41nx5y, claude/fase-2-backend-orchestration-ksyuzi]`.
3. **`.github/workflows/ci.yml`** (cierra **O-04**) — nuevo paso *"Deriva de los golden files
   (ADR-1R-D-09)"* en el job `frontend`: `gen:golden` + `git diff --exit-code -- packages/schema/golden`
   + `git ls-files --others --exclude-standard` para detectar también ficheros nuevos. Determinismo
   verificado antes de añadirlo. YAML revalidado con `yaml.safe_load` [V].
4. **`frontend/packages/schema/test/invariant-gaps.contract.test.ts`** (cierra **O-03**) — reescrito:
   cada restricción se comprueba **ejecutando** el validador o el esquema real (I-16 sobre un spec
   `richText`, I-30 sobre `multiline` true/false, `ChoiceSpec.options[].label` vacía rechazada por
   Zod, `TextSpec.constraints.pattern` rechazada por el `strictObject`), y las **tres restricciones
   de asset**, que hoy no verifica nadie porque el reductor no existe, quedan como `it.todo`
   **visibles** en la salida en vez de como verdes vacíos. La suite pasa de 377 verdes a
   375 verdes + 3 `todo`: el número baja porque ahora el hueco se ve.
5. **`scripts/pg-ephemeral.sh`** (cierra **O-08**, documenta **O-09**) — el `source` del fichero de
   estado en `is_running()` pasa a un **subshell** (ya no contamina `start()` con un puerto/PGDATA
   muertos), se limpia el PGDATA huérfano cuando el estado está obsoleto (solo si cuelga de
   `$STATE_DIR`), y la cabecera documenta que la concurrencia real exige `TPL_TEST_STATE_DIR` por
   instancia. `bash -n` OK y `selftest` reejecutado [V].
6. **`frontend/packages/schema/golden/README.md`** (cierra **O-17**, mitiga **O-02** y **O-06**) —
   "Seis" → "Siete" ficheros; `template.json` se describe como **normalizado** (salida de `parse`,
   no copia) con la advertencia de I-22; y se añade el aviso de que la regla `assetId → url` es una
   convención de fixture y **no** la regla de producción de `02 §10.4`.

### Qué NO toqué, y por qué

- **O-01, O-02, O-10, O-11, O-12**: son de diseño o exigen regenerar todos los golden / cambiar la
  semántica de `compose()`. Van como exigencia a 2-0b.
- **O-06 (remedio real)**: emitir `golden/templates/<dir>/assets.json` añade un 8.º fichero a un
  inventario que `06 §3` y `golden-inventory.test.ts` fijan; necesita ADR (enmienda a ADR-2-0a-02).
- **O-13, O-14**: acciones del orquestador (`contratos.md` y política de merge).
- **O-15**: añadir los 2 casos extra cambia el recuento publicado (102 casos) sin ADR.
- **O-16, O-19, O-20**: `[ND]` en Kotlin o coste/beneficio bajo; mejor que 2-0b lo decida con el
  validador networknt delante.
- `set -euo pipefail` en un script pensado para `source` (contamina el shell del llamador con
  `errexit`): real, pero cambiar el manejo de errores de un script ya verificado no es "puntual".
  Anotado aquí para 2-0b.

---

## 3. Salida real de las pruebas tras mis correcciones

```
$ pnpm --filter @invitaciones/schema run typecheck
> tsc --noEmit --strict
(EXIT=0, salida vacía)

$ pnpm --filter @invitaciones/schema test
> vitest run --coverage

 RUN  v3.2.4 /home/user/RSVP---Lino-Sello/frontend/packages/schema
      Coverage enabled with v8

 ✓ test/invariants.contract.test.ts (102 tests) 23ms
 ✓ test/block-kinds.contract.test.ts (118 tests) 64ms
 ✓ test/migrations.contract.test.ts (23 tests) 16ms
 ✓ test/compose.templates.test.ts (6 tests) 18ms
 ✓ test/operations.contract.test.ts (45 tests) 26ms
 ✓ test/invariant-gaps.contract.test.ts (8 tests | 3 skipped) 18ms
 ✓ test/schema-coverage.contract.test.ts (30 tests) 292ms
 ✓ test/golden-inventory.test.ts (3 tests) 6ms
 ✓ test/invariant-catalog.contract.test.ts (32 tests) 17ms
 ✓ test/compose.branches.test.ts (5 tests) 7ms
 ✓ test/invariants.branches.test.ts (6 tests) 5ms

 Test Files  11 passed (11)
      Tests  375 passed | 3 todo (378)
   Start at  06:51:56
   Duration  2.98s

 % Coverage report from v8
---------------|---------|----------|---------|---------|-----------------------
File           | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------------|---------|----------|---------|---------|-----------------------
All files      |     100 |    88.04 |     100 |     100 |
 blocks.ts     |     100 |      100 |     100 |     100 |
 common.ts     |     100 |      100 |     100 |     100 |
 compose.ts    |     100 |    78.87 |     100 |     100 | ...2,95,97-98,106-109
 composed.ts   |     100 |      100 |     100 |     100 |
 document.ts   |     100 |      100 |     100 |     100 |
 invariants.ts |     100 |      100 |     100 |     100 |
 manifest.ts   |     100 |      100 |     100 |     100 |
 operations.ts |     100 |      100 |     100 |     100 |
---------------|---------|----------|---------|---------|-----------------------

Statements   : 100% ( 734/734 )
Branches     : 88.04% ( 221/251 )
Functions    : 100% ( 20/20 )
Lines        : 100% ( 734/734 )
```

Otras comprobaciones ejecutadas aquí:

```
$ # determinismo de gen:golden (sha256 de los 71 ficheros de golden/ + json-schema/, dos corridas)
DETERMINISTA: 0 diferencias entre dos regeneraciones

$ # ajv 8.20.0 contra el bundle, ambos modos
strict=true: OK
strict=false: OK

$ python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
YAML VALIDO; jobs: ['backend', 'frontend', 'e2e']
pull_request.branches: ['main', 'claude/agent-network-invitation-41nx5y', 'claude/fase-2-backend-orchestration-ksyuzi']

$ bash -n scripts/pg-ephemeral.sh && bash scripts/pg-ephemeral.sh selftest
bash -n: OK (sintaxis)
pg-ephemeral: arrancado en 127.0.0.1:40803 (PGDATA=/tmp/templates2-pg/data-11685)
TPL_TEST_JDBC_URL=jdbc:postgresql://127.0.0.1:40803/templates2_test
-- SELECT 1 --
1
-- jsonb ->> y @> --
CREATE TABLE
INSERT 0 1
 arrow_arrow | contains
-------------+----------
 1           | t
(1 row)
-- version --
PostgreSQL 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1) on x86_64-pc-linux-gnu ...
pg-ephemeral: parado y limpiado
EXIT=0

$ # O-08 reproducido con el script ORIGINAL de 2-0a y un fichero de estado obsoleto:
initdb: error: directory "/tmp/templates2-pg-orig/data-STALE" exists but is not empty
$ # el script corregido, con el MISMO estado obsoleto:
pg-ephemeral: arrancado en 127.0.0.1:50747 (PGDATA=/tmp/templates2-pg/data-11754)

$ # O-02, prueba directa (claves que Zod inyecta y el ejemplo crudo no trae):
boda-clasica-1.0.0/template.json: identico=False claves inyectadas=3
   ['.sections[].blocks[].itemBlocks[].aiEditable', '...editable', '...source']
xv-jardin-1.0.0/template.json:   identico=False claves inyectadas=3   (las mismas)
theme/defaults/documento.json:   identico=True
InvitationDocument.required = ["schemaVersion","template","theme","structure","content","meta"]   # sin attic
BusinessSnapshot.required   = [... ,"planTier"]                                                   # sin timezone
```

---

## 4. Recomendación por cada una de las 5 ADR propuestas

| ADR | recomendación | motivo / enmienda exacta |
|---|---|---|
| **ADR-2-0a-01** — toolchain Java 21 | **ACEPTAR** | Cambio mínimo (3 líneas), ya preverificado en `handoffs/0-build-jdk.md`, `compileKotlin` EXIT 0. No contradice nada de `contratos.md`; de hecho `contratos §7` lo pide explícitamente. Sin enmienda. |
| **ADR-2-0a-02** — `business.json` por plantilla | **ACEPTAR CON ENMIENDA** | La justificación es sólida y verificada (fechas de negocio distintas). Dos enmiendas obligatorias: (a) el mismo criterio ("los datos de entrada de `compose()` son **dato del golden**, no convención de un `.ts`") debe aplicarse al **`AssetIndex`**: añadir `golden/templates/<dir>/assets.json` y actualizar `golden-inventory.test.ts` y `06 §3` (O-06); (b) dejar escrito que `template.json` es la forma **normalizada** por `parse`, no una copia del ejemplo (O-02) — ya lo anoté en `golden/README.md`, pero la ADR debe recogerlo porque cambia lo que Kotlin tiene que hacer antes de invocar `Invariants.kt`. |
| **ADR-2-0a-03** — `operations`/`migrations` sin reductor | **ACEPTAR CON ENMIENDA** | La limitación es **real y verificada**, no un atajo (§1, "lo que verifiqué"). Enmiendas: (a) la ADR describe como pendiente solo `reducerResult`, cuando **`expectManifestError` tampoco lo verifica nadie hoy** y es inutilizable desde Kotlin (O-01) — hay que decirlo; (b) fijar en la propia ADR **el lenguaje y el orden** (ver §5); (c) fijar que la ADR caduca con el cierre de 2-0b, no "cuando se pueda". |
| **ADR-2-0a-04** — `e2e` con `if: false` | **ACEPTAR CON ENMIENDA** | La alternativa descartada (app "hola mundo" para fingir verde) está bien descartada: P9. Enmienda: la ADR solo cubre `e2e`, pero el CI queda con **1 de 3 jobs verde** porque `backend` también falla por diseño (O-14). Hay que (a) formalizar la relajación de ADR-026 a "los jobs *operativos* son obligatorios", con caducidad explícita (fin de fase 3 para `e2e`, cierre de 2-0b para `backend`), y (b) decidir si 2-0a se integra sola con el CI rojo o junto a 2-0b. |
| **ADR-2-0a-05** — `pg-ephemeral.sh` + puerto aleatorio | **ACEPTAR CON ENMIENDA** | Nombre y puerto aleatorio son razonables y el brief los pedía. Enmienda: la ADR justifica el puerto aleatorio por la ejecución en paralelo, pero el **fichero de estado compartido la impide igualmente** (O-09). La ADR debe fijar que dos instancias concurrentes exigen `TPL_TEST_STATE_DIR` propio, y que `IntegrationTestBase` no debe asumir ni el puerto **ni el directorio de estado**. |

Ninguna de las cinco **contradice** `contratos.md`; ninguna debe rechazarse.

---

## 5. Qué debe exigir el orquestador a quien implemente el reductor (dictamen sobre O-01/ADR-2-0a-03)

**En qué lenguaje: TypeScript primero, Kotlin como espejo.** No es una preferencia:

1. `contratos §2/§3` fija Zod/TS como **fuente única** del esquema y ADR-004 hace de Kotlin el
   consumidor del artefacto emitido. Escribir el reductor primero en Kotlin invertiría la dirección.
2. ADR-1R-D-09 exige que los golden sean **la salida de ejecutar código real**. Los golden viven en
   `frontend/packages/schema/golden/`; solo el lado TS puede generarlos sin invertir esa dirección.
3. `contratos §2` ya obliga a que la IA y el editor humano usen **el mismo reductor**, y ese reductor
   es del frontend (`04 §10.3`, ADR-1R-F-04): si se escribe solo en Kotlin, la fase 3 lo reescribe.
4. ADR-1R-C-03 ya puso la herramienta de migración en TypeScript reutilizando el mismo `compose`.

**Los cinco entregables concretos que hay que exigir antes de dar por buenos
`golden/operations/` y `golden/migrations/`:**

1. **`frontend/packages/schema/src/operations-validate.ts`** → `validateOperations(ops, manifest,
   theme, doc, opts)` con los códigos de `01 §6.5` (`contratos §10` ya la nombra). Hoy esa lógica
   está duplicada a mano dentro de `scripts/gen-golden-operations.ts:53-94` como función desechable:
   debe salir de ahí a `src/` y exportarse.
2. **`frontend/packages/schema/src/operations-reducer.ts`** → `applyOperation(doc, op, ctx)` pura, con
   `ReducerContext.assetMeta(assetId)` tal como fija `contratos §3`. Sin ella, `image.aspect`,
   `image.maxBytes` y `audio.maxBytes` siguen sin validador y los tres `it.todo` que dejé en
   `invariant-gaps.contract.test.ts` siguen abiertos.
3. **El fixture base, como DATO dentro de `golden/`** (cierra O-01): manifiesto, tema, documento base
   y `assetMeta` con los que se calculan `expectManifestError` y `reducerResult`. Sin esto, esos dos
   campos son inservibles desde Kotlin por muy implementado que esté el reductor. Si se decide no
   tocar el recuento de "11 ficheros" de `contratos §6`, que vaya a
   `frontend/packages/schema/golden/fixtures/operations-base.json`, fuera de la carpeta contada.
4. **`frontend/packages/schema/src/migrate.ts`** → `migrate(doc, from, to, plan)` y **al menos un par
   `antes.json`/`despues-esperado.json` real**. Que ningún ejemplo declare `migrationsFrom` no
   impide generarlo: ADR-1R-D-09 prohíbe **escribir** golden a mano, no sintetizar un
   `MigrationPlan` con código y ejecutar `migrate()` sobre él. Un par sintético 1.0.0→1.1.0 generado
   por código cumple la ADR; cero pares no cumple `06 §3`.
5. **Regenerar y verificar**: `pnpm --filter @invitaciones/schema run gen:golden` y que el paso de
   deriva de golden que añadí al CI quede verde. Con `reducerResult` real, `reducerResultPending`
   debe desaparecer del formato, no quedarse en `false`.

**Y, además de lo anterior, las dos exigencias de paridad que hoy nada cubre** (O-02 y O-10), que
deben ser criterio de aceptación de `Invariants.kt`/`Composer.kt`:

- **Normalización**: un golden de par crudo → normalizado por cada esquema con `.default()`, y una
  prueba Kotlin que demuestre `normalize(raw) == golden`. Sin ella, `I-22` diverge el día 1.
- **Ramas de composición sin golden**: convertir en casos golden (no en pruebas TS sueltas) el
  fallback de tema R8, `orphanSections`/variante desconocida de R1, el asset ausente del
  `AssetIndex`, los 3 `businessField` sin ejercitar, los `formatId` `h12`/`iso`/desconocido, la
  medianoche de `fH12`, un `locale` `en-US` y los kinds `audio`/`time`/`boolean`. Ese es el trabajo
  que convierte el 88,04 % de ramas en cobertura de **paridad** y no solo de TypeScript.
