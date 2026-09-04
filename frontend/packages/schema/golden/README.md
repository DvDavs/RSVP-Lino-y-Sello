# `golden/` — formato y contrato (ADR-1R-C-09, ADR-1R-D-09)

Ruta única compartida entre TypeScript y Kotlin. **Nada aquí se escribe a mano**: todo fichero lo
produce `pnpm --filter @invitaciones/schema run gen:golden` (ver `scripts/gen-golden*.ts`), que
ejecuta las funciones reales del paquete (`validateManifest`, `validateDocument`,
`validateValueAgainstSpec`, `validateReorder`, `assertNoReservedKeys`, `compose`, los esquemas Zod
`BlockValue`/`Operation`/`MigrationOp`) y **lanza** si el resultado declarado no coincide con lo que
el código produce de verdad. Regenerar (`pnpm --filter @invitaciones/schema run gen:golden`) debe
dar exactamente estos ficheros — si no, hay una regresión.

Kotlin monta este directorio como recurso de test sin copiarlo:
`sourceSets.test.resources.srcDir("frontend/packages/schema/golden")` (`06 §3`).

Formato de fichero: JSON (no JSONC), UTF-8 sin BOM, indentado 2, generado con
`JSON.stringify(v, null, 2) + "\n"`.

## `golden/templates/<slug>-<version>/`

**Ocho** ficheros por carpeta, uno por ejemplo completo de `docs/rediseno-plantillas/diseno/ejemplos/`
(seis de `06 §3`, más `business.json` de ADR-2-0a-02 y `assets.json` de ADR-2-2-02):

| Fichero | Contenido |
|---|---|
| `template.json` | `TemplateManifest` **NORMALIZADO**: la salida de `TemplateManifest.parse(ejemplo)`, no una copia del ejemplo. Zod inyecta los `.default()` ausentes — hoy `itemBlocks[].source`, `.editable` y `.aiEditable`, verificado comparando con `diseno/ejemplos/*/template.json`. **Kotlin no puede saltarse ese paso**: `src/blocks.ts` y `src/manifest.ts` declaran 28 `.default()` y el JSON Schema emitido (`io:"input"`) marca esos campos como opcionales, así que un manifiesto crudo válido llega a `Invariants.kt` sin ellos. Si Jackson no aplica los mismos defaults, `I-22` (que compara `ib.source !== "user"`) viola sobre un manifiesto que TypeScript acepta. Ningún golden de esta carpeta cubre todavía ese paso de normalización (revisión 2-0a-REV, objeción O-02) |
| `theme.json` | `ThemeSpec` copiado |
| `defaults.json` | `DefaultsFile` copiado |
| `documento.json` | `InvitationDocument` copiado |
| `business.json` | `BusinessSnapshot` **fijo** usado para componer este caso (ver nota de negocio abajo) |
| `assets.json` | el `AssetIndex` **exacto** con el que se compuso, como DATO (ADR-2-2-02, cierra O-06). Kotlin lo lee tal cual: así reproduce `compuesto.json` sin copiar la convención `assetId → url` del generador, que **no** es la regla de producción |
| `compuesto.json` | `result.composed` — la salida REAL de `compose(pkg, documento, business, assets, locale)` |
| `reporte.json` | `result.report` — el `CompositionReport` de esa misma llamada |

**Nota de negocio (desviación registrada frente a `06 §3`, que describe un único
`golden/templates/_business.json` compartido):** los dos ejemplos disponibles usan fechas de negocio
distintas (`2026-12-12` para `boda-clasica`, `2026-11-14` para `xv-jardin`, verificado comparando
`cover.date`/`couple.date` en sus `compuesto.json` de referencia) — un solo fichero compartido habría
obligado a fabricar un valor incorrecto para uno de los dos. Se usa un `business.json` **por
plantilla**, con los valores literales de `NOTAS.md` de cada ejemplo (o, cuando `NOTAS.md` no los da
—`xv-jardin`—, el único campo de negocio que el manifiesto realmente consume, `cover.date`, más
valores conservadores sin efecto observable en el resto). Registrado en
`memoria/preguntas-abiertas.md` (2-0a).

**`AssetIndex`**: el generador lo construye con la regla determinista
`url = "https://cdn.invitaciones.evolutiondev.mx/a/" + assetId.slice(3) + ".webp"` sobre cada
`assetId` hallado en `documento.json`/`defaults.json`, **y desde 2-2 lo emite como `assets.json`**
(ADR-2-2-02). El generador verifica en cada ejecución que
`compuesto.json` coincide **byte a byte** con el `compuesto.json` de `diseno/ejemplos/` (el golden de
referencia de la ronda 1R) — si no coincidiera, sería la prueba de que esa regla o el `BusinessSnapshot`
están mal, no que el golden hay que aceptarlo tal cual. Desde la revisión 2-0a-REV el generador
**lanza** en ese caso y no escribe nada (antes solo imprimía un aviso y reescribía el golden con la
salida errónea).

> **AVISO para quien escriba `ComposerTest.kt` (revisión 2-0a-REV, objeción O-06).** Esa regla
> `assetId → url` es una **convención de fixture de prueba**, NO la regla de producción. En
> producción `AssetUrlResolver` construye `"{templates2.assets.public-base-url}/{s3_key}"` a partir
> de la columna `s3_key` de `tpl_asset` (`02 §10.4`): deriva de un dato almacenado, no del `assetId`.
> Llevarla a `AssetUrlResolver` rompería cualquier asset cuya clave S3 no sea `<ULID>.webp`, que son
> todas las reales (`templates2/invitation/{id}/{sha256}.{ext}`, `02 §10.1`).
> **REMEDIO APLICADO en 2-2 (ADR-2-2-02):** el `AssetIndex` se emite como `assets.json` en cada
> carpeta. `ComposerGoldenTest.kt` lo lee como dato y `AssetUrlResolver` implementa **solo** la regla
> de producción (`"{public-base-url}/{s3_key}"`), verificada en `AssetUrlResolverTest.kt`.

## `golden/invariants/I-xx-<nombre>.json`

30 ficheros, `I-01` a `I-30` (contratos.md §3). Nombre de fichero derivado del código:
`I-01_RANGE_END_BEFORE_START` → `I-01-range-end-before-start.json`.

Cada fichero es un **array** de casos. Cada caso tiene `name`, `fn` (qué función ejecutar) y
`expect` (lista de códigos de `InvariantCode`, **ordenada ascendentemente** — comparar ignorando
`detail`), más los argumentos que esa `fn` necesita:

| `fn` | Argumentos adicionales del caso |
|---|---|
| `validateValueAgainstSpec` | `spec` (`BlockSpec`), `input` (valor crudo), `path` (string) |
| `validateManifest` | `manifest`, `theme`, `defaults` |
| `validateDocument` | `doc`, `manifest`, `theme` |
| `validateReorder` | `order` (string[]), `actuales` (string[]) |
| `assertNoReservedKeys` | `raw` (JSON crudo, tal cual llegaría por HTTP — **antes** de `.parse()`) |

Ejemplo literal (`I-01-range-end-before-start.json`, primer caso):
```json
{
  "name": "end anterior a start",
  "fn": "validateValueAgainstSpec",
  "spec": { "id": "event.when", "role": "eventWhen", "label": { "es-MX": "event.when" }, "required": false, "editable": true, "source": "user", "aiEditable": true, "type": "dateTimeRange", "formatId": "long-h12" },
  "input": { "kind": "dateTimeRange", "start": "2026-12-12T16:00", "end": "2026-12-12T15:00" },
  "path": "content.event.when",
  "expect": ["I-01_RANGE_END_BEFORE_START"]
}
```

Cada fichero trae **al menos** un caso con `expect` no vacío ("viola") y uno con `expect: []` ("no
viola"); casi todos traen además uno o más casos "extra" (trampas adversariales de `06 §4`).
`fn`/nombre de caso no siguen una etiqueta `"viola"|"no-viola"|"extra"` explícita: se distinguen por
`expect.length > 0` (viola) vs `=== 0` (no viola); los "extra" son simplemente casos adicionales más
allá del primer par.

Un runner parametrizado (uno por lenguaje) recorre cada fichero y, según `fn`, llama a la función
homónima real con los argumentos del caso, y compara el resultado (códigos ordenados) contra
`expect`.

## `golden/blocks/<kind>.cases.json`

14 ficheros, uno por `BlockKind`. Cada caso: `name`, `tag`
(`"P"|"PM"|"N-kind"|"N-shape"|"N-limit"|"N-null"|"extra"`), `spec` (`BlockSpec` o `null`), `value`
(el valor crudo a probar), `path`, `expectZodValid` (¿`BlockValue.safeParse(value)` tiene éxito?) y
`expectViolations` (códigos de `validateValueAgainstSpec(spec, value, path)`, solo cuando
`expectZodValid` es `true` y hay `spec`; si no, `[]`). Cada fichero trae como mínimo los 6 `tag`
obligatorios (`06 §5.2`); varios traen además casos `"extra"` (las "trampas" de la tabla de `06 §5.2`).

## `golden/operations/<op>.cases.json`

11 ficheros — las 11 operaciones de `src/operations.ts` `Operation`, `clearItemBlock` incluida
(ADR-1R-X-01). Cada caso: `name`, `tag` (`"valid-shape"|"invalid-shape"|"invalid-manifest"`),
`operation` (el objeto crudo), `expectZodValid` (¿`Operation.safeParse` tiene éxito?),
`expectOpViolations` (los códigos `OP_*` que devuelve `validateOperations` de verdad) y
**`reducerResult`**: la salida REAL de `applyOperation(documento, op, ctx)` — `{ok:true, doc, idMap?}`
o `{ok:false, error}` —, `null` solo cuando la forma no es válida y la operación ni siquiera llega al
reductor.

**Cerrado en 2-2 (objeción O-01 / ADR-2-0a-03).** El campo `expectManifestError` de 2-0a **ya no
existe**: se calculaba contra un `manifestFixture(...)` que vivía solo en el script generador, así que
no lo verificaba nadie en ninguno de los dos lados y obligaba al lector Kotlin a reimplementar
`scripts/fixtures.ts`. En su lugar, el fixture base se emite como DATO en
`golden/fixtures/operations-base.json` (manifiesto, tema, defaults, documento, `assetMeta`, `ulidSeed`)
y los dos campos nuevos los produce código exportado del paquete.

## `golden/fixtures/`

Fuera del recuento contractual de `contratos.md §6` (que fija 11 ficheros en `golden/operations/`):

| Fichero | Contenido |
|---|---|
| `operations-base.json` | manifiesto + tema + defaults + documento + `assetMeta` + `ulidSeed` con los que se calculan `reducerResult` y `expectOpViolations`. `newUlid` devuelve **siempre** `ulidSeed`: el reductor es determinista si se le inyecta una fuente determinista |
| `operations-batches.json` | casos de `applyBatch` (`01 §6.5`): `tempId` resuelto dentro del lote, sin resolver, duplicado, y el todo-o-nada. `ulidsDelLote` es la secuencia exacta que el runner debe inyectar |

## `golden/compose/<id>.case.json`

Una rama de R1-R9 por fichero (objeción **O-10**: la cobertura de `compose.ts` escondía reglas sin
probar, y la revisión pidió convertirlas en **casos golden, no en pruebas TS sueltas**, porque una
prueba TS no cruza a Kotlin y por tanto no es cobertura de paridad). Cada caso trae TODAS sus entradas
en línea (`manifest`, `theme`, `defaults`, `documento`, `business`, `assets`, `locale`) y la salida real
(`compuesto`, `reporte`), más una `descripcion` que dice qué rama fija. Cubre el fallback de tema de
R8, `orphanSections`, la clave duplicada, la variante desconocida, las dos formas de R1c, el asset
ausente del `AssetIndex`, los seis `businessField` con datos y con nulos, los cinco `formatId`, la
medianoche de `h12`, `es-MX`/`es-ES`/`en-US`, los 13 kinds escalares y el `invalidValues` de O-12.

## `golden/migrations/`

- `op-shapes.cases.json` — 22 casos: forma válida e inválida de cada una de las 11 `MigrationOp`
  cerradas de `01 §6.2`, autoverificados contra `MigrationOp.safeParse` real.
- `errors.cases.json` — los cinco `MigrationError` de `01 §6.1`, con el par de paquetes mínimo con el
  que se producen emitido como dato (`from`, `to`).
- `index.json` — índice de los casos con estructura de directorio (`migrate` y `switch`). Kotlin no
  puede enumerar subdirectorios del classpath con un glob simple, así que el índice es dato.
- `<slug>/<from>-to-<to>/` — par antes/después REAL: `plan.json`, `antes.json`,
  `despues-esperado.json`, `reporte-esperado.json` y **los dos paquetes completos**
  (`from-template.json`, `from-theme.json`, `from-defaults.json` y sus `to-*`), de modo que Kotlin
  ejecuta `migrate()` sin conocer el generador.
- `switch/<origen>-to-<destino>/` — igual, sin `plan.json`, para `switchTemplate` (`01 §6.4`).

**Cerrado en 2-2.** Los dos ejemplos siguen sin declarar `migrationsFrom` (el generador lo verifica en
cada ejecución y lanza si deja de ser cierto), pero ADR-1R-D-09 prohíbe **escribir** golden a mano, no
**sintetizarlos con código**: el par `fixture-tpl 1.0.0→2.0.0` se construye con `scripts/fixtures.ts`,
ejercita las **once** operaciones de migración y se verifica ejecutando `migrate()` de verdad.

## Regenerar

```
pnpm --filter @invitaciones/schema run gen:golden
```

Determinista: dos ejecuciones seguidas producen los mismos bytes (mismos ULIDs de fixtures, sin
reloj ni aleatoriedad — igual que `compose()`, R6/R9 de `01 §5.2`).
