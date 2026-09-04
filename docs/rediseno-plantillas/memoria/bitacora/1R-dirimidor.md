# Bitácora — dirimidor-1R (fase 1, 2026-09-03)

Arbitraje de las 16 contradicciones (`X-01`…`X-16`) que dejaron abiertas los cuatro revisores de la ronda 1R,
más la cuestión menor de `AssetIndex`. Cada una se **releyó en los archivos citados antes de decidir** y la
corrección se aplicó **en sitio y completa** (verificado con `grep -rn` que no quedan rastros del término viejo).
Sin commits, sin push, sin tocar código del repositorio.

Prioridad de arbitraje usada, en este orden: **P1** (una sola fuente de verdad) · **P2** · **P3** · **P5** ·
**P6** · **P7** · **P8** · **P9** · **P10**; desempate: la opción más conservadora, la que menos superficie
añade y la que no bloquea la fase 2.

---

## Grupo A — identidad y hashes

### X-01 · formato y fórmula de `package_hash` — **DECIDIDA: manda `01`; `02` se alinea**

- **Evidencia releída.** `01 §2.1` (líneas 53-77) define el algoritmo sobre **todos** los archivos del paquete
  y emite `"sha256:" + 64 hex`. `02 §2.2` declaraba `package_hash CHAR(64)` con
  `CHECK (package_hash ~ '^[0-9a-f]{64}$')` — incompatible con el prefijo — y `02 §7` describía
  `PackageHasher.kt` con la fórmula antigua `canonical(manifest) ‖ sha256 de cada asset`, que **no incluye
  `theme.json`, `defaults.json` ni los planes de migración**. Confirmado que la colisión es real y que su
  consecuencia es la de ADR-008: el registro es idempotente por `package_hash`, luego el segundo paquete se
  descarta como `noop_same_hash` **en silencio** (`02 §4` paso 4) — H-09/H-12 otra vez.
- **Decisión.** (a) **Fórmula**: la de `01 §2.1` (ADR-1R-D-03); la de `02 §7` queda derogada explícitamente.
  (b) **Formato**: el valor lleva su prefijo en todas partes; `tpl_template_version.package_hash` pasa a
  `VARCHAR(71)` con `CHECK ~ '^sha256:[0-9a-f]{64}$'`. Igual `tpl_template_registration.requested_hash`
  (que además no tenía `CHECK`: se le añade). Los digestos de **archivo** (`tpl_asset.sha256`,
  `AssetEntry.sha256`, `esquema/manifest.ts` `AssetEntry`) siguen siendo `CHAR(64)` sin prefijo: son otra cosa.
- **Motivo.** P1: dos representaciones del mismo hash (con y sin prefijo) es la enfermedad que este rediseño
  cura. Entre recortar el prefijo o ensanchar la columna, ensanchar cuesta 7 bytes por fila y conserva la
  agilidad de algoritmo en un valor que es clave de idempotencia permanente. La fórmula la decide `01` porque
  `contratos.md` §3 lo declara fuente normativa del dominio y porque la alternativa **colisiona**.
- **Archivos tocados.** `diseno/01-dominio-y-esquema.md` (§2.1, línea 77), `diseno/02-persistencia-y-catalogo.md`
  (§2 convención de tipos, V30, V35, §7 `PackageHasher.kt`), `diseno/03-api.md` (ejemplos `packageHash`).
  ADR nueva: **ADR-1R-X-05**.

### X-02 · formato y fórmula de `content_hash` — **DECIDIDA: manda `01 §5.5`; el informe entra en el hash**

- **Evidencia releída.** `01 §5.5` (líneas 601-632) define `contentHash = "sha256:" + hex(SHA-256(utf8(
  canonicalJson({composed, report}))))`. `02 §2.6` declaraba `CHAR(64)` + `CHECK`, `02 §7` (`ContentHasher.kt`)
  y `03 §3.12` paso 6 decían `sha256(canonical(composed))` **sin el informe**. Confirmada la consecuencia:
  `03 §7` usa el `contentHash` como `ETag` fuerte, así que un cambio en `report.stillDefault` —que cambia lo
  que el editor muestra y lo que `preflight` bloquea (`03 §6`)— no invalidaría la caché.
- **Decisión.** Fórmula de `01 §5.5` (con `report`); columna `tpl_release.content_hash VARCHAR(71)` con
  `CHECK ~ '^sha256:[0-9a-f]{64}$'`; `ETag: "sha256:3f…"` con el valor completo entre comillas.
- **Motivo.** P1 y P5: el hash identifica **la salida de `compose`**, y el informe es parte de esa salida.
  Recortar el prefijo en la base y reponerlo en HTTP sería otra vez dos representaciones del mismo valor.
- **Archivos tocados.** `01 §5.5`, `02 §2` (V34 + convención), `02 §7` (`ContentHasher.kt`), `03 §3.12`,
  `03 §3.15`, `03 §7`, ejemplos de `03`. ADR nueva: **ADR-1R-X-05**.

## Grupo B — catálogos y nombres

### X-03 · colisión de numeración de invariante — **DECIDIDA: la de contraste pasa a `I-31`, no a `I-30`**

- **Evidencia releída.** `I-24_REORDER_NOT_A_PERMUTATION` está **implementada y probada** en
  `esquema/invariants.ts` (`InvariantCode` y `validateReorder`), con caso en `06 §4` y ataque cerrado
  (`A-04`/`A-04b` de la salida ejecutada). `04 §17.1` y ADR-1R-F-06 proponían `I-24_PALETTE_CONTRAST_BELOW_AA`.
- **Decisión.** La de contraste se renumera a **`I-31_PALETTE_CONTRAST_BELOW_AA`** y queda **reservada, no
  declarada**, hasta que el orquestador acepte ADR-1R-F-06. `I-30` lo ocupa `I-30_TEXT_MULTILINE_NOT_ALLOWED`,
  que X-06 obliga a implementar ahora.
- **Motivo.** El código ocupado gana por estar implementado (P9). No se le da `I-30` a la de contraste para que
  el rango de códigos **implementados** quede contiguo (`I-01`…`I-30`) y la prueba de exhaustividad de
  `06 §4.2` no tenga un hueco. No se declara en `InvariantCode` porque implementarla equivaldría a aceptar
  ADR-1R-F-06, y el estado de las ADR lo fija el orquestador (regla del brief).
- **Archivos tocados.** `04 §17.1`, `04 §21` (lista de ADR), `06 §4` (nota de reserva),
  `esquema/invariants.ts` (comentario de reserva), `esquema/README.md`. Pregunta abierta registrada.

### X-04 · código de error al escribir un bloque no editable — **DECIDIDA: `TPL_BLOCK_NOT_EDITABLE`**

- **Evidencia releída.** `esquema/invariants.ts` `validateDocument` rechaza **todo** `spec.source !== "user"`
  con `I-21_BUSINESS_BLOCK_WRITTEN`, es decir también `"fixed"`; `06 §4` fila I-21 lo dice explícitamente
  ("bloque `source:"fixed"` escrito debe violar también") y `07 §8` lo confirma. `01 §6.5` define
  `OperationError` con `{ code: "TPL_BLOCK_NOT_EDITABLE"; blockId; source: "business" | "fixed" }`.
  `03` usaba `TPL_BUSINESS_BLOCK_WRITE` en cuatro sitios (§3.4, §5, §9.2, §12).
- **Decisión.** Gana `TPL_BLOCK_NOT_EDITABLE`, con `details.source ∈ {business, fixed}`.
- **Motivo.** P1 y P8: el nombre viejo describe la mitad de los casos que produce, así que el contrato de
  error mentiría sobre un `source:"fixed"`. La definición normativa del reductor está en `01 §6.5`.
- **Archivos tocados.** `03-api.md` (§3.4 punto 4, §3.4 lista de errores, §5 tabla, §9.2, §12 — caso 22
  reescrito y **caso 22b nuevo** para `fixed`, que el nombre anterior no cubría). `grep` confirma que no queda
  ningún `TPL_BUSINESS_BLOCK_WRITE` salvo la mención histórica del caso 22b.

### X-05 · falta `clearItemBlock` — **DECIDIDA: postura B, se añade (catálogo 10 → 11)**

- **Evidencia releída.** `esquema/operations.ts` tenía 10 miembros, con `setItemBlock` y sin su simétrica.
  `esquema/blocks.ts` `GroupItem.values` es un `z.record(BlockId, ScalarValue)`: ningún `ScalarValue`
  representa "ausente". `esquema/compose.ts` (rama `group`) resuelve cada `itemBlock` con
  `it.values[ib.id]` y, si es `undefined`, devuelve `value:null`/`provenance:"empty"` — **no existe ningún
  escalón `default` por `itemBlock`**: el escalón `default` es del grupo entero.
- **Decisión.** Se añade `{op:"clearItemBlock", groupId, itemId, blockId}`.
- **Motivo.** Doble, y el segundo es el decisivo: (1) sin ella la inversa de un `setItemBlock` sobre un ítem
  sin valor previo no es expresable y esa entrada de undo queda "no deshacible" (`04 §10.3`); (2) el sustituto
  que proponía `04 §10.3` —`setItemBlock` con "el valor de `defaults` del `itemBlock`"— es **inimplementable**,
  porque ese default no existe en el modelo, y su única lectura viable (rellenar con contenido de demostración)
  es la objeción O-08 de `04`: promueve demo a contenido de usuario, saca el bloque de `report.stillDefault` y
  desactiva el bloqueo de publicación de `03 §6` — H-03 reabierta desde el editor. "Catálogo cerrado" (ADR-003)
  significa que no se inventan operaciones en la implementación, no que un hueco hallado en la fase de diseño
  no se pueda tapar en la fase de diseño.
- **Archivos tocados.** `esquema/operations.ts`, `esquema/README.md`, `01 §5.4`, `02 §7` (`Operation.kt`),
  `04 §10.3` (fila nueva + inversa corregida), `06 §5.4` y `06 §8`, `07 §2` (tabla operación×validación,
  "7 de las 10" → "8 de las 11") y `07 §4.2` (A-INV-01). ADR nueva: **ADR-1R-X-01**.

### X-06 · cinco constraints que nadie valida — **DECIDIDA: una retirada, una invariante, tres al reductor**

- **Evidencia releída.** `validateValueAgainstSpec` (`esquema/invariants.ts`) tiene `case` para `text`,
  `richText`, `listText`, `dateTimeRange`, `choice` y `group`, y ninguno mira `text.pattern`,
  `text.multiline`, `image.aspect`, `image.maxBytes` ni `audio.maxBytes`. Al releerlas resulta que **no son
  el mismo problema**: `ImageValue` es `{kind, assetId, alt, focal}` y `AudioValue` es `{kind, assetId}`
  (`esquema/blocks.ts`), así que las tres de asset **no son comprobables contra el valor** — pedírselo a un
  validador valor↔spec es un error de categoría, no un olvido.
- **Decisión.**
  1. **`text.pattern` se retira del esquema.** El mismo patrón lo interpretarían `RegExp` de JavaScript y
     `java.util.regex` de Kotlin, que difieren (clases Unicode, lookbehind, grupos con nombre): TS y Kotlin
     podrían aceptar y rechazar el **mismo** documento. Eso es exactamente lo que P1 prohíbe y la misma clase
     de fallo que motivó I-29 (`z.record` vs ajv). Añade además superficie de ReDoS evaluada en cada escritura
     sobre entrada del cliente. Ningún manifiesto de ejemplo la usaba (verificado con `grep` sobre
     `ejemplos/*/template.json`).
  2. **`text.multiline` → `I-30_TEXT_MULTILINE_NOT_ALLOWED`** en `validateValueAgainstSpec`: con
     `multiline:false` el valor no puede contener `\r` ni `\n`. No es una pista de interfaz — la API y la IA
     escriben sin pasar por el formulario, que es el mismo argumento con el que ADR-1R-D-05 extendió I-16 a
     `richText` en esta misma ronda.
  3. **`image.maxBytes`, `audio.maxBytes` e `image.aspect` → al reductor**, en el paso que ya carga la fila de
     `tpl_asset` para verificar pertenencia (ADR-030) y donde `bytes`/`width`/`height` existen desde
     `02 §2` V31. `ReducerContext.ownsAsset(assetId): boolean` se sustituye por
     `assetMeta(assetId): {bytes, width?, height?, contentType} | null` — **una** función en vez de dos, misma
     consulta, misma transacción — y el fallo nuevo es `TPL_ASSET_SPEC_MISMATCH` con
     `details.constraint ∈ {maxBytes, aspect}`. Tolerancias de `aspect` fijadas como supuesto conservador y
     registradas en `preguntas-abiertas.md`. Comprobar al **atar** el asset al bloque (no al subirlo) es el
     único punto donde se conoce el `BlockSpec`, y encaja con que el recorte del editor sea destructivo
     (`04 §13`: reencuadrar sube un asset nuevo).
- **Motivo global.** P1: "nada se descarta en silencio". Cada regla acaba **o implementada o retirada**; no
  queda ninguna decorativa. Se prefirió retirar `pattern` (menos superficie, y la única opción que no arriesga
  divergencia TS⇄Kotlin) e implementar las otras cuatro donde son comprobables.
- **Archivos tocados.** `esquema/blocks.ts`, `esquema/invariants.ts`, `esquema/README.md`, `01 §6.5`,
  `02 §7` (`InvariantCode.kt`), `03 §3.4` y `03 §5`, `04 §4`, `06 §4`, `06 §4.1` (la tabla de huecos pasa a
  0 huecos y la prueba `invariant-gaps.contract.test.ts` se queda), `06 §13` (Q-05 cerrada).
  ADR nueva: **ADR-1R-X-02**.

## Grupo C — rutas y ciclo de vida del documento

### X-07 · creación del documento (C-02 + CD-3) — **DECIDIDA: solo `:choose-template`; la migración no pisa**

- **Evidencia releída.** ADR-013 dice "se crea perezosamente en el primer acceso autenticado"; `03 §3.3` dice
  `404 TPL_DOCUMENT_NOT_STARTED` y creación exclusiva por `:choose-template`; `02 §2.4` y `02 §11.5` seguían
  describiendo la creación perezosa; `05 §7.1` crea la misma fila con `ON CONFLICT DO UPDATE` y contenido
  poblado. `02 §6` y ADR-1R-B-10 confirman que `/editor/**` responde `409 TPL_NOT_MIGRATED` mientras
  `uses_templates2 = false`, y `02 §2.4` que `tpl_document.updated_by` solo lo escriben las rutas de edición.
- **Decisión.** (a) La creación es **exclusiva de `:choose-template`**; ninguna ruta de lectura crea nada;
  `TPL_DOCUMENT_NOT_STARTED` se mantiene. (b) La transacción de corte de la migración es el **único** otro
  creador y su `DO UPDATE` lleva `WHERE tpl_document.updated_by IS NULL` con `RETURNING`; si el cliente ya
  editó, el `UPDATE` no afecta a ninguna fila, la transacción se aborta y la invitación va a la cola de
  revisión manual.
- **Motivo.** P3: crear en el `GET` obliga al servidor a elegir una plantilla por defecto, que es una decisión
  de presentación tomada en el backend. H-39: es el hallazgo que ADR-013 cita como su propia razón de ser, y
  la creación perezosa lo reintroduce. El ahorro de un viaje es aparente: `04 §7.1` paso 1 ya empieza por el
  catálogo y `:choose-template`. Para el choque de `ON CONFLICT`: P6 y H-04/H-05 — sobrescribir una edición
  del cliente por re-migrar es precisamente el fallo que el módulo nuevo existe para no repetir; y se detecta
  por `RETURNING` vacío, no por un `SELECT` previo, que sería una carrera.
- **Archivos tocados.** `02 §2.4`, `02 §7` (`DocumentStore.kt`, `TplDocumentRepository.kt`), `02 §11.5`,
  `02 §13` (nota de convergencia), `03 §5` (tabla de idempotencia), `03 §13` y `09 §5` (notas de cierre),
  `05 §7.1` (tabla de tres casos). ADR nueva: **ADR-1R-X-03** (enmienda ADR-013).

### X-08 · ruta del render público — **DECIDIDA: `/public/i/{publicToken}/render`; ADR-013 enmendada**

- **Evidencia releída.** `03 §2` filas 15-16, `03 §3.15`-`§3.16`, `02 §7` (`PublicRenderController.kt`),
  `04 §6`/`§15` y `contratos.md` §4 usan **todos** `/public/i/{publicToken}/render`. La forma
  `/public/invitations/{token}/render` aparece **solo** en el texto de ADR-013 y en ningún documento de
  diseño ni ejemplo.
- **Decisión.** Vigente la de `03 §2`. Basta enmendar el texto de ADR-013 (lo hace el orquestador).
- **Motivo.** Desempate por conservadurismo: cambiar la ruta tocaría seis documentos y el frontend; cambiar
  una frase de una ADR, ninguno. Además `contratos.md` §4 ya la fija como contrato vigente.
- **Archivos tocados.** `03 §2` (párrafo nuevo que declara la forma canónica y marca la de ADR-013 como
  enmendada, para que un lector de fase 2 que empiece por la ADR no se despiste). Nada más: no había rastros.

### X-09 · la ruta pública y la bandera de corte — **DECIDIDA: sí consulta `uses_templates2`**

- **Evidencia releída.** `03 §3.15` resolvía `public_token → invitation_id → tpl_release WHERE is_active`
  y ya leía la fila de `invitation` para `is_enabled` + los dos campos de `customer`
  (`PublicGuestInfoController.kt:65-75`). `05 §7.5` pedía que el enrutador consultara la bandera también en
  la ruta pública y lo dejaba como "punto a verificar en fase 2".
- **Decisión.** La ruta pública comprueba `invitation.uses_templates2`; con `false` responde
  `404 TPL_RELEASE_NOT_FOUND` (el mismo código opaco que un token inexistente, para no dar oráculo).
  `GET …/exists` devuelve `{"published": false}`. La bandera se lee, nunca se escribe: la ruta sigue siendo
  lectura pura y cacheable. **No** se redirige al enlace legado. Se escribe además la ventana de CDN.
- **Motivo.** P6 y P10: con la bandera ignorada, tras un rollback conviven dos verdades vivas para la misma
  invitación (el módulo antiguo sirviendo `invitation_configs` y este sirviendo `tpl_release`) — H-04/H-05.
  Y **no cuesta nada**: la fila de `invitation` ya se lee en la misma consulta, así que no hay ni una consulta
  ni un índice de más. Se descarta la redirección al enlace legado porque exige un mapeo
  `public_token → URL legada` que no existe y que ataría el módulo nuevo al antiguo (menos superficie gana).
- **Archivos tocados.** `03 §3.15`, `03 §3.16`, `05 §7.5`. Coste asumido (invitados con el enlace nuevo ven
  `404` tras un rollback) registrado en `preguntas-abiertas.md`. ADR nueva: **ADR-1R-X-04**.

### X-10 · ruta de catálogo de plantillas — **RESUELTA DURANTE LA RONDA; solo faltaba alinear `04`**

- **Evidencia releída.** `03 §2` fila **1** y `03 §3.1` ya definen `GET /editor/templates2/catalog`,
  autenticada, con `eventKind`/`planTier`/`limit`/`cursor` y respuesta
  `{slug, version, name, eventKinds, minPlanTier, previewUrl, capabilities, status}`. La añadió `1R-backend`
  en esta misma ronda (su handoff §B.1 la lista entre las siete rutas nuevas). El supuesto
  `GET /public/templates2/catalog` de `04` es anterior a esa adición.
- **Decisión.** La ruta **existe**, es `GET /editor/templates2/catalog` y es **autenticada, no pública**.
  `minPlanTier` viaja en la respuesta para poder pintar la tarjeta bloqueada (`04 §7.1` paso 2, `04 §6.2`);
  quien bloquea de verdad es `:choose-template` con `403 TPL_PLAN_TIER_INSUFFICIENT`.
- **Motivo.** No se hace pública porque expondría el catálogo comercial y sus `minPlanTier` a cualquiera (P8)
  y porque el paso 1 del flujo ocurre ya dentro de `/editor`, con sesión (un 401 redirige a login, `04 §7.1`).
  No se filtra por plan en el servidor porque la tarjeta bloqueada con motivo es una decisión de producto ya
  tomada en `04 §6.2`.
- **Archivos tocados.** `04 §7.1` (paso 1) y `04 §22` (hueco **H-F-01 cerrado**). `grep` confirma que no queda
  ninguna mención a `/public/templates2/catalog`.

## Grupo D — coherencia entre documentos

### X-11 · carga del JSON Schema en Kotlin — **DECIDIDA: manda ADR-1R-D-08 (bundle); `02` se alinea**

- **Evidencia releída.** `esquema/emit-json-schema.ts` emite `templates2.schema.json` (bundle, 15 `$defs`)
  más 10 archivos-puntero de tres claves (`$schema`, `$id`, `$ref` → `…#/$defs/<Id>`); verificado ejecutándolo.
  `02 §7` y `02 §9` seguían diciendo "carga los 10 `*.schema.json`", `04` ya nombraba el bundle.
- **Decisión.** `JsonSchemaRegistry` carga **once** archivos: el bundle **más** los 10 punteros, y debe
  **preinstalar el bundle en la factoría por su `$id` absoluto** antes de resolver ningún puntero — si no,
  `com.networknt:json-schema-validator` intentaría **descargar** el `$id` por red. `JsonSchemaPresenceTest`
  pasa a comprobar además que el `$ref` de cada puntero **resuelve** (validando un documento por nombre).
- **Motivo.** P1: una sola emisión, un solo consumidor. Y la trampa de la resolución de `$ref` es el fallo que
  la fase 2 encontraría en tiempo de ejecución, no de compilación: mejor escrito.
- **Archivos tocados.** `02 §7` (`JsonSchemaRegistry.kt`), `02 §9` (párrafo de carga y punto 2 del control de
  deriva). Sigue **inferido**, no verificado, que esa biblioteca acepte el bundle: no hay JDK en la sesión.

### X-12 · firma de `compose` desactualizada — **APLICADA la firma vigente**

- **Evidencia releída.** `01 §5.1` declara `compose(pkg, doc, business, assets: AssetIndex, locale)`
  (ADR-1R-D-01, porque `ResolvedValue.image` exige `url` y sin el índice la función es inimplementable sin E/S).
  `05 §6.3` y `07 §9` citaban la firma de cuatro parámetros.
- **Decisión y archivos tocados.** `05` (línea del pseudocódigo de `compareRendered`) y `07 §9`
  (`Composer.compose`) actualizados. `grep` confirma que las tres apariciones de la firma coinciden ahora.

### X-13 · punteros a líneas obsoletos — **SUSTITUIDOS por citas por nombre**

- **Evidencia releída.** `02 §4` citaba `invariants.ts:25-61`, `02 §9` `:9-17`, `03 §3.4` `:86`, y unas 40
  citas más por número de línea repartidas por `02`, `03`, `05`, `06` y `07`, todas desfasadas tras la ronda.
  Dos de ellas eran además **falsas**: `02 §2.4` y `02 §13` afirmaban que `validateValueAgainstSpec` "no tiene
  rama para `richText`", cerrado por `1R-dominio` en esta misma ronda; igual `09 §T-06`.
- **Decisión.** 49 patrones sustituidos por cita **por nombre de símbolo** (`validateManifest`,
  `InvariantCode`, `Violation`, `validateValueAgainstSpec`, `TemplateSlug`, `Semver`, `BlockId`, `SectionKey`,
  `Ulid`, `EventKind`, `IsoDate`, `HttpUrl`, `MigrationPlan`, `AssetEntry`, `TemplateManifest`, `ThemeSpec`,
  `DefaultsFile`, `MigrationOp`, `Capability`, `AssetIndex`, `BusinessSnapshot`, `ComposedDocument`,
  `CompositionReport`, `ResolvedValue`, `InvitationDocument`, `Structure`, `SpecBase`/`BlockSpec`, `RichDoc`,
  `RichTextSpec`, `GroupValue`, `ScalarValue`, `TextValue`, `RichSpan`, `BlockKind`, `Operation`,
  `OperationBatch`, `EditProposal`, `AnyItemId`). Se conservan a propósito las citas por línea que **son** el
  registro histórico de un defecto ya corregido (`01 §11`, `08 §A-13`, `06 §13` Q-11) y las que apuntan a
  código Kotlin del repositorio, que no ha cambiado.
- **Archivos tocados.** `02`, `03`, `05`, `06`, `07` (y las dos afirmaciones falsas corregidas en `02` y `09`).
  `grep` de control: no queda ningún `esquema/*.ts:<línea>` en texto normativo.

### X-14 · códigos y tabla de la IA, y numeración Flyway — **DECIDIDA: nada de IA en fase 1; `V38`/`V39`**

- **Evidencia releída.** Última migración real del repositorio: `V28__add_whatsapp_sent_column.sql`
  (`ls src/main/resources/db/migration/`, comprobado). `02 §2` fija `V29`-`V37` con los nueve nombres, la
  `V37` ocupada por `tpl_asset_gc` (ADR-1R-B-03). `05 §7.2` pedía **`V37`** para `tpl_migration_run`:
  **colisión real**, dos migraciones con el mismo número — Flyway falla al arrancar. `07 §6` define 11
  códigos `TPL_AI_*` y `tpl_ai_proposal`.
- **Decisión.** Rango del módulo `V29`-`V37` (sin cambios). `tpl_migration_run` → **`V38`** (fase 5).
  `tpl_ai_proposal` → **`V39`** (fase futura). Los 11 códigos `TPL_AI_*` **no** entran en `03 §5` en fase 1:
  `03 §5` **reserva el prefijo** con un párrafo que apunta a `07 §6` y se vuelcan cuando se implementen las
  rutas.
- **Motivo.** Conservador y P9: `03 §5` es el contrato de las rutas que existen y `ErrorCatalogParityTest`
  (`03 §12`) compara esa tabla contra el `enum TplErrorCode`; enumerar códigos de tres rutas que ADR-027 deja
  explícitamente sin implementar rompería esa prueba o forzaría a implementarlas. Los números se asignan igual
  porque no asignarlos es exactamente cómo se llega a dos migraciones con el mismo número.
- **Archivos tocados.** `03 §5` (párrafo de reserva), `05 §7.2` (`V38` + comentario del porqué),
  `06 §6` (Flyway en pruebas: `V29`-`V37`), `07 §6` y `07 §9`. ADR nueva: **ADR-1R-X-06**.

### X-15 · lista de mensajes del lienzo — **DECIDIDA: ADR-018 queda ENMENDADA, no reemplazada**

- **Evidencia releída.** ADR-018 decide tres cosas: iframe propio, comunicación exclusivamente por
  `postMessage` tipado con los tipos en `packages/schema`, y que el iframe nunca recibe credenciales ni toca
  `tpl_document`. La lista de cuatro nombres va entre paréntesis, como ejemplo. ADR-031 y `contratos.md` §2
  citan ADR-018 por su decisión de arquitectura, no por esa lista.
- **Decisión.** Se enmienda **solo** la lista: el catálogo normativo es el de `04 §9.3`-`§9.4`, versionado con
  `CANVAS_PROTOCOL_VERSION` (ADR-1R-F-03). Todo lo demás de ADR-018 sigue vigente.
- **Motivo.** Menos superficie: reemplazar ADR-018 entera dejaría huérfanas las referencias de ADR-031 y de
  `contratos.md` §2 sin ganar nada; la lista nunca fue un catálogo cerrado.
- **Archivos tocados.** `04 §9` (nota de encabezado). El cambio de estado, al orquestador.

### X-16 · capacidad `singlePlace` — **DECIDIDA: se mantiene, con semántica escrita**

- **Evidencia releída.** `esquema/manifest.ts` `Capability` la declara; `05 §2` ya dice que `itemsSinglePlace`
  nunca llegó a F2/F3 (H-12) y que se migra "como defaults de la plantilla, no como contenido de ninguna
  invitación"; `05 §7` (tabla de mapeo) la trata como capacidad de plantilla y marca las rutas de origen como
  "solo alcanzable leyendo F1". Es decir: la contradicción estaba **medio resuelta** y lo que faltaba era la
  regla escrita, no la decisión.
- **Decisión.** Se **mantiene**. Una `Capability` es propiedad del **paquete**, nunca dato de invitación: no
  viaja en `InvitationDocument`, el cliente no la edita y la migración jamás la deriva de una invitación
  concreta. Reglas operativas añadidas: se lee solo de F1; `RegressionReport` **nunca** la cuenta como
  `missingUserText` ni `missingDemoText` (no estaba en ningún `before`); la variante que la usa entra
  `visible` según F1, nunca inferida de F2/F3.
- **Motivo.** Que no haya datos de origen no es argumento para retirarla: **es** la funcionalidad que H-12
  dejó muerta y que el módulo nuevo repara (P1 en su versión positiva). Retirarla del enum normalizaría la
  pérdida y haría irrecuperable una función que la plantilla sí puede ofrecer.
- **Archivos tocados.** `esquema/manifest.ts` (comentario normativo sobre `Capability`), `05 §2` (bloque de
  decisión), `05 §13`.

### Cuestión menor · `AssetIndex` — **SE USA, no sobra**

- **Evidencia releída.** `AssetIndex` es el **cuarto parámetro** de `compose` (`01 §5.1`, ADR-1R-D-01) y lo
  usa `esquema/compose.ts` (`resolveScalar`) para convertir `assetId` en `url`. Que no aparezca dentro de
  `ComposedDocument` es **correcto y deliberado**: ADR-1R-D-01 descarta explícitamente dejar el `assetId` en
  el documento compuesto, porque filtraría un identificador interno al render público y obligaría a cada
  componente de sección a saber de CDN.
- **Decisión.** Se mantiene, con comentario normativo que dice qué es (entrada de `compose`), qué no es (parte
  del `ComposedDocument`), por qué no se emite a JSON Schema (no cruza HTTP: lo construye el backend) y por qué
  su `url` debe ser estable (una URL firmada cambiaría el `contentHash` en cada petición, `01 §5.5`).
- **Archivos tocados.** `esquema/composed.ts`, `esquema/README.md`.

---

## Reverificación del esquema (salida literal)

Reutilizado el scratchpad de `1R-dominio`
(`/tmp/claude-0/-home-user-RSVP---Lino-Sello/0ef13c98-327a-5e1f-ac50-6589ef84feda/scratchpad/1R-dominio`,
node 22.22.2, pnpm 10.33.0, tsc 5.9.3, zod 4.5.4, ajv 8.20.0, ajv-formats 3.0.1). Los `esquema/*.ts` y los
`ejemplos/**` se copiaron **después** de aplicar las decisiones y se corrió `./run-all.sh` completo más un
script nuevo `src/dirim.ts` que ejercita X-05 y X-06. Salida literal:

```
### 0. entorno
node v22.22.2 · pnpm 10.33.0 · tsc Version 5.9.3 · zod 4.5.4 · ajv 8.20.0 · ajv-formats 3.0.1

### 1. npx tsc --noEmit --strict -p tsconfig.json
(sin salida = 0 errores)  EXIT=0

### 2. npx tsx src/emit-json-schema.ts json-schema
wrote json-schema/templates2.schema.json (15 definiciones)
wrote json-schema/template-manifest.schema.json -> #/$defs/TemplateManifest
wrote json-schema/theme.schema.json -> #/$defs/Theme
wrote json-schema/defaults.schema.json -> #/$defs/Defaults
wrote json-schema/migration-plan.schema.json -> #/$defs/MigrationPlan
wrote json-schema/invitation-document.schema.json -> #/$defs/InvitationDocument
wrote json-schema/operation-batch.schema.json -> #/$defs/OperationBatch
wrote json-schema/edit-proposal.schema.json -> #/$defs/EditProposal
wrote json-schema/composed-document.schema.json -> #/$defs/ComposedDocument
wrote json-schema/business-snapshot.schema.json -> #/$defs/BusinessSnapshot
wrote json-schema/composition-report.schema.json -> #/$defs/CompositionReport

### 3. npx tsx src/verify.ts   (Zod + ajv 2020-12 con ajv-formats, vía el bundle)
PASS  ejemplos/boda-clasica-1.0.0/template.json    zod=OK  ajv=OK 
PASS  ejemplos/boda-clasica-1.0.0/theme.json       zod=OK  ajv=OK 
PASS  ejemplos/boda-clasica-1.0.0/defaults.json    zod=OK  ajv=OK 
PASS  ejemplos/boda-clasica-1.0.0/documento.json   zod=OK  ajv=OK 
PASS  ejemplos/boda-clasica-1.0.0/compuesto.json   zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/template.json       zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/theme.json          zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/defaults.json       zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/documento.json      zod=OK  ajv=OK 
PASS  ejemplos/xv-jardin-1.0.0/compuesto.json      zod=OK  ajv=OK 

TODO VERDE

### 4. npx tsx src/inv.ts   (invariantes I-01…I-29 sobre los ejemplos)
ejemplos/boda-clasica-1.0.0  validateManifest -> 0 violacion(es)
ejemplos/boda-clasica-1.0.0  validateDocument -> 0 violacion(es)
ejemplos/xv-jardin-1.0.0  validateManifest -> 0 violacion(es)
ejemplos/xv-jardin-1.0.0  validateDocument -> 0 violacion(es)

### 5. npx tsx src/gen.ts   (compose de referencia: R9 + reproducción de los golden files)
[boda-clasica-1.0.0] R9 idempotencia: OK (bytes idénticos)
[boda-clasica-1.0.0] ComposedDocument valida contra Zod: true
[boda-clasica-1.0.0] report = {"missingRequired":[],"stillDefault":[],"orphanContent":[],"orphanSections":[],"invalidValues":[],"themeFallback":null}
[boda-clasica-1.0.0] reproduce compuesto.json existente: SÍ (idéntico)
[xv-jardin-1.0.0] R9 idempotencia: OK (bytes idénticos)
[xv-jardin-1.0.0] ComposedDocument valida contra Zod: true
[xv-jardin-1.0.0] report = {"missingRequired":[],"stillDefault":[],"orphanContent":[],"orphanSections":[],"invalidValues":[],"themeFallback":null}
[xv-jardin-1.0.0] reproduce compuesto.json existente: SÍ (idéntico)

### 6. npx tsx src/attack2.ts   (los 12 ataques de la ronda 1R, tras las correcciones)
CERRADO A-01a    ajv RECHAZA href="javascript:alert(1)" en ComposedDocument
CERRADO A-01b    ajv RECHAZA href="data:…"
CERRADO A-01c    Zod RECHAZA href="javascript:…"
CERRADO A-01d    ajv ACEPTA una URL https legítima (no hay falso positivo)
CERRADO A-02     richText de 1500 chars viola I-16 con maxLength=5
CERRADO A-03pre  (control) JSON.parse SÍ crea "__proto__" como propiedad propia
CERRADO A-03     z.record SIGUE aceptando (y descartando en silencio) "__proto__" — limitación de zod@4.5.4, no se puede cerrar con esquema
CERRADO A-03d    I-29 sobre el JSON crudo detecta 2 clave(s) reservada(s): $.attic.boda-clasica@1.0.0.__proto__, $.attic.boda-clasica@1.0.0.constructor
CERRADO A-03e    I-29 no da falsos positivos sobre el documento legítimo
CERRADO A-03b    attic RECHAZA "Boda_Clasica@01.0.0" (slug/semver inválidos)
CERRADO A-03c    attic ACEPTA una entrada legítima
CERRADO A-04     I-24 rechaza un reorderSections que no es permutación
CERRADO A-04b    I-24 acepta una permutación real
CERRADO A-05     setTheme vacío SIGUE siendo válido (no-op; se documenta, no se rompe)
CERRADO A-07     los 42 roles de boda-clasica están en el catálogo (parseo estricto)
CERRADO A-09     I-25 rechaza un grupo con rol escalar
CERRADO A-10     I-26 rechaza un rol singleton duplicado
CERRADO A-10b    boda-clasica@1.0.0 sigue en 0 violaciones (sectionTitle ×8 es legítimo)
CERRADO A-11     I-27 rechaza un manifiesto que declara un locale sin etiquetas
CERRADO A-12     I-28 rechaza un default para un bloque de negocio

### 7. npx tsx src/dirim.ts   (decisiones del dirimidor: X-05, X-06)
OK   X-05 clearItemBlock valida
OK   X-05 clearItemBlock rechaza clave extra (strictObject)
OK   X-05 clearItemBlock acepta tempId
     catálogo (11): addItem, clearBlock, clearItemBlock, moveItem, removeItem, reorderSections, setBlock, setItemBlock, setSectionVariant, setSectionVisible, setTheme
OK   X-06 TextSpec RECHAZA constraints.pattern (retirado)
OK   X-06 I-30 viola con \n y multiline:false  -> [{"code":"I-30_TEXT_MULTILINE_NOT_ALLOWED","path":"content.cover.title"}]
OK   X-06 I-30 no viola sin salto de línea
OK   X-06 I-30 no viola con multiline:true
```

Nota sobre la salida: el rótulo "### 4 … I-01…I-29" y el "### 6 … los 12 ataques" son textos fijos del
`run-all.sh` que dejó `1R-dominio`; el catálogo real tras esta ronda es **I-01…I-30** y los ataques
enumerados son 20. No se editó su script para que la salida siga siendo comparable con la de su bitácora.

## Lo que no pude determinar

- Que `com.networknt:json-schema-validator` **acepte** el bundle con `$defs` y resuelva los `$ref` entre
  archivos sigue **inferido** de que ajv lo hace: no hay JDK 17/21 utilizable en esta sesión (`contratos.md` §7).
- El comportamiento de `I-30` en Kotlin no se pudo probar (misma razón). La tabla de casos compartida de
  `06 §4` es lo que lo cerrará.
- Las tolerancias de `image.aspect` son un supuesto de producto, no un dato: registradas en
  `preguntas-abiertas.md`.
- Si el dueño prefiere pagar una redirección `public_token → enlace legado` tras un rollback (X-09): también
  registrado como pregunta.
