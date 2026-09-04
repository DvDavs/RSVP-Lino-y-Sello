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

**Siete** ficheros por carpeta, uno por ejemplo completo de `docs/rediseno-plantillas/diseno/ejemplos/`
(seis de `06 §3` más `business.json`, ADR-2-0a-02):

| Fichero | Contenido |
|---|---|
| `template.json` | `TemplateManifest` **NORMALIZADO**: la salida de `TemplateManifest.parse(ejemplo)`, no una copia del ejemplo. Zod inyecta los `.default()` ausentes — hoy `itemBlocks[].source`, `.editable` y `.aiEditable`, verificado comparando con `diseno/ejemplos/*/template.json`. **Kotlin no puede saltarse ese paso**: `src/blocks.ts` y `src/manifest.ts` declaran 28 `.default()` y el JSON Schema emitido (`io:"input"`) marca esos campos como opcionales, así que un manifiesto crudo válido llega a `Invariants.kt` sin ellos. Si Jackson no aplica los mismos defaults, `I-22` (que compara `ib.source !== "user"`) viola sobre un manifiesto que TypeScript acepta. Ningún golden de esta carpeta cubre todavía ese paso de normalización (revisión 2-0a-REV, objeción O-02) |
| `theme.json` | `ThemeSpec` copiado |
| `defaults.json` | `DefaultsFile` copiado |
| `documento.json` | `InvitationDocument` copiado |
| `business.json` | `BusinessSnapshot` **fijo** usado para componer este caso (ver nota de negocio abajo) |
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

**`AssetIndex`** no se guarda como fichero: se reconstruye en el generador con la regla determinista
`url = "https://cdn.invitaciones.evolutiondev.mx/a/" + assetId.slice(3) + ".webp"` sobre cada
`assetId` hallado en `documento.json`/`defaults.json`. El generador verifica en cada ejecución que
`compuesto.json` coincide **byte a byte** con el `compuesto.json` de `diseno/ejemplos/` (el golden de
referencia de la ronda 1R) — si no coincidiera, sería la prueba de que esa regla o el `BusinessSnapshot`
están mal, no que el golden hay que aceptarlo tal cual. Desde la revisión 2-0a-REV el generador
**lanza** en ese caso y no escribe nada (antes solo imprimía un aviso y reescribía el golden con la
salida errónea).

> **AVISO para quien escriba `ComposerTest.kt` (revisión 2-0a-REV, objeción O-06).** Esa regla
> `assetId → url` es una **convención de fixture de prueba**, NO la regla de producción. En
> producción `AssetUrlResolver` construye `"{templates2.assets.public-base-url}/{s3_key}"` a partir
> de la columna `s3_key` de `tpl_asset` (`02 §10.4`): deriva de un dato almacenado, no del `assetId`.
> Reproducir `compuesto.json` desde Kotlin exige construir el `AssetIndex` con la convención de
> fixture **solo dentro de la prueba**; llevarla a `AssetUrlResolver` rompería cualquier asset cuya
> clave S3 no sea `<ULID>.webp`. Remedio pendiente: emitir el `AssetIndex` como dato
> (`golden/templates/<dir>/assets.json`) para que el golden deje de depender de una convención que
> vive solo en un `.ts`.

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

11 ficheros — las 11 operaciones de `esquema/operations.ts` `Operation`, `clearItemBlock` incluida
(ADR-1R-X-01). Cada caso: `name`, `tag` (`"valid-shape"|"invalid-shape"|"invalid-manifest"`),
`operation` (el objeto crudo), `expectZodValid` (¿`Operation.safeParse` tiene éxito?),
`expectManifestError` (código `TPL_*` o el código de invariante esperado cuando la operación es
válida en forma pero inválida contra un manifiesto/tema fijo del propio generador — comprobación
**referencial** directa, no el reductor) y **`reducerResult: null` con `reducerResultPending: true`**.

**Limitación declarada de esta fase (2-0a):** `operations-reducer.ts` (`applyOperation`, `01 §6.5`)
no es uno de los 10 archivos de esquema que esta fase movió — es lógica de negocio del reductor,
fuera de alcance de 2-0a. Por eso `reducerResult` queda `null`/pendiente: cuando exista el reductor
(2-0b o posterior), regenerar estos ficheros haciendo que `ocase()` en
`scripts/gen-golden-operations.ts` llame también a `applyOperation` sobre un documento base fijo y
rellene `reducerResult` de verdad (nunca a mano).

## `golden/migrations/`

**0 pares** `<slug>/<from>-to-<to>/{antes,despues-esperado}.json`: ninguno de los dos ejemplos
disponibles (`boda-clasica-1.0.0`, `xv-jardin-1.0.0`) declara `migrationsFrom` (ambos `[]`,
verificado por el propio generador en cada ejecución) y `migrate()` (`01 §6.1`, `migrate.ts`) no es
uno de los 10 archivos movidos en esta fase — fabricar un plan y una plantilla origen ficticios para
producir un par violaría ADR-1R-D-09. En su lugar: `op-shapes.cases.json` (22 casos: forma válida e
inválida de cada una de las 11 `MigrationOp` cerradas de `01 §6.2`, autoverificados contra
`MigrationOp.safeParse` real). Cuando exista una plantilla registrada con un plan de migración real
(fase 5, `05-migracion.md`) o se implemente `migrate.ts`,añadir aquí los pares reales.

## Regenerar

```
pnpm --filter @invitaciones/schema run gen:golden
```

Determinista: dos ejecuciones seguidas producen los mismos bytes (mismos ULIDs de fixtures, sin
reloj ni aleatoriedad — igual que `compose()`, R6/R9 de `01 §5.2`).
