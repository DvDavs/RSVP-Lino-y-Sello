# Handoff — dirimidor-1R → orquestador de fase 1

16 contradicciones (`X-01`…`X-16`) + `AssetIndex`, arbitradas y **aplicadas en sitio** en `diseno/**`. Evidencia por caso: `bitacora/1R-dirimidor.md`. Sin commits.
Reverificación ejecutada tras los cambios (scratchpad de `1R-dominio`; node 22.22.2 · tsc 5.9.3 · zod 4.5.4 · ajv 8.20.0): `tsc --noEmit --strict` **0 errores** · bundle + 10 punteros reemitidos · **10/10** ejemplos válidos contra Zod y ajv · `compose` reproduce ambos golden byte a byte y es idempotente · 20 ataques cerrados · 8 comprobaciones nuevas de X-05/X-06 en verde. Salida literal en la bitácora.

## (a) Decisiones

| id | Decisión |
|---|---|
| **X-01** | Manda `01 §2.1`: `package_hash` cubre **todo** el paquete y vale `"sha256:"+64hex`; `02` → `VARCHAR(71)` + `CHECK ~ '^sha256:[0-9a-f]{64}$'`; derogada la fórmula de `PackageHasher.kt` (colisionaba ⇒ descarte silencioso por ADR-008). |
| **X-02** | Manda `01 §5.5`: `contentHash` sobre `{composed, report}` (**con** informe), guardado con prefijo; `content_hash VARCHAR(71)`; `ETag: "sha256:3f…"`. |
| **X-03** | `I-24` sigue siendo `REORDER_NOT_A_PERMUTATION`; la de contraste pasa a **`I-31`**, **reservada** hasta aceptar ADR-1R-F-06 (`I-30` lo ocupa X-06; así el rango implementado queda contiguo). |
| **X-04** | Gana **`TPL_BLOCK_NOT_EDITABLE`** con `details.source ∈ {business,fixed}`; `TPL_BUSINESS_BLOCK_WRITE` desaparece (no cubría `fixed`, que I-21 también viola). |
| **X-05** | Postura B: **se añade `clearItemBlock`** (10 → **11** operaciones). El sustituto de `04 §10.3` era inimplementable (no hay defaults por `itemBlock`, `compose.ts` rama `group`) y su lectura viable reabría H-03. |
| **X-06** | `text.pattern` **retirada** (JS `RegExp` ≠ `java.util.regex` ⇒ TS y Kotlin podrían discrepar sobre el mismo documento, P1; y ReDoS); `text.multiline` → **`I-30_TEXT_MULTILINE_NOT_ALLOWED`**; `image.aspect`/`image.maxBytes`/`audio.maxBytes` → al **reductor** vía `ReducerContext.assetMeta` con `TPL_ASSET_SPEC_MISMATCH` (no son comprobables contra el valor: solo llevan `assetId`). Cero constraints sin validador. |
| **X-07** | Creación **exclusiva de `:choose-template`** (`GET` → `404 TPL_DOCUMENT_NOT_STARTED`); crear en el `GET` obliga a elegir plantilla por defecto en el backend (P3) y reintroduce H-39. La migración es el único otro creador: `DO UPDATE … WHERE tpl_document.updated_by IS NULL` + `RETURNING` ⇒ **nunca pisa una edición del cliente**; si la pisara, cola manual. |
| **X-08** | Vigente `/public/i/{publicToken}/render` (no había rastros de la otra forma en diseño); se enmienda el texto de ADR-013. |
| **X-09** | La ruta pública **sí** consulta `uses_templates2`: `false` → `404 TPL_RELEASE_NOT_FOUND` (código opaco). Coste cero (la fila de `invitation` ya se leía). Sin redirección al enlace legado. |
| **X-10** | **Resuelta durante la ronda**: existe `GET /editor/templates2/catalog` (`03 §2` fila 1, `§3.1`), **autenticada**, no pública. Solo faltaba alinear `04` (H-F-01 cerrado). |
| **X-11** | Manda ADR-1R-D-08: `JsonSchemaRegistry` carga **bundle + 10 punteros** y debe preinstalar el bundle por su `$id` (si no, la biblioteca lo descargaría por red). `02` alineado. |
| **X-12** | Aplicada `compose(pkg, doc, business, assets, locale)` en `05` y `07`. |
| **X-13** | 49 punteros `archivo.ts:línea` → cita **por nombre de símbolo** en `02`/`03`/`05`/`06`/`07`; corregidas dos afirmaciones ya **falsas** sobre `richText` (`02`, `09`). |
| **X-14** | Nada de IA en fase 1: `03 §5` **reserva el prefijo `TPL_AI_*`** sin enumerarlo. Módulo `V29`-`V37`; `tpl_migration_run` → **`V38`**; `tpl_ai_proposal` → **`V39`**. Elimina la colisión de dos `V37`. |
| **X-15** | ADR-018 **enmendada, no reemplazada**: su arquitectura sigue vigente (la citan ADR-031 y `contratos.md` §2); solo su lista de 4 mensajes la sustituye ADR-1R-F-03. |
| **X-16** | `singlePlace` **se mantiene**: propiedad del paquete, nunca dato de invitación. Que H-12 la dejara sin datos de origen es el motivo de conservarla; reglas de migración escritas en `05 §2`. |
| `AssetIndex` | **Se usa**: 4.º parámetro de `compose` (ADR-1R-D-01); que no esté en `ComposedDocument` es deliberado. Comentario normativo añadido. |

## (b) A volcar a `contratos.md`

1. **§3** invariantes **30** (`I-01`…`I-30`); `I-31` reservada sin declarar hasta aceptar ADR-1R-F-06.
2. **§3/§4** operaciones **11** (nueva `clearItemBlock`). · 3. **§3** `TextSpec.constraints.pattern` ya no existe.
4. **§3** `ReducerContext.assetMeta(assetId) → {bytes,width?,height?,contentType} | null` sustituye a `ownsAsset`.
5. **§4** error `TPL_BLOCK_NOT_EDITABLE` (con `details.source`) en vez de `TPL_BUSINESS_BLOCK_WRITE`; nuevo `TPL_ASSET_SPEC_MISMATCH`; prefijo `TPL_AI_*` reservado sin enumerar.
6. **§4** `GET …/document` no crea nada (solo `:choose-template`); `GET /public/i/{publicToken}/render` consulta `uses_templates2`.
7. **§4** catálogo del cliente = `GET /editor/templates2/catalog`, **autenticado**.
8. **§5** `package_hash`/`content_hash`/`requested_hash` = `VARCHAR(71)` + `CHECK ~ '^sha256:[0-9a-f]{64}$'`; digestos de archivo siguen `CHAR(64)`.
9. **§5** Flyway: módulo `V29`-`V37`, `V38` = `tpl_migration_run` (fase 5), `V39` = `tpl_ai_proposal` (futura).
10. **§6** golden: **11** ficheros en `golden/operations/`; las tres constraints de asset se prueban como casos del **reductor**.

## (c) ADR a enmendar o rechazar, con motivo

- **ADR-013** (aceptada) → **enmendar dos cláusulas**: la creación perezosa en el primer acceso (X-07: viola P3 y reintroduce H-39, el hallazgo que la propia ADR cita) y la ruta `/public/invitations/{token}/render` → `/public/i/{publicToken}/render` (X-08). El resto sigue vigente.
- **ADR-018** (aceptada) → **enmendar solo su lista de 4 mensajes** (X-15). Su decisión de arquitectura no se toca.
- **ADR-1R-F-06** (propuesta) → aceptable **con la invariante renumerada a `I-31`** (X-03); mientras siga propuesta no se declara en `InvariantCode`.
- **ADR-1R-D-05** (propuesta) → aceptable, pero su última línea propone `I-30` para la de contraste: es `I-31`.
- **ADR-1R-C-06** (propuesta) → aceptable con la precisión de X-07: el `DO UPDATE` lleva `WHERE tpl_document.updated_by IS NULL`.
- **ADR-1R-D-02 / D-03 / B-01 / B-03** (propuestas) → aceptables tal cual; X-01/X-02/X-14 las confirman y les añaden el tipo de columna y los números `V38`/`V39`.
- **ADR-019** (aceptada, ya enmendada por ADR-1R-F-04) → X-05 completa la enmienda: la inversa de `setItemBlock` sin valor previo es `clearItemBlock`, no una entrada "no deshacible".
- **Ninguna ADR debe rechazarse.**

## (d) ADR nuevas (estado "propuesta", 2026-09-03, al final de `decisiones.md`)

`ADR-1R-X-01` `clearItemBlock` · `ADR-1R-X-02` las cinco constraints (retirada + I-30 + reductor) · `ADR-1R-X-03` creación del documento y `DO UPDATE` condicionado · `ADR-1R-X-04` render público con bandera · `ADR-1R-X-05` hashes con prefijo y fórmulas de `01` · `ADR-1R-X-06` `V38`/`V39` y reserva de `TPL_AI_*`.
**4 preguntas nuevas** en `preguntas-abiertas.md`: tolerancias de `aspect`; `404` del enlace nuevo tras un rollback; qué hacer si alguna plantilla necesitara `pattern`; `I-31` reservada y sin compuerta mecánica mientras tanto.

**No verificable en esta sesión** (sin JDK): que `com.networknt:json-schema-validator` acepte el bundle con `$defs`, y el espejo Kotlin de `I-30`.
