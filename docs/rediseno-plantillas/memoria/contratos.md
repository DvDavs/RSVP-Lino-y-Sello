# Contratos vigentes

Solo el orquestador edita este archivo, a partir de ADR aceptadas.
**Estado: consolidado al cierre de la fase 1 (2026-09-03)**, tras la ronda 1R de revisión independiente (cuatro revisores Opus sobre bloques disjuntos) y el dirimidor de las 16 contradicciones entre bloques. Las 88 ADR (34 originales + 54 de la ronda 1R) están aceptadas; 15 de las originales llevan nota de enmienda en `decisiones.md`.

Si algo de este archivo contradice a un documento de `diseno/`, manda este archivo y hay que corregir el documento.

## 1. Rama y organización del repositorio
- Rama de trabajo: la fase 1 cerró en `claude/agent-network-invitation-41nx5y`; **la fase 2 se desarrolló en `claude/fase-2-backend-orchestration-ksyuzi`**, creada desde aquella (el entorno obliga a una rama por fase).
- Backend nuevo: paquete `mx.evolutiondev.invitaciones.modules.templates2` (ADR-012), subpaquetes `domain`, `schema`, `composition`, `persistence`, `api`, `migration`. Árbol de clases nombradas una por una en `02 §5`. No se toca el módulo antiguo (`modules/user/invitations/**`, `modules/master/templates/**`, `core/data/MongoDataInitializer.kt`) ni RSVP/invitados/auth/pagos.
- Frontend nuevo: `frontend/` en la raíz — monorepo pnpm con `packages/schema`, `packages/sections`, `packages/migration-legacy` y `apps/web` (ADR-017; desvío explícito del stack por defecto del prompt maestro §7, que proponía `apps/editor`+`apps/site` separadas). Árbol exacto y `package.json` de cada paquete en `04 §2`.
- Memoria: `docs/rediseno-plantillas/memoria/`.

## 2. Stack por defecto (sección 7 del prompt maestro; cambiable solo por ADR)
Monorepo TypeScript (pnpm 10.x + turbo) · **TypeScript 5.9.3, no 7.x** (ADR-1R-F-01: `typescript-eslint` declara `>=4.8.4 <6.1.0`; verificado también por 1R-dominio, que solo compila limpio con 5.9.3) · Next.js App Router + React + Tailwind · **Zod 4.5.4 como fuente única de esquema** → JSON Schema nativo (`z.toJSONSchema`, ADR-004) para Kotlin · editor a medida (dos paneles sincronizados, lienzo en iframe aislado sin `allow-same-origin`, ADR-018/031, con la compuerta de viabilidad de ADR-1R-F-02) · Zustand + Immer + pila de undo propia (ADR-019) · react-hook-form + Zod · dnd-kit con alternativa sin arrastre obligatoria · shadcn/ui solo para el *chrome* del editor · `react-image-crop@11.1.2` · PostgreSQL con JSONB, sin Mongo en el módulo nuevo (ADR-009) · documento de 4 capas · semver estricto con diff estructural obligatorio en el registro (ADR-028) · `InvitationRelease` inmutable (`tpl_release`) · sin colaboración en tiempo real · contrato de IA como operaciones estructuradas, mismo reductor que el editor humano, **especificado pero no implementado** (ADR-027, ADR-1R-C-16).

## 3. Esquema de plantilla y documento
Fuente: `diseno/01-dominio-y-esquema.md` + `frontend/packages/schema/src/*.ts` (**movidos** desde `diseno/esquema/` en la fase 2, bloque 2-0a; en la ruta antigua queda un README de redirección). Toda referencia a `esquema/<x>.ts` en `diseno/**` debe leerse hoy como `frontend/packages/schema/src/<x>.ts`. Modelo de 4 capas (paquete de plantilla inmutable → `theme` solo ids → `structure` secciones con `key`/`variant`/`visible` → `content` mapa plano por `blockId`). Catálogo cerrado: 12 tipos de sección, 14 tipos de bloque (`packages/schema/src/blocks.ts`), roles explícitos — 10 de grupo y 10 escalares, 17 declarados singleton (ADR-1R-D-04); la fuente normativa de los roles es `packages/schema/src/blocks.ts`, **no** la prosa de `01 §3.3`.

- **Invariantes: 30** (`I-01`…`I-30`), no 23 (ADR-005 enmendada por ADR-1R-D-05 y ADR-1R-X-02). Implementadas dos veces (TS + Kotlin) por la prohibición dura de `.refine()`/`.superRefine()`/`.transform()` en esquemas exportados (se descartan en silencio al emitir JSON Schema, verificado con `zod@4.5.4`). **`I-29` corre sobre el JSON crudo, antes de `parse`**: `z.record` acepta y descarta `"__proto__"` en silencio mientras ajv lo rechaza, así que sin ella TS y Kotlin discrepan sobre el mismo documento. `I-31_PALETTE_CONTRAST_BELOW_AA` está declarada (ADR-1R-F-06) pero su implementación es de la fase 3/4; el rango con espejo Kotlin exigible a la fase 2 es `I-01`…`I-30`.
- **Operaciones: 11**, no 10 (ADR-1R-X-01 añade `clearItemBlock`; sin ella la inversa de un `setItemBlock` sobre un ítem sin valor previo no era expresable). Catálogo en `packages/schema/src/operations.ts`.
- **`TextSpec.constraints.pattern` NO existe** (ADR-1R-X-02): las expresiones regulares de JavaScript y de `java.util.regex` pueden discrepar sobre el mismo documento, lo que viola P1, y añaden superficie de ReDoS. `text.multiline` se valida como `I-30`; `image.aspect`, `image.maxBytes` y `audio.maxBytes` se validan **en el reductor** vía `ReducerContext.assetMeta(assetId) → {bytes, width?, height?, contentType} | null` (sustituye a `ownsAsset`), con error `TPL_ASSET_SPEC_MISMATCH`. Cero restricciones del esquema sin validador.
- **Composición**: `compose(pkg, doc, business, assets: AssetIndex, locale) → CompositionResult`, pura y determinista, 9 reglas R1–R9 (`01 §5.2`). El parámetro `assets` es obligatorio: sin él `compose` era inimplementable, porque `ResolvedValue.image` exige una `url` y el documento solo guarda `assetId` (ADR-1R-D-01). `AssetIndex` no aparece dentro de `ComposedDocument` deliberadamente: las URL van ya resueltas. **R1c**: una sección ausente de `doc.structure` se inserta en su posición relativa del manifiesto, no al final (ADR-1R-D-06).
- **`CompositionReport`** tiene una sola forma, la de `packages/schema/src/composed.ts`: `{missingRequired, stillDefault, orphanContent, orphanSections, invalidValues, themeFallback}`. `fallbacks` no existe.
- **`canonicalJson` y `contentHash`** definidos de forma única y normativa en `01 §5.5` (ADR-1R-D-02). `contentHash` se calcula sobre `{composed, report}` — **con** el informe: si no, un cambio en `stillDefault` no invalidaría el `ETag` del render público (dirimida en X-02). Se guarda **con prefijo de algoritmo**: `"sha256:" + 64 hex`.
- **`package_hash`** cubre el paquete entero (manifiesto + `theme.json` + `defaults.json` + migraciones + assets), con los `.json` canonicalizados, y se guarda con prefijo (ADR-1R-D-03, ADR-1R-X-05). La fórmula anterior solo cubría el manifiesto y los assets: colisionaba si únicamente cambiaban `theme.json` o `defaults.json`, y la idempotencia de ADR-008 descartaba entonces el segundo paquete **en silencio**.
- **Migración de versión**: `migrate(doc, from, to, plan) → MigrationResult`, operaciones declarativas cerradas (`01 §6`); el registro de una plantilla nueva EXIGE que un diff estructural contra la versión previa esté cubierto por un `MigrationPlan` si el bump no es mayor (ADR-028). **`switchTemplate`** (`01 §6.4`) es lo que ejecuta `:choose-template` al cambiar de plantilla: transporta solo por rol singleton, y los grupos van siempre al `attic` (ADR-1R-D-07).
- **`assetId` opaco**, nunca una URL en el documento (ADR-021). Clave del `attic`: `<slug>@<semver>`.
- **NO existen** `StructureEntry.order` (el orden es el del array), `SectionSpec.hideable`/`.defaultOrder`, `BlockSpec.defaultRef` ni `TemplateManifest.theme`. `source` es un enum de tres valores (`user | business | fixed`) con `businessField` aparte, nunca `"business:<campo>"`.
- **JSON Schema**: se emite como un **bundle único `templates2.schema.json`** (15 `$defs`, 42 `$ref`, 217 KB) más 10 punteros, no como 10 archivos autocontenidos de 469 KB (ADR-1R-D-08).
- **Golden files generados, nunca escritos a mano** (ADR-1R-D-09); `packages/schema/src/compose.ts` entra en la superficie pública de `@invitaciones/schema`.
- **Ejemplos completos y validados**: `diseno/ejemplos/{boda-clasica-1.0.0,xv-jardin-1.0.0}/*.json` (10 archivos).
- **Verificación ejecutable al cierre de la fase 1** (1R-dominio, reconfirmada por el dirimidor y por la verificación mecánica): `tsc --noEmit --strict` con 0 errores · bundle y punteros emitidos · **10/10 ejemplos válidos contra Zod y contra ajv 2020-12** · `compose` reproduce ambos golden byte a byte y es idempotente. Salida literal en `bitacora/1R-dominio.md` y `bitacora/1R-dirimidor.md`.

## 4. API del editor y del render público
Fuente: `diseno/03-api.md` (19 rutas con contrato completo: request, response, errores, idempotencia y límite de cada una). Tres superficies (ADR-013): edición autenticada, publicación y render público.

- **Creación del documento de trabajo**: la crea **exclusivamente `:choose-template`**. `GET .../document` responde `404 TPL_DOCUMENT_NOT_STARTED` y no crea nada (ADR-1R-X-03, dirimida en X-07; ADR-013 queda enmendada en esa cláusula). Crear en el `GET` obligaría al backend a elegir una plantilla por defecto, que es una decisión de presentación (P3) y reintroduce la ambigüedad de orden de H-39. El único otro creador es la migración, con `ON CONFLICT DO UPDATE … WHERE tpl_document.updated_by IS NULL`, que **nunca pisa una edición del cliente**.
- **Render público**: `GET /public/i/{publicToken}/render` (esta es la ruta vigente; ADR-013 queda enmendada). Sin auth, cacheado por `ETag = contentHash` (con prefijo `"sha256:…"`). Comprueba `invitation.is_enabled`, `customer.is_enabled` y `!customer.is_banned`, igual que el controlador público existente → `403 TPL_INVITATION_UNAVAILABLE`; y **consulta `invitation.uses_templates2`** → `404 TPL_RELEASE_NOT_FOUND` si es `false` (ADR-1R-X-04), para que un rollback devuelva el enlace al módulo antiguo. La invalidación de CDN no es instantánea: hay una ventana de `max-age` de 300 s tras despublicar o rotar el token.
- **Catálogo para el cliente**: `GET /editor/templates2/catalog`, **autenticado**, no público (filtra por `minPlanTier`).
- **Edición por operaciones**: `OperationBatch`, reductor único, revisión optimista `baseRevision` (ADR-014) — todo o nada para el editor humano. **`baseRevision` es obligatorio también en `restore` y en `:choose-template`** (ADR-1R-B-11). **La idempotencia real del lote es `(document_id, clientBatchId)` con índice único** (ADR-1R-B-03 y `02`): el argumento anterior ("el reintento falla su chequeo de `baseRevision`") es falso en el caso de timeout, donde el lote sí se aplicó. El reintento responde `200 {applied:false, revision:<la que produjo>}`.
- **Despublicar y rotar el enlace** son operaciones de primera clase (`DELETE …/release`, `POST …/public-token:rotate`, ADR-1R-B-05): sin ellas un enlace filtrado era irrevocable, porque `public_token` es estable.
- **Assets del editor**: se suben con **cuerpo binario crudo**, no `multipart/form-data` (el multipart por defecto corta en 1 MB y elevarlo relajaría una protección del módulo antiguo, ADR-1R-B-12). La única ruta multipart es `POST /master/templates2/versions`, que exige elevar `spring.servlet.multipart.max-file-size: 15MB` / `max-request-size: 64MB`. **Enmendado en la fase 2 (ADR-2-6-01 y ADR-2-ORQ-03): son TRES las modificaciones de `application.yml`** — la tercera es `templates2.assets.bucket`, **obligatoria y sin defecto**, porque el único defecto natural era el bucket de PRODUCCIÓN y arrancar sin pensarlo subía objetos de cliente ahí; sin ella la aplicación no arranca —, porque ADR-1R-F-09 exige además `templates2.revalidate.url`/`.token` para el webhook de invalidación; sin esas dos propiedades el webhook queda **desactivado** y no se inventa ningún host.
- **Registro de plantillas**: `POST /master/templates2/versions`, rol MASTER (ADR-033), transacción única, idempotente por `package_hash`.
- **Autorización**: `HierarchyValidationService` reusado sin excepción (ADR-015); matriz completa rol × ruta en `03 §4`. `/editor/**` no tiene regla en `SecurityConfig`: se protege con `@PreAuthorize` a nivel de clase (ADR-1R-B-10). `assetId` verificado por pertenencia en cada operación de escritura (ADR-030).
- **Errores**: cuerpo `TplErrorResponse` propio (`timestamp, statusCode, code, message, details`), **no** el `ErrorMessage` existente, que no tiene `code`. Handler `@RestControllerAdvice(basePackages = ["…templates2.api"])` con `@Order(HIGHEST_PRECEDENCE)` y handler final `Exception → 500 TPL_INTERNAL` (ADR-016 enmendada por ADR-1R-B-13). **Prohibidos `require`/`check`/`error()` en `templates2`**: caerían en el 400 genérico del handler existente, sin código tipado, reintroduciendo H-14. Tabla completa de códigos en `03 §5`.
  - `TPL_BLOCK_NOT_EDITABLE` con `details.source ∈ {business, fixed}` sustituye a `TPL_BUSINESS_BLOCK_WRITE`, que no cubría el caso `fixed` que I-21 también viola (dirimida en X-04). Nuevo `TPL_ASSET_SPEC_MISMATCH`. El prefijo **`TPL_AI_*` queda reservado sin enumerar**: la IA no entra en la fase 1 ni en la 2.
- **Límite de cuerpo**: lo aplica `Templates2BodyLimitFilter` propio — no existe propiedad de Spring que limite el cuerpo JSON (ADR-032 enmendada por ADR-1R-B-14). 768 KiB en `operations`, 8 KiB en el resto de rutas JSON.

## 5. Persistencia
Fuente: `diseno/02-persistencia-y-catalogo.md` (DDL final completo y copiable). PostgreSQL con JSONB, único almacén transaccional del módulo nuevo, sin Mongo (ADR-009).

- **Flyway**: la última migración real del repositorio es `V28__add_whatsapp_sent_column.sql` (verificado con `ls`). El módulo ocupa **`V29`-`V37`** (ADR-1R-B-01), no `V29`-`V36`. Fuera de ese rango y de esta fase: **`V38` = `tpl_migration_run`** (fase 5) y **`V39` = `tpl_ai_proposal`** (fase futura) — la asignación elimina la colisión de dos `V37` que traían dos revisores (dirimida en X-14).
- **Ocho tablas**: `tpl_template`, `tpl_template_version` (manifiesto/theme/defaults inmutables, `package_hash` único por plantilla, `migration_plans`), `tpl_asset`, `tpl_document` (una fila por invitación, `revision` optimista, `public_token` estable, `doc_bytes` con `CHECK ≤ 1 MiB`), `tpl_document_snapshot`, `tpl_release` (inmutable, como máximo un `is_active` por invitación, `business_snapshot`), `tpl_template_registration` (auditoría append-only), y **`tpl_asset_gc`** con trigger (ADR-1R-B-03): sin ella, un borrado en cascada dejaba objetos de S3 huérfanos y sin rastro, y el derecho al olvido era imposible.
- **Única columna añadida a una tabla existente**: `invitation.uses_templates2` (corte por invitación, ADR-023).
- **Integridad referencial** (ADR-1R-B-04): `ON DELETE CASCADE` hacia `invitation`, `ON DELETE SET NULL` hacia `customer`, `ON DELETE RESTRICT` hacia `tpl_template_version`. El borrado físico de invitaciones y clientes ya existe hoy en la administración, así que unas FK sin política lo habrían roto.
- **Tipos de hash**: `package_hash`, `content_hash` y `requested_hash` son `VARCHAR(71)` con `CHECK ~ '^sha256:[0-9a-f]{64}$'` (llevan el prefijo del algoritmo); los digestos de archivo sueltos siguen siendo `CHAR(64)` (dirimida en X-01/X-02).
- **`event_kinds` es `JSONB`** con GIN `jsonb_path_ops`, no `TEXT[]` (ADR-1R-B-09): `ddl-auto: validate` convierte un desajuste de mapeo en caída de arranque de toda la aplicación, y no hay hoy ningún mapeo de array SQL en el repositorio.
- **Índices de idempotencia**: `ux_tpl_document_snapshot_batch (document_id, client_batch_id)`, `ux_tpl_asset_invitation_sha`, `ux_tpl_asset_version_sha`.
- **`public_token`**: `VARCHAR(30)` con `CHECK` de patrón. **Enmendado en la fase 2 (ADR-2-ORQ-01): NO lo acuña el `UlidGenerator` monótono**, sino `PublicTokenGenerator` con `SecureRandom` fresco por llamada. Motivo medido: con el ULID monótono, dos tokens del mismo milisegundo se diferencian en **+1**, y `public_token` es una URL-capacidad que el render público sirve sin autenticación, así que adivinarlo *es* el acceso. `assetId` e `itemId` siguen siendo ULID monótonos.
- **Mapeo JSONB**: JPA + Hibernate 6.6 (ADR-1R-B-08), `@JdbcTypeCode(SqlTypes.JSON)` sobre atributos `JsonNode` con `columnDefinition = "jsonb"`, **sin dependencias nuevas**. Un único `ObjectMapper` `templates2ObjectMapper` (**no `@Primary`**, con `FAIL_ON_UNKNOWN_PROPERTIES`) más un `HibernatePropertiesCustomizer` que fija el `FormatMapper` (ADR-1R-B-06): así muere H-35 en el módulo nuevo sin alterar el antiguo. **Los hashes se calculan sobre el JSON canónico de la aplicación, nunca sobre los bytes de `jsonb`** (ADR-1R-B-07), porque Postgres reordena las claves de un `jsonb`.
- **Validación contra el JSON Schema**: `com.networknt:json-schema-validator:1.5.4`, draft 2020-12. `JsonSchemaRegistry` carga el bundle **más** los 10 punteros y **debe preinstalar el bundle por su `$id`** o la biblioteca intentaría descargarlo por red (dirimida en X-11). Los `*.schema.json` emitidos se consumen desde `frontend/packages/schema/json-schema` vía `sourceSets.main.resources.srcDir(...)`; la tarea Gradle **`verifyJsonSchemaEmitted`**, enganchada a `check`, reemite y **rompe el build si hay deriva**, junto con `JsonSchemaPresenceTest` e `InvariantParityTest`.
- **Retención**: snapshots por revisión + purga diferida; los releases nunca se purgan mientras estén activos o enlazados (ADR-011).

## 6. Pruebas y umbrales
Fuente: `diseno/06-pruebas-y-calidad.md`.
- **Cobertura Kotlin: JaCoCo 0.8.12** (ADR-1R-C-08). Kover queda descartado por una razón verificada, no de gusto: `KoverVerifyRule` 0.9.1 no tiene `filters`, así que **no admite umbrales por paquete**. Reglas: `PACKAGE` `composition*`/`migration*` ≥ 85 % líneas y ≥ 70 % ramas; `CLASS` `Invariants*` ≥ 95 %; `BUNDLE` ≥ 80 % con `classDirectories` filtrado a `templates2/**`. Comando: `./gradlew test jacocoTestReport jacocoTestCoverageVerification`. **Enmendado en la fase 2 (ADR-2-6-05): el job `backend` del CI corre `check`**, no `test`, porque sólo así se ejecuta `verifyJsonSchemaEmitted`, la compuerta de deriva del lado Kotlin (§5).
- **Cobertura TS: Vitest 3 + `@vitest/coverage-v8`**, con umbral obligatorio de **`functions`** además de `lines` (verificado: una función de una sola sentencia nunca llamada puede reportar `Lines 100 %`). `schema` 90/95/85 · `sections` 70/75/60 · `apps/web` 60/65/50.
- **Golden files en UNA sola ruta** (ADR-1R-C-09): `frontend/packages/schema/golden/{templates,invariants,blocks,operations,migrations}/`, sin copia ni symlink; Kotlin la monta con `sourceSets.test.resources.srcDir(...)`, y hay prueba de inventario en ambos lados. **11 ficheros en `golden/operations/`** (una por operación); las tres restricciones de asset se prueban como casos del reductor.
- **Casos de contrato**: un fichero por cada una de las 30 invariantes (caso que viola, caso que no y caso extra) + 14 ficheros por tipo de bloque (6 casos cada uno) + 11 por operación. `invariant-catalog.contract.test.ts` falla si un código nuevo entra sin fichero en los dos lados.
- **Postgres en pruebas sin Docker** (ADR-025 enmendada por ADR-1R-C-10): contrato por variable **`TPL_TEST_JDBC_URL`**; `services: postgres:16` en GitHub Actions; en local, clúster efímero **delegado en el usuario `postgres`** — verificado que `initdb` no corre como root. Testcontainers y H2 descartados.
- **CI**: `ci.yml` completo en `06 §9`, listo para copiar en la fase 2 sin rediseñar (ADR-1R-C-12; el del borrador anterior no habría arrancado). 3 jobs (`backend`, `frontend`, `e2e`), **JDK 21**, cachés, `PLAYWRIGHT_BROWSERS_PATH` del espacio de trabajo (en el runner de GitHub **no** existe `/opt/pw-browsers`), `webServer` de Playwright.
- **Política anti-flake** explícita, con cuarentena prohibida sin issue (ADR-1R-C-11).
- **Accesibilidad**: cero violaciones `axe` críticas o serias en el render público (ADR-024).

## 7. Entorno de ejecución de esta sesión (verificado)
- Java 21, Node 22.22.2, pnpm 10.33, npm 10.9. Chromium preinstalado para Playwright (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; no ejecutar `playwright install`). `jq` disponible.
- **Docker no disponible** (daemon apagado): Testcontainers no funciona. PostgreSQL 16.13 instalado localmente; clúster efímero arrancado y verificado en esta sesión (`->>` y `@>` comprobados), delegando en el usuario `postgres`.
- Sin acceso a `gh`; GitHub solo vía herramientas MCP del orquestador raíz.
- **Build Kotlin**: `build.gradle.kts` exige toolchain Java 17 y no hay JDK 17 instalado; `./gradlew test` no compila hoy. La fase 2 debe aplicar el cambio mínimo verificado en `handoffs/0-build-jdk.md` (toolchain y `jvmTarget` a 21, 4 líneas) y registrarlo como ADR. El intento de autodescarga con `foojay-resolver-convention` falla: el proxy devuelve 403.
- **Sin CI**: no existe `.github/workflows`; la fase 2 lo crea a partir de `06 §9`.
- No existe `src/test`: cero pruebas en el proyecto (H-19).
- **No verificable en esta sesión, por falta de JDK**: que `com.networknt:json-schema-validator` acepte el bundle con `$defs` (inferido de que ajv lo acepta), y el espejo Kotlin de las invariantes. Es lo primero que debe comprobar la fase 2.

## 8. Frontend y editor
Fuente: `diseno/04-frontend-y-editor.md` (1 624 líneas, a grado de implementación).
- **Rutas de `apps/web`**: `/editor`, `/editor/[invitationId]`, `/editor/[invitationId]/canvas`, `/preview/[invitationId]` (previsualización autenticada sin chrome, y salida de degradación del lienzo), `/i/[publicToken]`, `/api/revalidate`.
- **Protocolo `postMessage` v1** (ADR-1R-F-03, enmienda la lista de mensajes de ADR-018): en `packages/schema/src/canvas-protocol.ts`, **excluido** de la emisión de JSON Schema para Kotlin. Saludo con `MessageChannel`; **el padre valida por `event.source` + nonce, NO por `event.origin`** — el lienzo tiene origen opaco y `event.origin === window.location.origin` habría rechazado todos sus mensajes; el hijo sí valida por `event.origin`. 8 mensajes por sentido.
- **Aislamiento del lienzo** (ADR-1R-F-02): ADR-031 se mantiene, con cinco condiciones obligatorias (CORS de fuentes; CSP con hosts explícitos y `nonce`, **nunca `'self'`**, que no casa con nada en origen opaco; `connect-src 'none'`; ruta sin fetch ni navegación; `targetOrigin:"*"` sin secretos; sin HMR) y una **compuerta medible A1-A8 al inicio de la fase 3**, con contingencia preaprobada (origen dedicado `lienzo.<dominio>`). Es la **primera tarea obligatoria de la fase 3**: todo lo demás depende de su resultado.
- **Undo por operaciones** (ADR-1R-F-04): la inversa de `setBlock` sobre un bloque con `provenance:"default"` es **`clearBlock`**, nunca `setBlock(valorPorDefecto)` — esto último promovía contenido de demostración a contenido de usuario, desactivaba el bloqueo de publicación y reabría H-03. La inversa de `setItemBlock` sin valor previo es `clearItemBlock` (ADR-1R-X-01).
- **Conflicto de `baseRevision`** (ADR-1R-F-05): `BroadcastChannel` para un solo editor por navegador, más diálogo de tres opciones, **sin rebase automático**.
- **Tipografías siempre autoalojadas** (ADR-1R-F-07): `source:"bundled"` primario, `source:"google"` solo con lista blanca compilada. Exige **CORS** en `/_next/static/media/**`, `/fonts/**` y en el bucket S3 de assets — tarea de infraestructura de la fase 2/4.
- **Invalidación al publicar** (ADR-1R-F-09): tras confirmar `POST .../release`, el backend llama `POST {frontend}/api/revalidate` con `x-revalidate-token`; el handler hace `revalidateTag("invitation:{publicToken}")`. `revalidate: 300` queda como red de seguridad. **IMPLEMENTADO en la fase 2** (ADR-2-6-01): `ReleaseService` publica un evento y `RevalidationNotifier` lo consume con `@TransactionalEventListener(AFTER_COMMIT)`; un fallo del webhook **nunca** tumba la publicación, y también se invalida al despublicar y al rotar el token (en la rotación se invalida el token **anterior**, que es el que está cacheado). **El cuerpo exacto del `POST /api/revalidate` lo fija el backend de la fase 2, no este contrato: la fase 3 debe leerlo de `handoffs/2-para-fase-3.md`.**
- **Presupuestos medibles**: JS de primera carga de `/i/[publicToken]` **< 150 KB gz** (compuerta `scripts/check-budget.mjs`, rompe el PR) y **LCP < 2,5 s** en móvil (`@lhci/cli@0.15.1`, 3 corridas, mediana). Subir un presupuesto exige ADR.
- **WCAG 2.2 AA**: alternativa sin arrastre obligatoria (2.5.7), objetivos ≥ 24 px (2.5.8), foco no obstruido (2.4.11), **`noindex` en el render público** (sin él se exponían nombre, dirección y fecha del cliente a los buscadores), contraste validado en tres puntos, es-MX.
- **Separación estricta** entre el *chrome* del editor (shadcn/Tailwind) y el sistema de tokens de las invitaciones, con cuatro mecanismos descritos en `04 §19`.
- **Escenarios de prueba nombrados**: U-01…U-18 (componente) y E-01…E-12 (Playwright), en `04 §20`.

## 9. Migración
Fuente: `diseno/05-migracion.md`.
- **El alcance anterior era falso** (ADR-1R-C-07): no son "8 plantillas, con los ids 11-17 solo en producción". Hay **cuatro cohortes** y se construyen **9 paquetes** desde el repositorio (`templateId` 4, 5, 6, 7, 8, 9, 10, **11**, 13), de los que `boda-clasica@1.0.0` ya cubre el 5. El 13 no tiene fila Flyway; el 11 tiene su par de JSON pero comentado en el sembrador; el 12 y el 14 son reconstruibles desde `payload-template-*`; solo el 16 y el 17 no son reproducibles.
- **Tres fuentes, no una** (ADR-1R-C-01): F1 JSON del repositorio, F2 `default_visual_configs`, F3 `invitation_configs`. El paquete se construye desde F1 con `JSON.parse` y el golden `before` sale de F3. **Prohibido usar `EditorModels.kt` como parser**: por el modelo Kotlin se pierden tarjetas de contenido visible (H-12).
- **Clave de correlación: puntero RFC 6901**, nunca el `id` legado (ADR-1R-C-02; verificado: entre 20 y 103 ids duplicados por fichero, y `null` en 3 de 9).
- **Procedencia sin umbral de longitud** (ADR-1R-C-04, deroga el "≥ 12 caracteres" de ADR-022): el umbral publicaba contenido de demostración como dato real y reintroducía H-03. Toda coincidencia con el baseline va a cola de revisión humana. El baseline se lee de **Mongo**, no del repositorio, y se resuelve por **`(eventTypeId, planId)`** con marca de ambigüedad, porque el `templateId` no lo determina (ADR-1R-C-05, H-21).
- **Verificación por texto visible completo**, no filtrada por procedencia (ADR-1R-C-06): `missingUserText` y `missingImages` bloquean; `missingDemoText` informa. Igualdad exacta tras normalización de 6 pasos, sin umbral difuso.
- **Corte idempotente** `INSERT … ON CONFLICT (invitation_id) DO UPDATE … WHERE tpl_document.updated_by IS NULL` (dirimida en X-07), que **no** regenera `public_token`. Retención ≥ 180 días de Mongo y S3 legados; rollback = `uses_templates2 = false` + fila de auditoría, **sin borrar** `tpl_document`; ventana de rollback barato de 7 días. Tabla `tpl_migration_run` en la migración **`V38`** (fase 5).
- **Herramienta en TypeScript**, en `frontend/packages/migration-legacy/`, reutilizando `@invitaciones/schema` y el mismo `compose` (ADR-1R-C-03).
- **Estado real del prototipo**: el extractor probado en la fase 1 es **diagnóstico, no funcional**. Sobre los 9 JSON reales encontró de 3,6 k a 6,6 k hojas por fichero, ~95 % presentación, y dejó **146 patrones sin mapear** tras 100 reglas escritas a mano. La fase 5 parte de ahí, no de una herramienta terminada.

## 10. Contrato de IA (especificado, no implementado)
Fuente: `diseno/07-extension-ia.md`. No entra en la fase 1 ni en la 2; `03 §5` solo reserva el prefijo `TPL_AI_*` y la tabla `tpl_ai_proposal` queda para `V39`.
- `packages/schema/src/ai.ts`: `AiModelOutput`, `AiEditProposal` (con `proposalId`, `baseRevision`, `expiresAt`, `status`, `discarded[]`, `diff[]`, `usage`), `AiSuggestRequest` (con `intent` de enum cerrado), `AiApplyRequest` (ADR-1R-C-14).
- `packages/schema/src/operations-validate.ts` → `validateOperations(ops, manifest, theme, doc, opts)`, **compartida con el editor humano**, 18 códigos `OP_*`. Es la pieza que la API describía en prosa sin nombrar, y el validador anterior no cubría 7 de las 10 operaciones.
- **Ocho invariantes de IA A-INV-01…08**; A-INV-01 aplica el alcance por sección y **prohíbe `reorderSections` y `setTheme`** en toda propuesta de IA.
- **Límites** (ADR-1R-C-15): ≤ 10 operaciones, 1 sección, 1 reparación por operación y ≤ 3 por propuesta, 8 000/2 000 tokens, 20 s por llamada y 35 s por petición, 10 propuestas/hora/invitación, propuesta válida 15 min, 1 en vuelo por invitación.
- **Nueve defensas de inyección de prompt D1-D9**, ninguna dependiente del modelo (ADR-1R-C-13): el contenido del cliente entra en el prompt, así que el vector es real.
- Pipeline `validar → dry-run → aplicar → reparar → informe`, con descarte operación por operación, nunca abortando el lote entero.


## 11. Cierre de la fase 2 — backend (2026-09-04)

**Fase 2 CERRADA.** 50 ADR aceptadas (`ADR-2-0a-*`, `2-0b-*`, `2-1-*`, `2-2-*`, `2-3-*`, `2-4-*`, `2-5-*`, `2-6-*`, más `ADR-2-ORQ-01` y `-02`); ninguna rechazada. Enmiendan este archivo las citadas arriba en §1, §4, §5, §6 y §8.

- **Las dos verificaciones que la fase 1 dejó pendientes están resueltas ejecutándolas**, no infiriéndolas: `com.networknt:json-schema-validator:1.5.4` **acepta** el bundle `templates2.schema.json` con `$defs` preinstalado por `$id`, resolviendo los 10 punteros **sin salir a la red** (probado con un `SchemaLoader` y un `ProxySelector` que lanzan ante cualquier acceso), y valida **10/10** ejemplos igual que Zod y ajv; y el espejo Kotlin de `I-01`…`I-30` casa **102/102** casos de `golden/invariants/`.
- **Estado verificado al cierre**: `./gradlew clean check jacocoTestCoverageVerification` en verde con **1 184 pruebas Kotlin, 0 fallos, 0 omitidas**; `pnpm --filter @invitaciones/schema test` con **458 pruebas, 0 fallos**. Cobertura de `templates2`: BUNDLE 94,62 % líneas / 81,22 % ramas; `composition` 99,19/88,13; `migration` 99,67/87,42; `schema` 97,53/87,14; `api` 93,94/75,39; `persistence` 91,08/71,76; `catalog` 88,65/70,14; `domain` 94,77/100.
- **Cero presentación en el backend (P3)**: verificado con siete búsquedas mecánicas (colores hex, `rgb(`, unidades CSS, tipografías, iconos, HTML/CSS) sobre `templates2/**` → **0 resultados**. La única cadena visible es el catálogo de meses y `am`/`pm` de `DateFormatting.kt`, que `01 §5.2` R6 exige.
- **Riesgo abierto y AJENO al módulo** (ADR-2-ORQ-02): `InvitationGuestEntity` mapea `invitation_guest.graduates_name`, columna que **ninguna migración crea**, con `ddl-auto: validate`. Una base construida sólo con Flyway **no arranca la aplicación**, así que las 19 rutas **nunca se han visto responder sobre un Tomcat real**. No se corrigió por estar en área prohibida (invitados). Lo desbloquea `ALTER TABLE invitation_guest ADD COLUMN graduates_name varchar(255)`; falta asignarle número de migración (no `V38`/`V39`, reservadas) y dueño.

## 12. Cierre de la fase 3 — frontend (2026-09-05, fase 3-B)

**I-01…I-12 CERRADAS**, cada una con prueba ejecutada y verificada por el orquestador (en la mayoría,
saboteando el arreglo para ver la compuerta en rojo antes de aceptarla). **La fase NO queda
formalmente cerrada**: la revisión adversarial repetida dejó **dos altas nuevas**, una de ellas
crítica y en área prohibida (`handoffs/3b-adv.md`, `preguntas-abiertas.md`). 69 ADR resueltas: 68
aceptadas —cinco con matiz— y **una rechazada** (`ADR-3-8-06`, premisa caída).

### 12.1 La compuerta del lienzo (A1-A8) ahora está medida sobre el PRODUCTO
`ADR-3-0b-01` declaró «A4 = 8/8» midiendo sobre `spikes/canvas-gate`. En `apps/web` **era 7/8** y
nadie lo veía: la única aserción sobre `script-src` era un `console.warn`. Queda enmendada por
`ADR-3B-I03-02`. Hoy `e2e/lienzo-csp.spec.ts` afirma **cero violaciones de cualquier directiva** por
igualdad (`TOLERADAS = []`), más una prueba que inyecta un `<script>` bloqueado para demostrar que el
recolector no es decorativo, más una tercera que mide A4 **con el lienzo realmente pintado**.
La causa del `eval` de Zod era de orden de evaluación —Turbopack funde `common.ts` con el chunk de
Zod—, y se cierra **sin tocar la CSP** (`ADR-3B-I03-01`).

### 12.2 Presupuestos, medidos y con su margen real
- **JS de primera carga de `/i/[publicToken]`: 144,2 KB gz** de 150 → **5,8 KB de margen**.
- **LCP: mediana 2.241 ms**, rango 2.185–2.255, **N=9, 0 descartadas**, máquina tranquila
  (`scripts/measure-lcp.sh`, `ADR-3B-I11-01`). El protocolo es ahora parte del contrato: comprobar
  que el puerto es propio (falla con código 3 si no lo es), N=9, descartar `NO_LCP`, reportar
  **mediana y rango**. Una medición sin rango no es citable.
- Kotlin **1.256** pruebas · 0 fallos · 0 omitidas · cobertura 93,60 % líneas / 80,21 % ramas.
- TypeScript **1.535** (527 esquema · 653 secciones · 355 web). e2e **50/50**. `smoke.sh` **19/19**.

### 12.3 Ruta nueva
**`PUT /editor/invitations/{invitationId}/event`** con cuerpo `{date, time}` (`ADR-3B-I06-01`).
Autoriza con `HierarchyValidationService.validateInvitationAccess`, escribe **sólo** `invitation.date`
y `invitation.time` por SQL nativo (sin `InvitationEntity`, sin tocar el módulo antiguo), valida
`YYYY-MM-DD` / `HH:mm` —el formato que impone `DateFormatting`, porque el módulo antiguo **no valida
nada**— y **no invalida el release**: lo marca desactualizado y la clienta republica.

### 12.4 WCAG se mide sobre lo RENDERIZADO, no sobre parejas de tokens
`axe` devuelve **exactamente lo mismo** sobre un producto que cumple y uno que no cuando hay
degradados: `violaciones=0 · incompletas=[color-contrast]`. Su `incomplete` no es un aprobado, y tres
de las cinco altas de la adversarial original vivían en ese hueco. `contraste-plantillas.test.ts`
compone ahora la pila real —fotografía → velo → papel, leyendo las paradas del `.module.css`— y
**deriva el umbral del `clamp` de `tokens.css`** (4,5:1 texto normal, 3,0 sólo donde el `px` computado
lo justifica). Prohibido bajar un umbral para que pase: se corrige el diseño.
La portada resuelve la legibilidad **por separación** (papel opaco bajo el texto), no lavando la
imagen: `ADR-3-i05b-01`.

### 12.5 Excepciones autorizadas por el dueño en esta fase
1. Exponer `manifest` + `theme` en `GET .../document` (fase 3, `ADR-3-4b-01`).
2. **`modules/templates2`** para I-01, I-06 y I-09.
3. **`modules/auth`**, acotada a I-02 (`ADR-3B-I02-01`): límite de intentos y hash señuelo en
   `POST /auth/token`. **Sólo eso.** La toma de cuenta por `/auth/request-password-reset` (N-01)
   quedó SIN arreglar por respetar ese límite.

### 12.6 Trampas del entorno que cuestan una medición si no se saben
- **`./gradlew clean` borra `build/`, que es el almacén local de assets.** La base sigue apuntando a
  esos ficheros: el render responde `200` y **ninguna imagen carga**. Contaminó una pasada entera de
  e2e (10 fallos ajenos al código). `evidencia/fase-3/trampa-gradle-clean.md`.
- **`e2e/preparar.ts` cae por defecto a `invitaciones_dev`**: si el backend sirve otra base, los
  ayudantes crean invitaciones donde nadie las lee. Exporta siempre `TPL_DEV_DB`.
- **Un paquete que cambia de bytes** da `409 TPL_VERSION_HASH_MISMATCH` al re-registrarse, y **es el
  comportamiento correcto**: una versión publicada nunca se pisa. Para producción hay que subir la
  versión del paquete.

## 13. Sistema de diseño (fase 3-C)

Fuente: `diseno/11-sistema-de-diseno.md` (especificación a grado de implementación) y la guía de uso
`guias/identidad-visual.md`. Ámbito: el **producto** (chrome del editor, web pública, acceso,
catálogo, publicación, y cualquier módulo futuro). **Nunca** las plantillas de invitación
(`packages/sections`, tokens `--inv-*`), que conservan su propio sistema. Paleta elegida:
**Bugambilia** (ADR-3C-0-01..06, `propuesta`); tipografía: **Fraunces + Onest + Red Hat Mono**
(mismas ADR). El cierre formal de estas ADR y del resto de la fase (aceptar/rechazar en este
archivo) lo hace el orquestador, no este bloque.

### 13.1 Paquetes y sus puntos de entrada
- **`@invitaciones/tokens`**: `.` (barril TS: `paletas.ts`, `semantica.ts`, `contraste.ts`,
  `tipografia.ts`, `espacio.ts`, `movimiento.ts`, `css.ts`, `oklch.ts`), `/tokens.css` →
  `generated/tokens.css` (`:root {--ui-*}` y `[data-theme="dark"] {--ui-*}`, byte a byte lo que emite
  `scripts/emit-css.ts` desde el TS — `test/css-generado.test.ts` lo compara, editar el CSS a mano se
  pone rojo), `/tailwind.css` → `generated/tailwind.css` (`@theme inline`, **solo** roles semánticos:
  `bg-ui-primary`, `text-ui-on-primary`, `ring-ui-focus`, `font-ui-display`, `text-ui-display-xl`…;
  nunca un paso de escala como utilidad, `11 §8.2`). `pnpm run verify-contrast` rompe con **código 1**
  si una de las 42 parejas baja de su umbral; engancha a `build`/`prepack`.
- **`@invitaciones/ui`**: `.` (componentes + formas + ilustraciones + fuentes + metadatos de
  historias, seguro para Server Components), `/shapes` (`Rays`, `Stripes`, `WaveDivider`, `Blob`,
  `Triangle`, `RotatedSquare`, `Pill`, `Seal`, `ColorShadow`, `Image`, `Placeholder`, `Composition` +
  la geometría determinista `blob()`/`sello()`/`rayos()`), `/historias` (registro completo con
  `render()` — **solo** desde componentes cliente, ver antipatrón en `guias/identidad-visual.md §9`),
  `/estilos.css` (fuentes autoalojadas + utilidades tipográficas + `shapes.css` +
  `componentes.css`), `/componentes`, `/componentes/*`, `/fonts/preload.ts`, `/ilustraciones/*`.
  Base accesible Radix; aspecto propio con `class-variance-authority`.
- **`@invitaciones/icons`**: `.` (barril generado: 82 componentes `IconoNombre` PascalCase + `Icon`
  genérico por `name`/`IconName` + `iconNames`). Fuente en `svg/*.svg` (retícula 24, margen 1,5,
  trazo 1,75 redondeado, `fill="none"` en el trazo, segundo tono por `var(--tono)`); `scripts/
  generar.ts` (sin `@svgr/core`, ADR-3C-3-01) valida y regenera `src/generated/*.tsx`, `src/index.ts`
  e `inventario.json` — nunca a mano.
- **Consumo en `apps/web`**: `app/(chrome)/globals.css` importa, en orden, `tailwindcss` →
  `@invitaciones/tokens/tokens.css` → `@invitaciones/tokens/tailwind.css` →
  `@invitaciones/ui/estilos.css`, más `@source "../../../../packages/ui/src"` (Tailwind 4 no mira
  `node_modules`; sin esto, 28 de 51 utilidades `*-ui-*` del paquete no se generaban, hallazgo de la
  revisión del bloque 2). **Capa de compatibilidad, en el mismo fichero, retirable**: puente de
  nombres viejos (`bg-ui-bg`, `text-ui-ink-heading`, `font-ui-sans`, `text-ui-eyebrow`/`aux`/`body`/
  `card`/`title`/`section`/`display`…) para las pantallas que la fase 3 no había migrado; los nombres
  que ya existen en el preset nuevo con el mismo significado NO se redefinen ahí, ganan directo.

### 13.2 Tokens semánticos — los 46 roles de color (`--ui-*`, `packages/tokens/src/semantica.ts` `ROLES_COLOR`)
`surface`, `surface-raised`, `surface-alt` · `ink`, `ink-muted`, `ink-placeholder` · `border`,
`divider` · `primary`, `on-primary`, `primary-hover`, `primary-soft`, `on-primary-soft`,
`primary-bright`, `link` · `accent`, `on-accent`, `accent-soft`, `on-accent-soft` · `success`,
`on-success`, `success-text`, `success-soft`, `on-success-soft` · `danger`, `on-danger`,
`danger-text`, `danger-soft`, `on-danger-soft` · `warning`, `on-warning`, `warning-text`,
`warning-soft`, `on-warning-soft` · `info`, `on-info`, `info-text`, `info-soft`, `on-info-soft` ·
`focus` · `support-1`, `support-1-soft`, `support-1-deep` · `support-2`, `support-2-soft`,
`support-2-deep`. Cada uno resuelve a un paso de escala distinto en claro y en oscuro (`11 §1.3`); el
tema es un mapa completo (`data-theme="dark"` en `<html>` o cualquier ancestro), ningún componente
sabe en qué tema está. Tokens no cromáticos: radios `control`/`card`/`media`/`hero`/`pill` (8/14/24/
36/pill), sombras `1`/`2`/`color` (tintadas de cacao; la de color es `8px 8px 0 0 var(--ui-support-2)`
y va una por vista, nunca mezclada con difusa), contenedor `--container-ui-page` (1200 px), tres voces
tipográficas `font-ui-{display,text,label}` con 15 roles de tamaño (`display-2xl`…`label-sm`, cada
uno con `line-height`/`letter-spacing`/`font-weight` como modificadores propios), duraciones y curvas
con nombre (`--ui-dur-{1,2,3,4,respira}`, `--ease-ui-{out,in-out,spring,linear}`).

### 13.3 Reglas duras y sus compuertas mecánicas
| regla | compuerta |
|---|---|
| Cero emojis en interfaz/textos/iconos/docs de usuario | grep por code point de emoji sobre `frontend/**` (sin script dedicado; comando verificado en `guias/identidad-visual.md §8`) |
| Cero hex sueltos fuera de `tokens/src/paletas.ts` | `grep -rn "#[0-9a-f]\{6\}"` sobre cada paquete |
| `--ui-` nunca fuera de `app/(chrome)/**`; `--inv-` nunca dentro | `apps/web/test/tokens-no-leak.test.ts` (grep de cadenas); su gemelo en el sentido inverso, `packages/tokens/test/frontera.test.ts` |
| 42 parejas de color con su umbral (4,5 texto normal · 3,0 gráfico: borde, foco, icono de acción) | `packages/tokens/scripts/verify-contrast.ts` — 3 paletas × 2 temas × 42 parejas = 252 filas, 240 con umbral, 0 fallos (`11 §1.6`, re-verificado por `3c-1`); rompe `build`/`prepack` con código 1; el anillo de foco nunca se mide contra `primary` porque lleva halo de 2 px de `surface`, así que esa pareja no existe por diseño |
| Contraste sobre la **pila renderizada**, no sobre tokens | `apps/web/e2e/design-contraste.spec.ts` (galería) y `e2e/util/contraste.ts` reutilizado en `e2e/a11y-producto.spec.ts` (landing/acceso/editor reales); `axe` NO es compuerta de contraste (su `incomplete` no es un aprobado) |
| a11y del producto | `e2e/design-axe.spec.ts` (galería) y `e2e/a11y-producto.spec.ts` (violations vacío de cualquier impacto sobre pantallas reales) |
| Objetivo de toque ≥ 24 px, foco no obstruido | `e2e/design-objetivos.spec.ts` |
| CSS generado, nunca editado a mano | `packages/tokens/test/css-generado.test.ts` (comparación byte a byte) |
| Movimiento apagado con `prefers-reduced-motion` | utilidades de movimiento emitidas solo dentro de `@media (prefers-reduced-motion: no-preference)` |

### 13.4 Galería `/design` y regresión visual en CI
`apps/web/app/(chrome)/design/**`: índice, `/design/tokens` (paletas/semántica/tipografía/espacio/
movimiento, conmutador claro-oscuro), `/design/tipografia`, `/design/formas`, `/design/iconos`
(inventario con buscador), `/design/componentes/[slug]` (todas las variantes y estados de cada
componente, con controles). Config Playwright aparte (`playwright.design.config.ts`, proyecto
`design`, puerto 3133, **sin backend**: `next build && next start` puro) corre cuatro specs —
`design.spec.ts` (regresión visual, `toHaveScreenshot` con `maxDiffPixelRatio: 0.001`, 390 y 1440,
claro y oscuro, más medición de desborde de ficha y de recorte de vitrina de superposición),
`design-contraste.spec.ts`, `design-axe.spec.ts`, `design-objetivos.spec.ts`. Referencias committeadas
en `e2e/design.spec.ts-snapshots/`; se regeneran con `pnpm --filter web exec playwright test
--config=playwright.design.config.ts --project=design --update-snapshots` (`handoffs/3c-b2-f3.md`).
Un `Dialog`/`Sheet` de historia se expone dentro de `EscaparateSuperposicion`
(`packages/ui/src/historias/escaparate.tsx`, `modal={false}`), nunca abierto suelto: modal real rompe
`aria-hidden`, bloquea el conmutador de tema y tapa la página con `position: fixed`.

### 13.5 Cifras finales del cierre (bloque 3, re-ejecutadas al final con el código ya arreglado)
- **Web**: `pnpm run test`/`typecheck`/`lint`/`build`, 10/10 tareas cada gate — **517/517** pruebas
  (64 ficheros, 77,16 % sentencias), `lint` 0 errores (1 aviso preexistente ajeno), `build` 39 páginas
  (`handoffs/3c-8.md §1`, re-ejecutado sin cambio en `3c-8.md §3C-8b`).
- **e2e** (`playwright test --project=chromium`, backend real): **70/70** en verde, incluidos los dos
  presupuestos que habían quedado rojos (`handoffs/3c-8.md §3C-8b`; el estado intermedio, ya
  superado, era 68/70 — `§1`).
- **Galería `/design`** (proyecto Playwright `design`): **279/279** (`handoffs/3c-8.md §1`;
  coincide con la doble corrida de la revisión del bloque 2, `tablero.md` fase 3-C fila b2-rev).
- **`scripts/smoke.sh`**: **19/19 OK** (`handoffs/3c-8.md §1`).
- **`e2e/a11y-producto.spec.ts`**: 0 violaciones de cualquier impacto (`handoffs/3c-8.md §2.4`).
- **Presupuesto de JS** (`check-budget.mjs`, límite 150 KB gz salvo el editor): `/i/[publicToken]`
  **142,0 KB** (margen 8,0) · `/` **148,2 KB** (margen 1,8 — ajustado, una foto o icono nuevo en la
  portada puede volver a excederlo) · `/editor/[invitationId]` **419,3 KB** de 600 (margen ~181)
  (`handoffs/3c-8.md §3C-8b`).
- **LCP** (`measure-lcp.sh`, `devtools`, N=9, 0 descartadas): `/i/[publicToken]` mediana **1 998,4 ms**
  (rango 1 975,4–2 013,7) → CUMPLE (< 2 500) · `/` mediana **1 761,9 ms** (rango 1 723,9–1 813,5) →
  CUMPLE (`handoffs/3c-8.md §1`).
- **Grep de cierre** (`frontend/**` emojis por code point; `apps/web` `lucide-react` y
  `components/ui/`): **0, 0, 0** (`handoffs/3c-8.md §1`; `bitacora/3c-8.md` línea 135).
- Cifras de bloque, para contexto (`tablero.md` fase 3-C): `verify-contrast` 252 filas/0 fallos
  (3c-1) · iconos 179/179 pruebas, 82/82 nombres (3c-3a/b) · formas 111 pruebas, 100 % líneas (3c-4) ·
  componentes F1 525 · F2 465 · F3 26 historias registradas (b2-f1/f2/f3) · web pública 435 pruebas,
  `/` 148,1 KB gz antes del ajuste de 3C-8b (3c-5) · editor 388 pruebas, e2e propio 28/28 (3c-7) ·
  catálogo/asistente 473 pruebas, e2e propio 32/32, `/editor` 326 KB gz (3c-6).

### 13.6 Revisiones del cierre
`**Calidad visual (`handoffs/3c-cv.md`): NO CUMPLÍA como llegó (4 altas de ejecución: iconos `mono` macizos, nombres truncados en el panel de secciones, `WizardProgress` partiendo palabras, error en inglés) y CUMPLE tras corregirlas en `1b978ba`; 51 capturas en tres viewports en `evidencia/fase-3c/cierre/visual/`; medias de composición listadas sin tocar.**` `**Verificación final sobre el HEAD del cierre (`0f68f4d`): e2e 79/79 contra backend real, galería 279/279, suite 10/10 (web 567), 51 capturas finales en `evidencia/fase-3c/cierre/final/`.** **Recorrido de UX sin instrucciones (`handoffs/3c-ux.md`): NO al llegar (dos muros antes del editor y seis graves) y corregido en el cierre por UX-A (asistente: paso 1 siempre con salida, guardado del lugar sin 422, `?tipo=` respetado; e2e 8/8), UX-B (editor: revisión previa con fechas coherentes y contenido de ejemplo visible, estado Publicada con Compartir, diálogo con scroll; e2e 11/11) y UX-C (sitio: contacto para contratar configurable por `NEXT_PUBLIC_CONTACTO_WHATSAPP`/`_CORREO`, mensajes reales de contraseña; e2e 14/14, portada 148,2 KB). Queda para el dueño el contacto real y si el contenido de ejemplo opcional debe bloquear la publicación.**` `**Adversarial de a11y y rendimiento (`handoffs/3c-adv.md`): CERRABLE tras A-01 (las fuentes daban 404 en los tres caminos de servicio; ahora se copian en el build de `web` con compuerta por HTTP) y A-02 (objetivos < 24 px en marca, enlace de salto y «Volver»); contraste 0 fallos en 9 pantallas con sabotaje que tumba la compuerta; LCP `/i` mediana 2 202 ms y `/` 1 845 ms bajo carga; e2e 71/71, galería 279/279, 2 585 pruebas; medias sin arreglar: foco en «Cómo llegar» (zona de plantillas), `contraste.ts` no ve capas hermanas, `CDN_ORIGIN` fijo al 6003.**` — al escribir esta sección
(2026-09-06) los handoffs `memoria/handoffs/3c-cv.md`, `3c-ux.md` y `3c-adv.md` **no existen todavía**
(`tablero.md` fase 3-C, fila «Cierre: revisiones, guía, memoria, handoff» = **pendiente**). El
orquestador rellena este párrafo con sus hallazgos y cifras (contraste visual/UX, adversarial) citando
el fichero de cada uno cuando los lance y cierre.
