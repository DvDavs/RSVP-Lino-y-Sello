# 03 — API del editor y del render público

Autor: fase 1, rol `1-api`. **Revisado y profundizado a grado de implementación por `1R-backend` (ronda 1R, 2026-09-03).** Estado: propuesto para aceptación (ADR-013…016, ADR-1R-B-01…ADR-1R-B-14).
Evidencia: `handoffs/0-resumen-auditoria-api.md`, `fases/D-consumo.md`, `01-dominio-y-esquema.md`, `02-persistencia-y-catalogo.md`, `handoffs/1-aura-lecciones.md`, y **lectura directa del código real** citada en §13.

> **Cómo leer este documento.** §2 es el índice de rutas. §3 es el contrato completo de cada ruta (una subsección por ruta: método, path, auth, límites, petición, respuesta, errores, idempotencia). §5 es la tabla de errores. §9 es la matriz de autorización ruta × rol y los ataques de inyección de ids. §10 fija exactamente cómo se integra con el `GeneralExceptionHandler` real. §12 enumera los casos de prueba. §15 es la tabla de objeciones de la ronda 1R.

---

## 1. Principio de diseño

Tres superficies separadas por autorización y por caché (ADR-013): **edición** (autenticada, documento de trabajo mutable), **publicación** (autenticada, produce un `tpl_release` inmutable) y **render público** (sin auth, lee solo `tpl_release`, cacheable, nunca toca `tpl_document`). El invitado nunca dispara composición ni toca la tabla mutable — corrige de raíz H-04/H-05 y adopta la lección de aura.build de publicación como artefactos precompilados (`handoffs/1-aura-lecciones.md` #3).

Todas las rutas autenticadas de invitación exigen `HierarchyValidationService.validateInvitationAccess(requesterId, invitationId)` (ADR-015, `core/auth/service/HierarchyValidationService.kt:42-71`) antes de tocar cualquier tabla `tpl_*`. `invitationId` viene siempre de la ruta; ningún cuerpo acepta un id de documento, snapshot, release, plantilla o asset ajeno — todo se resuelve por el `invitationId` ya autorizado (mata H-13 por construcción; ataques concretos en §9.2).

**Cómo se obtiene el `requesterId`** (verificado, no inventado): `JwtTokenFilter` (`core/auth/security/JwtTokenFilter.kt:41-72`) valida el token, carga el `customer`, rechaza deshabilitado/baneado y coloca un `CustomerDetails(id, email, …)` como *principal*; los controladores reciben `authentication: Authentication` y extraen el id con la extensión existente `authentication.userId()` (`modules/admin/users/ktx/_AuthenticationExt.kt:7-8`). `templates2` usa exactamente ese camino, sin añadir uno propio.

## 2. Tabla de rutas

| # | Método y ruta | Auth | Qué hace | Respuesta 2xx |
|---|---|---|---|---|
| 1 | `GET /editor/templates2/catalog` | autenticada | Catálogo de plantillas publicadas visibles para el plan | `200 CatalogResponse` |
| 2 | `POST /editor/invitations/{invitationId}/document:choose-template` | invitación | Crea el documento o cambia de plantilla/versión | `201`/`200 ChooseTemplateResponse` |
| 3 | `GET /editor/invitations/{invitationId}/document` | invitación | Documento de trabajo + vista compuesta actual | `200 DocumentResponse` |
| 4 | `POST /editor/invitations/{invitationId}/document/operations` | invitación | Aplica un lote de operaciones (reductor único, ADR-014) | `200 OperationBatchResponse` |
| 5 | `GET /editor/invitations/{invitationId}/document/history` | invitación | Historial paginado de snapshots | `200 HistoryPageResponse` |
| 6 | `POST /editor/invitations/{invitationId}/document/restore` | invitación | Restaura una revisión pasada como revisión nueva | `200 RestoreResponse` |
| 7 | `POST /editor/invitations/{invitationId}/assets` | invitación | Sube un asset del cliente (cuerpo binario) | `201`/`200 AssetUploadResponse` |
| 8 | `GET /editor/invitations/{invitationId}/assets` | invitación | Lista los assets de la invitación | `200 AssetListResponse` |
| 9 | `DELETE /editor/invitations/{invitationId}/assets/{assetId}` | invitación | Borra un asset no referenciado | `204` |
| 10 | `GET /editor/invitations/{invitationId}/release/preflight` | invitación | Reglas de publicación sin publicar | `200 PreflightResponse` |
| 11 | `POST /editor/invitations/{invitationId}/release` | invitación | Publica: congela `composed` en un `tpl_release` | `201`/`200 ReleaseResponse` |
| 12 | `DELETE /editor/invitations/{invitationId}/release` | invitación | Despublica: desactiva el release activo | `204` |
| 13 | `GET /editor/invitations/{invitationId}/releases` | invitación | Historial de publicaciones | `200 ReleaseListResponse` |
| 14 | `POST /editor/invitations/{invitationId}/public-token:rotate` | invitación | Rota el enlace público (revoca el anterior) | `200 {publicToken, publicUrl}` |
| 15 | `GET /public/i/{publicToken}/render` | **ninguna** | Documento renderizable del release activo | `200 RenderResponse` / `304` |
| 16 | `GET /public/i/{publicToken}/exists` | **ninguna** | Sonda liviana para el editor | `200 {published}` |
| 17 | `POST /master/templates2/versions` | rol `MASTER` | Registro de plantilla, único camino de alta | `201`/`200 RegisterTemplateResponse` |
| 18 | `GET /master/templates2/versions` | rol `MASTER` | Lista versiones registradas y su auditoría | `200` |
| 19 | `POST /master/templates2/versions/{templateVersionId}:deprecate` | rol `MASTER` | Marca `status = 'deprecated'` | `200` |
| 20 | `PUT /editor/invitations/{invitationId}/event` | invitación | Cambia la fecha (y opcionalmente la hora) del evento en `invitation` | `200 EventResponse` |

La ruta 20 es **nueva de la fase 3-B** (issue I-06, `ADR-3B-I06-01`): hasta ella **ninguna ruta de cliente escribía `invitation.date`** — sólo `PUT /admin/invitations/{id}`, rol ADMIN (`InvitationAdminService.kt:414`) — y la clienta no podía cambiar la fecha de su propio evento por ninguna vía, que era el tercer verbo del criterio de terminado (U-3).

Rutas 12, 14, 8, 9, 1, 18 y 19 **son nuevas de la ronda 1R**; el borrador no tenía forma de despublicar, de revocar un enlace filtrado, de listar o borrar assets, de listar el catálogo ni de deprecar una versión — huecos que fase 2 habría tenido que inventar (objeción **A-01**).

**Forma canónica de la ruta pública (X-08):** `/public/i/{publicToken}/render`, tal como la fijan esta tabla, `contratos.md` §4, `02 §7` (`PublicRenderController.kt`) y `04 §15`. La forma `/public/invitations/{token}/render` que aparece en el texto de ADR-013 es la del borrador y queda **enmendada**: no existe en ningún documento de diseño ni en ningún ejemplo.

`publicToken` es `tpl_document.public_token` (`02 §2` V32), nunca `invitationId`. El editor obtiene `publicUrl` (`{app.frontend.url}/i/{publicToken}`, propiedad ya existente en `application.yml:71-73`) en la respuesta de las rutas 3, 11 y 14.

**Encaje con `SecurityConfig` real** (`core/auth/security/SecurityConfig.kt:36-48`, verificado):
- `/master/**` → `hasRole("MASTER")` (línea 44). La ruta 17 queda protegida por la configuración existente; ADR-033 se confirma con el código.
- `/public/**` → `permitAll()` (línea 38). Las rutas 15 y 16 quedan abiertas sin tocar nada.
- **`/editor/**` no aparece en ninguna regla**: cae en `anyRequest().authenticated()` (línea 47). Es decir, hoy quedaría accesible a cualquier usuario autenticado de cualquier rol, y la única barrera sería `HierarchyValidationService`. Como `SecurityConfig` es código del núcleo que este módulo **no puede tocar**, la defensa en profundidad se añade **dentro** de `templates2` con `@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")` a nivel de clase en cada controlador de `/editor/**` — posible porque `@EnableMethodSecurity` ya está activo (`SecurityConfig.kt:17`). Objeción **A-02**, cerrada sin tocar el núcleo.

## 3. Contrato completo por ruta

Convenciones comunes: todas las respuestas son `application/json; charset=UTF-8`; todos los errores usan el cuerpo de §10.2; todos los `Long` de ruta son el `id` de `invitation`; `Idempotencia` describe qué ocurre al repetir exactamente la misma petición.

### 3.1 `GET /editor/templates2/catalog`

- **Auth**: autenticada (`@PreAuthorize` de §2). No hay invitación que autorizar; el catálogo es común.
- **Query**: `eventKind` (opcional, uno de `esquema/common.ts` `EventKind`), `planTier` (opcional 1-3), `limit` (≤ 50, por defecto 20), `cursor`.
- **Límite**: sin cuerpo.

```jsonc
// 200
{
  "items": [
    { "slug": "boda-clasica", "version": "1.0.0", "name": { "es-MX": "Boda clásica" },
      "eventKinds": ["wedding"], "minPlanTier": 1, "previewUrl": "https://…/preview.webp",
      "capabilities": ["hashtags","music"], "status": "published" }
  ],
  "nextCursor": null
}
```
- **Errores**: ninguno propio. **Idempotencia**: lectura pura.

### 3.2 `POST /editor/invitations/{invitationId}/document:choose-template`

- **Auth**: `validateInvitationAccess`. Además: `invitation.uses_templates2 = true` **o** la invitación no tiene `invitation_configs` (invitación nueva) — si no, `409 TPL_NOT_MIGRATED` (`02 §6`).
- **Límite**: cuerpo ≤ 8 KiB.

```jsonc
// request
{ "templateSlug": "boda-clasica", "templateVersion": "1.0.0", "baseRevision": 12 }
```
`baseRevision` es **obligatorio** si el documento ya existe y **se omite** en la primera creación. Es una corrección de la ronda 1R: sin él, cambiar de plantilla desde una pestaña con estado viejo pisaba en silencio lo que otra pestaña acababa de guardar (objeción **A-03**).

```jsonc
// 201 — primera vez: documento nuevo (structure = defaultOrder del manifiesto, content = {})
{
  "revision": 0,
  "created": true,
  "document": { "schemaVersion": 1, "template": {"slug":"boda-clasica","version":"1.0.0"},
                "theme": {"paletteId":"blush","fontSetId":"serif-elegante"},
                "structure": {"sections":[{"key":"cover","variant":"full","visible":true}]},
                "content": {}, "attic": {}, "meta": {"locale":"es-MX"} },
  "composed": { "composedVersion": 1, "…": "…" },
  "report": { "missingRequired": [], "stillDefault": [], "orphanContent": [], "orphanSections": [],
              "invalidValues": [], "themeFallback": null },
  "movedToAttic": [],
  "publicToken": "pub_01J8ZQ2K3M4N5P6R7S8T9V0W1X",
  "publicUrl": "https://app.example.com/i/pub_01J8ZQ2K3M4N5P6R7S8T9V0W1X"
}
// 200 — ya existía documento con OTRA plantilla: content actual va a attic["<slugAntiguo>@<versionAntigua>"],
//       content nuevo vacío; `movedToAttic` lista los blockId afectados.
// 200 — ya existía CON LA MISMA plantilla y otra versión: aplica el MigrationPlan de
//       tpl_template_version.migration_plans (02 §2 V30) con simulación previa obligatoria.
```
- **Errores**: `404 TPL_TEMPLATE_VERSION_NOT_FOUND` (no existe, o `deprecated` y se pide para un documento nuevo) · `403 TPL_PLAN_TIER_INSUFFICIENT` · `409 TPL_MIGRATION_PLAN_MISSING` · `409 TPL_REVISION_CONFLICT` · `409 TPL_NOT_MIGRATED` · `403 TPL_FORBIDDEN` · `422 TPL_DOCUMENT_TOO_LARGE`.
- **Idempotencia**: repetir con el mismo `slug@version` cuando el documento ya está en esa versión es un **no-op** que devuelve `200` sin incrementar `revision` ni crear snapshot.

### 3.3 `GET /editor/invitations/{invitationId}/document`

- **Auth**: `validateInvitationAccess`. **Límite**: sin cuerpo.

```jsonc
// 200
{
  "document": { "schemaVersion": 1, "template": {…}, "theme": {…}, "structure": {…},
                "content": {…}, "attic": {…}, "meta": {"locale":"es-MX"} },
  "revision": 42,
  "templateVersion": { "slug": "boda-clasica", "version": "1.0.0", "status": "published" },
  // El paquete de la versión de plantilla vigente, tal cual lo guardan `tpl_template_version.manifest`
  // y `.theme` (ADR-3-4b-01, fase 3). Es lo que el editor necesita para EDITAR, no sólo para pintar.
  "manifest": { "manifestVersion": 1, "slug": "boda-clasica", "version": "1.0.0", "name": {…},
                "sections": [ { "key": "cover", "type": "cover", "title": {…},
                                "variants": ["full","framed"], "defaultVariant": "full",
                                "required": true, "defaultVisible": true,
                                "blocks": [ { "id": "cover.title", "type": "text", "role": "coverTitle",
                                              "label": {…}, "required": true, "editable": true,
                                              "source": "user", "aiEditable": true,
                                              "constraints": {"minLength":1,"maxLength":60,"multiline":false} } ] } ],
                "assets": […], "migrationsFrom": [] },
  "theme": { "palettes": [ {"id":"blush","name":{…},"tokens":{"bg":"#FDF7F5", …}} ],
             "fontSets": [ {"id":"serif-elegante","name":{…},"heading":{…},"body":{…}} ],
             "defaultPaletteId": "blush", "defaultFontSetId": "serif-elegante" },
  "composed": { "composedVersion": 1, "template": {…}, "locale": "es-MX", "theme": {…}, "sections": […] },
  "report": { "missingRequired": [], "stillDefault": ["couple.brideText"], "orphanContent": [],
              "orphanSections": [], "invalidValues": [], "themeFallback": null },
  "publicToken": "pub_01J8…",
  "publicUrl": "https://app.example.com/i/pub_01J8…",
  "activeRelease": { "releaseId": 7, "publishedAt": "2026-09-01T18:00:00Z",
                     "contentHash": "sha256:3f…", "stale": true, "staleReason": ["business.date"] }
}
```
`composed` se calcula en cada `GET` (`compose()`, ADR-007) — nunca se lee de una tabla; el `BusinessSnapshot` se toma de `invitation` en la misma transacción de lectura. `stale` se calcula comparando `tpl_release.business_snapshot` congelado con el actual (`02 §2` V34), sin recomponer el release.

`manifest` y `theme` (**añadidos en la fase 3, ADR-3-4b-01**) son el `TemplateManifest` y el `ThemeSpec` **completos** de la versión de plantilla que esta invitación usa, sin filtrar ni transformar (P1, P3): salen de `version.pkg` con `DomainJson.encode`, el mismo códec que ya emite `document`/`composed`/`report`, y validan contra los punteros `template-manifest` y `theme` del esquema compartido. Sin ellos el editor podía **pintar** pero no **editar**: el `ComposedDocument` lleva `label`, `role`, `type`, `provenance` y `value` por bloque, pero no `BlockSpec.constraints` (`maxLength`, `multiline` — escenario **U-17** de `04 §20.1`), ni las opciones de un bloque `choice`, ni `SectionSpec.required` (**U-18**: sin él, ocultar una sección obligatoria sólo se descubría fallando con `TPL_SECTION_REQUIRED`), ni `SectionSpec.variants`, ni el catálogo de paletas y conjuntos tipográficos — `composed.theme` es el tema **ya resuelto**, no los presets entre los que elegir. Duplicar el manifiesto en el frontend habría reintroducido H-27 y roto P4. Son **campos aditivos**, no una ruta nueva: siguen siendo 19 rutas y `Templates2RouteInventoryTest` no cambia; y van aquí, no en `GET /editor/templates2/catalog`, porque el editor necesita el manifiesto de la plantilla de **esta** invitación, no el catálogo entero.
- **Errores**: `404 TPL_DOCUMENT_NOT_STARTED` · `403 TPL_FORBIDDEN` · `409 TPL_NOT_MIGRATED`.
- **Idempotencia**: lectura pura; **no** crea el documento (la creación perezosa la hace `:choose-template`, no un `GET` — así el orden de operaciones queda explícito y H-39 no puede repetirse).

### 3.4 `POST /editor/invitations/{invitationId}/document/operations`

- **Auth**: `validateInvitationAccess`.
- **Límites**: cuerpo ≤ **768 KiB** (ADR-032, §8); `operations` entre 1 y 50 (`esquema/operations.ts` `OperationBatch.operations`); documento resultante ≤ 1 MiB (`02 §2` V32).
- **Cuerpo**: `OperationBatch` **exactamente** como `esquema/operations.ts` `OperationBatch` — `{baseRevision, clientBatchId, operations[]}`, `z.strictObject` (ninguna clave extra).

```jsonc
// request
{
  "baseRevision": 42,
  "clientBatchId": "b_7fA3-91xQz20",
  "operations": [
    { "op": "setBlock", "blockId": "cover.title", "value": { "kind": "text", "value": "Ana & Luis" } },
    { "op": "addItem", "groupId": "gallery.photos", "tempId": "tmp:a1b2c3d4",
      "values": { "photo": { "kind":"image", "assetId":"as_01J8ZQ…", "alt":"", "focal":{"x":0.5,"y":0.4} } } },
    { "op": "setItemBlock", "groupId": "gallery.photos", "itemId": "tmp:a1b2c3d4",
      "blockId": "caption", "value": { "kind": "text", "value": "Primera cita" } },
    { "op": "setSectionVisible", "sectionKey": "story", "visible": false },
    { "op": "reorderSections", "order": ["cover","couple","event","gallery","rsvp"] }
  ]
}
```

```jsonc
// 200
{
  "revision": 43,
  "applied": true,
  "idMap": { "tmp:a1b2c3d4": "01J8ZQ2K3M4N5P6R7S8T9V0W1X" },
  "composed": { "composedVersion": 1, "…": "…" },
  "report": { "missingRequired": [], "stillDefault": [], "orphanContent": [], "orphanSections": [],
              "invalidValues": [], "themeFallback": null }
}
```

**Semántica (fijada, no descrita en prosa):**

1. **Todo o nada.** Se valida el lote completo antes de aplicar nada. Basta una operación inválida para rechazar el lote con `422 TPL_OPERATION_INVALID` y `details.operations = [{index, code, path}]`. (El pipeline de IA de `07` descarta operación por operación; esta ruta no.)
2. **Resolución de `tempId` dentro del lote.** `addItem` declara `tempId`; las operaciones posteriores del **mismo** lote pueden referirse a ese ítem por su `tempId` (`AnyItemId`, `esquema/operations.ts` `AnyItemId` / `setItemBlock`). El servidor mantiene un mapa `tempId → ULID` durante la aplicación y lo devuelve en `idMap`. Un `tempId` no declarado por ningún `addItem` previo del lote → `422 TPL_TEMP_ID_UNRESOLVED`. Un `tempId` repetido en dos `addItem` del mismo lote → `422 TPL_TEMP_ID_DUPLICATE`. **Esto no estaba especificado** y el esquema lo permite (objeción **A-04**).
3. **Propiedad de `assetId` (ADR-030).** Toda operación que porte un `ImageValue`/`AudioValue` se valida por pertenencia: `SELECT 1 FROM tpl_asset WHERE public_id = ? AND (invitation_id = :invitationId OR template_version_id = :templateVersionId)`. Sin fila → `422 TPL_ASSET_NOT_OWNED`, lote completo rechazado. La consulta se hace **en bloque** (un `IN` con todos los `assetId` del lote), no una por operación.
4. **Bloques no escribibles.** Una operación sobre un `blockId` con `source != "user"` → `422 TPL_BLOCK_NOT_EDITABLE`, con `details.source` = `"business"` o `"fixed"` (invariante `I-21`, `esquema/invariants.ts` `validateDocument`, rama `spec.source !== "user"`). Una operación sobre un `blockId` no declarado → `422 TPL_BLOCK_UNKNOWN`.
5. **Revisión optimista.** `baseRevision ≠ tpl_document.revision` → `409 TPL_REVISION_CONFLICT` con `{currentRevision, document, composed, report}` para que el cliente rebase sus operaciones pendientes. No hay merge automático.
6. **Idempotencia real (corrección 1R, objeción A-05).** El par `(document_id, clientBatchId)` es único (`02 §2` V33, `ux_tpl_document_snapshot_batch`). Si llega un lote cuyo `clientBatchId` ya produjo una revisión de este documento, **no se vuelve a aplicar**: se responde `200` con `applied: false`, la `revision` que ese lote produjo y el `idMap` guardado. Esto cubre el caso real que el borrador no cubría: timeout de red ⇒ el cliente reintenta con la **misma** `baseRevision`, que sigue siendo la vieja, y el chequeo de revisión **no** lo habría detenido. Ventana: la retención de snapshots (200 revisiones o 30 días, ADR-011); pasada esa ventana el lote se trata como nuevo y el chequeo de `baseRevision` lo detiene.
7. **Transacción.** Una sola: `SELECT … FOR UPDATE` del documento no es necesario (el `UPDATE … WHERE revision = ?` es suficiente), pero sí lo es que el `INSERT` del snapshot y el `UPDATE` del documento vayan juntos.

- **Errores**: `409 TPL_REVISION_CONFLICT` · `422 TPL_OPERATION_INVALID` · `422 TPL_BLOCK_UNKNOWN` · `422 TPL_ASSET_NOT_OWNED` · `422 TPL_ASSET_SPEC_MISMATCH` · `422 TPL_BLOCK_NOT_EDITABLE` · `422 TPL_TEMP_ID_UNRESOLVED` · `422 TPL_TEMP_ID_DUPLICATE` · `422 TPL_DOCUMENT_TOO_LARGE` · `413 TPL_BODY_TOO_LARGE` · `400 TPL_MALFORMED_JSON` · `403 TPL_FORBIDDEN` · `404 TPL_DOCUMENT_NOT_STARTED`.

### 3.5 `GET /editor/invitations/{invitationId}/document/history`

- **Auth**: `validateInvitationAccess`. **Query**: `limit` (≤ 100, por defecto 50), `cursor` (revisión desde la que seguir, descendente), `clientBatchId` (opcional: filtra por lote, para que el cliente confirme "¿se aplicó el mío?").

```jsonc
// 200
{ "items": [ { "revision": 43, "createdAt": "2026-09-03T12:00:00Z", "clientBatchId": "b_7fA3-91xQz20",
               "origin": "operations", "createdBy": 12 } ],
  "nextCursor": "42" }
```
- **Errores**: `403 TPL_FORBIDDEN` · `404 TPL_DOCUMENT_NOT_STARTED`. **Idempotencia**: lectura pura. Nunca devuelve el `doc` completo de cada snapshot (sería un cuerpo enorme); para eso está `restore`.

### 3.6 `POST /editor/invitations/{invitationId}/document/restore`

- **Auth**: `validateInvitationAccess`. **Límite**: cuerpo ≤ 8 KiB.

```jsonc
// request
{ "revision": 37, "baseRevision": 43 }
// 200
{ "revision": 44, "composed": {…}, "report": {…}, "movedToAttic": ["couple.groomText"] }
```
`baseRevision` es **obligatorio** (corrección 1R, `02 §11.3`): restaurar es una escritura como cualquier otra y debe fallar con `409 TPL_REVISION_CONFLICT` si otra pestaña escribió entretanto.

Pipeline (ADR-029, nunca copia el `doc` crudo): 1) toma `content`/`structure`/`theme` de la snapshot (ignora su `template`, que es histórico); 2) los pasa por el **mismo** normalizador que `:choose-template` — todo `blockId`/`sectionKey` que no exista en el manifiesto del `template_version_id` **actual** se mueve a `attic["<slug>@<version>"]` de la snapshot; 3) valida lo que sí coincide con `validateValueAgainstSpec`; 4) persiste como revisión **nueva** con `origin = 'restore'`; 5) devuelve `movedToAttic`.
- **Errores**: `404 TPL_SNAPSHOT_NOT_FOUND` (la revisión no existe o ya fue purgada) · `409 TPL_REVISION_CONFLICT` · `422 TPL_DOCUMENT_TOO_LARGE` · `403 TPL_FORBIDDEN`.
- **Idempotencia**: no la tiene por diseño (cada llamada crea una revisión); repetirla con la misma `baseRevision` falla con `409`, que es la protección efectiva.

### 3.7 `POST /editor/invitations/{invitationId}/assets`

- **Auth**: `validateInvitationAccess`.
- **Transporte**: **cuerpo binario crudo**, no `multipart/form-data`. `Content-Type` = el tipo del archivo; `X-Asset-Filename` (opcional, solo para derivar la extensión).
- **Límite**: 15 MiB por archivo, comprobado por `Content-Length` y por lectura contada; 200 assets por invitación.

**Por qué cuerpo crudo y no multipart** (ADR-1R-B-12, objeción **A-06**): verificado que el repositorio **no configura `spring.servlet.multipart.*` en ningún sitio** (`application.yml` completo; búsqueda de `multipart` en `src/main/resources` sin resultados), luego rigen los valores por defecto de Spring Boot: `max-file-size = 1MB`, `max-request-size = 10MB`. Aceptar 15 MiB por multipart exigiría **elevar un límite global** que hoy protege también al módulo antiguo (cuyo propio control de tamaño, `core/validation/FileValidationService.kt:11,34-37`, solo cubre imágenes y solo hasta 5 MB, y ni siquiera se alcanza porque el servlet corta antes en 1 MB). Subir el límite global relajaría una protección existente para el módulo que P10 exige no perturbar. El cuerpo crudo consigue el mismo resultado con control exacto y **cero cambios de configuración global**.

```jsonc
// 201
{ "assetId": "as_01J8ZQ2K3M4N5P6R7S8T9V0W1X", "bytes": 482113, "contentType": "image/webp",
  "sha256": "9c…", "width": 1600, "height": 1200,
  "previewUrl": "https://…?X-Amz-Expires=900", "reused": false }
// 200 con "reused": true si ya existía un asset de esta invitación con el mismo sha256
```
`previewUrl` es una URL firmada de **15 minutos**, generada con `S3Service.generatePresignedUrl(bucket, key, Duration.ofMinutes(15))` — la duración se pasa explícitamente porque el valor por defecto del método es **7 días** (`core/s3/S3Service.kt:33`). El documento nunca persiste una URL (ADR-021).

Validación: tipo declarado ∈ `{image/webp, image/png, image/jpeg, audio/mpeg, audio/aac}` **y** coincidencia con el número mágico de los primeros bytes (el módulo antiguo solo mira el tipo declarado, `FileValidationService.kt:21-24`).
- **Errores**: `413 TPL_ASSET_TOO_LARGE` · `415 TPL_ASSET_TYPE_UNSUPPORTED` · `409 TPL_ASSET_QUOTA_EXCEEDED` · `502 TPL_ASSET_STORAGE_UNAVAILABLE` · `403 TPL_FORBIDDEN` · `404 TPL_DOCUMENT_NOT_STARTED`.
- **Idempotencia**: **por contenido**. Misma invitación + mismo `sha256` ⇒ `200` con el `assetId` existente y `reused: true`, sin duplicar objeto ni fila (`ux_tpl_asset_invitation_sha`, `02 §2` V31).

### 3.8 `GET /editor/invitations/{invitationId}/assets`

- **Auth**: `validateInvitationAccess`. **Query**: `limit` (≤ 100), `cursor`.
```jsonc
// 200
{ "items": [ { "assetId": "as_01J8…", "bytes": 482113, "contentType": "image/webp",
               "width": 1600, "height": 1200, "createdAt": "2026-09-03T10:00:00Z",
               "referenced": true, "previewUrl": "https://…" } ], "nextCursor": null }
```
`referenced` indica si el `assetId` aparece hoy en `doc.content` o en algún `tpl_release.composed` de esta invitación. **Errores**: `403 TPL_FORBIDDEN`.

### 3.9 `DELETE /editor/invitations/{invitationId}/assets/{assetId}`

- **Auth**: `validateInvitationAccess` **y** pertenencia del asset (`tpl_asset.invitation_id = invitationId`); si el asset existe pero es de otra invitación, la respuesta es `404 TPL_ASSET_NOT_FOUND`, **nunca** `403` — no confirmar la existencia de un recurso ajeno (§9.2).
- **Regla dura**: no se borra un asset referenciado por el documento vigente **ni por ningún release** (un release es inmutable y debe seguir renderizando) → `409 TPL_ASSET_IN_USE`.
- **Efecto**: `DELETE FROM tpl_asset` dentro de la transacción; el trigger encola la clave en `tpl_asset_gc` y `AssetGcJob` borra el objeto en S3 después (`02 §10.3`). Nunca se borra en S3 antes del commit.
- **Respuesta**: `204`. **Idempotencia**: repetir con un `assetId` ya borrado → `404 TPL_ASSET_NOT_FOUND`.

### 3.10 `POST /editor/invitations/{invitationId}/public-token:rotate`

- **Auth**: `validateInvitationAccess`. **Cuerpo**: vacío.
- **Efecto**: genera un `public_token` nuevo (ULID) y lo escribe en `tpl_document`. El token anterior deja de resolver **inmediatamente** (`404 TPL_RELEASE_NOT_FOUND` en el render público). Los releases no cambian: el enlace es del documento, no del release.
```jsonc
// 200
{ "publicToken": "pub_01J9…", "publicUrl": "https://app.example.com/i/pub_01J9…", "rotatedAt": "…" }
```
- **Errores**: `403 TPL_FORBIDDEN` · `404 TPL_DOCUMENT_NOT_STARTED`.
- **Idempotencia**: ninguna por diseño (cada llamada rota). Es la respuesta a "¿qué pasa si el enlace se filtra?" — antes no había ninguna (objeción **A-07**).
- **Caché**: el CDN puede seguir sirviendo el token viejo hasta `max-age` (300 s, §7). Se documenta como ventana conocida; para una revocación inmediata hay que purgar el CDN, operación de la capa de despliegue.

### 3.11 `GET /editor/invitations/{invitationId}/release/preflight`

- **Auth**: `validateInvitationAccess`. **Sin cuerpo.**
```jsonc
// 200
{ "canPublish": false,
  "blockers": [ { "code": "TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT", "blockIds": ["couple.brideText"] } ],
  "warnings": [ { "code": "TPL_SECTION_EMPTY", "sectionKeys": ["story"] } ],
  "report": { "missingRequired": [], "stillDefault": ["couple.brideText"], "orphanContent": [],
              "orphanSections": [], "invalidValues": [], "themeFallback": null },
  "contentHash": "sha256:3f…", "sameAsActiveRelease": false }
```
- **Errores**: `403 TPL_FORBIDDEN` · `404 TPL_DOCUMENT_NOT_STARTED`. **Idempotencia**: lectura pura, sin efectos.

### 3.12 `POST /editor/invitations/{invitationId}/release`

- **Auth**: `validateInvitationAccess`. **Cuerpo**: `{ "baseRevision": 43 }` (obligatorio: publicar una revisión distinta de la que el cliente ve es exactamente el error que `preflight` intenta evitar).
- **Orden exacto de efectos** (una transacción):
  1. `SELECT … FROM tpl_document WHERE invitation_id = ? FOR UPDATE` (`02 §11.2`).
  2. `revision ≠ baseRevision` → `409 TPL_REVISION_CONFLICT`.
  3. Comprobación de disponibilidad: `invitation.is_enabled`, `customer.is_enabled`, `!customer.is_banned` (mismas tres que `PublicGuestInfoController.kt:65-75`) → `403 TPL_INVITATION_UNAVAILABLE`.
  4. Se lee `BusinessSnapshot` y se compone (`compose`, puro).
  5. Preflight: `report.missingRequired` no vacío → `422 TPL_PUBLISH_BLOCKED_MISSING_REQUIRED`; algún `blockId` `required` en `report.stillDefault` → `422 TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT`; `report.invalidValues` no vacío → `422 TPL_PUBLISH_BLOCKED_INVALID_VALUES`.
  6. `contentHash = "sha256:" + hex(SHA-256(utf8(canonicalJson({composed, report}))))` (`01 §5.5`, ADR-1R-D-02; el informe entra en el hash). Si coincide con el `content_hash` del release **activo**, se responde `200` con ese release, **sin insertar fila** (evita historial ruidoso).
  7. `UPDATE tpl_release SET is_active = false, unpublished_at = now() WHERE invitation_id = ? AND is_active` + `INSERT INTO tpl_release (…) VALUES (…, is_active = true)`. El índice único parcial garantiza como máximo un activo.
  8. **Commit.** No se toca S3 en ningún paso: publicar es inmune a que S3 esté caído (`02 §10.5`).
```jsonc
// 201
{ "releaseId": 8, "contentHash": "sha256:3f…", "documentRevision": 43,
  "publishedAt": "2026-09-03T12:05:00Z",
  "publicToken": "pub_01J8…", "publicUrl": "https://app.example.com/i/pub_01J8…",
  "reusedActiveRelease": false }
```
- **Errores**: `409 TPL_REVISION_CONFLICT` · `403 TPL_INVITATION_UNAVAILABLE` · `422 TPL_PUBLISH_BLOCKED_MISSING_REQUIRED` · `422 TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT` · `422 TPL_PUBLISH_BLOCKED_INVALID_VALUES` · `403 TPL_FORBIDDEN` · `404 TPL_DOCUMENT_NOT_STARTED`.
- **Idempotencia**: **por contenido** (paso 6). Publicar dos veces sin cambios devuelve `200` con el mismo `releaseId`; publicar tras cambiar algo devuelve `201` con uno nuevo.

### 3.13 `DELETE /editor/invitations/{invitationId}/release`

- **Auth**: `validateInvitationAccess`.
- **Efecto**: `UPDATE tpl_release SET is_active = false, unpublished_at = now() WHERE invitation_id = ? AND is_active`. La fila **no** se borra (sigue siendo auditable y restaurable republicando). El render público pasa a `404 TPL_RELEASE_NOT_FOUND`.
- **Respuesta**: `204`. **Idempotencia**: sí — si no había release activo, también `204`.
- **Caché**: el CDN puede seguir sirviendo hasta 300 s (§7); se documenta.

### 3.14 `GET /editor/invitations/{invitationId}/releases`

- **Auth**: `validateInvitationAccess`. **Query**: `limit` (≤ 50), `cursor`.
```jsonc
// 200
{ "items": [ { "releaseId": 8, "publishedAt": "…", "unpublishedAt": null, "contentHash": "sha256:3f…",
               "documentRevision": 43, "templateVersion": {"slug":"boda-clasica","version":"1.0.0"},
               "isActive": true, "publishedBy": 12 } ], "nextCursor": null }
```
Nunca devuelve `composed` (cuerpo enorme); para verlo está el render público. **Errores**: `403 TPL_FORBIDDEN`.

### 3.15 `GET /public/i/{publicToken}/render`

- **Auth**: **ninguna** (`/public/**` es `permitAll`, `SecurityConfig.kt:38`).
- **Cabeceras de petición**: `If-None-Match` (opcional).
- **Consulta**: una sola, por índice único: `tpl_document.public_token` → `invitation_id` → `tpl_release WHERE is_active`, con los tres campos de disponibilidad de `invitation`/`customer` **y con `invitation.uses_templates2`**.
- **La bandera de corte también manda aquí (decisión X-09).** Si `invitation.uses_templates2 = false`, esta ruta responde `404 TPL_RELEASE_NOT_FOUND` aunque exista un `tpl_release` activo. Motivo: tras un rollback (`05 §7.5`) el contenido autoritativo de esa invitación vuelve a ser `invitation_configs`, servido por el módulo antiguo; seguir sirviendo el release desde aquí dejaría **dos verdades vivas** para la misma invitación, que es H-04/H-05 exactamente. La comprobación **no cuesta una consulta más**: la fila de `invitation` ya se lee en la misma consulta para `is_enabled`. La bandera se lee, nunca se escribe. No se redirige al enlace legado: este módulo no conoce su forma; el enlace legado sigue funcionando por su propio camino.
- **Consecuencia de caché de un rollback**: igual que despublicar o rotar el token, el CDN puede seguir sirviendo la respuesta anterior hasta `max-age` 300 s (y hasta 1 h en `stale-while-revalidate`), §7. Un rollback no es instantáneo de cara al invitado.
```jsonc
// 200
{ "composed": { "composedVersion": 1, "template": {…}, "locale": "es-MX", "theme": {…}, "sections": […] },
  "publishedAt": "2026-09-03T12:05:00Z", "contentHash": "sha256:3f…" }
```
- **Cabeceras de respuesta**: `ETag: "sha256:3f…"` (fuerte, el `contentHash` completo entre comillas) · `Cache-Control: public, max-age=300, stale-while-revalidate=3600` · `Vary: Accept-Encoding` · `X-Content-Type-Options: nosniff`.
- **`304`**: `If-None-Match` que coincide → `304` sin cuerpo. La consulta de resolución sigue ejecutándose (es un índice único, coste despreciable) porque hay que comprobar que el release siga activo y la invitación disponible.
- **Errores**: `404 TPL_RELEASE_NOT_FOUND` — **la misma respuesta** para "token inexistente", "documento sin release activo" y "release despublicado", para no dar un oráculo de enumeración de tokens · `403 TPL_INVITATION_UNAVAILABLE` cuando la invitación está deshabilitada o su dueño deshabilitado/baneado (misma política que `PublicGuestInfoController.kt:65-75`, pero **un solo código** para los tres casos: el invitado no tiene por qué saber cuál).
- **Idempotencia**: lectura pura; **jamás** escribe (ni contadores ni "visto por última vez": eso convertiría la ruta cacheable en una escritura y traería de vuelta H-04).

### 3.16 `GET /public/i/{publicToken}/exists`

- **Auth**: ninguna. `200 {"published": true|false}`. Aplica la misma regla de bandera que §3.15 (X-09): con `uses_templates2 = false` responde `{"published": false}`, nunca `true`. `Cache-Control: no-store` (es la sonda que el editor consulta tras publicar; cachearla la haría inútil). Devuelve `false` —no `404`— también para un token inexistente, para no ser un oráculo. **Límite de tasa**: es la ruta más barata de sondear; §7 se aplica igual.

### 3.17 `POST /master/templates2/versions`

- **Auth**: rol `MASTER`, garantizado por `SecurityConfig.kt:44` (`/master/**` → `hasRole("MASTER")`); además `@PreAuthorize("hasRole('MASTER')")` en el controlador como defensa en profundidad. **No** usa `HierarchyValidationService` (no hay invitación que autorizar), tal como fija ADR-033.
- **Transporte**: `multipart/form-data` — aquí sí, porque el paquete son varios archivos; partes: `template` (JSON), `theme` (JSON), `defaults` (JSON), `migrations` (0..n JSON), `assets` (0..200 binarios, nombre de parte = ruta relativa `assets/<archivo>`).
- **Límites**: `template`+`theme`+`defaults`+`migrations` ≤ 2 MiB en total; cada asset ≤ 15 MiB (`esquema/manifest.ts` `AssetEntry`); ≤ 200 assets (`manifest.ts` `TemplateManifest.assets`). **Requiere elevar `spring.servlet.multipart.max-file-size`/`max-request-size`**; como es una ruta exclusiva de MASTER y no de clientes, y sin ella el kit de autor no puede subir un paquete, se acepta el cambio global y se declara explícitamente en `05`/fase 2 (única modificación de `application.yml` que este módulo pide: `max-file-size: 15MB`, `max-request-size: 64MB`).
- **Algoritmo**: `02 §4`, paso a paso.
```jsonc
// 201
{ "result": "created", "templateVersionId": 14, "slug": "boda-clasica", "version": "1.1.0",
  "packageHash": "sha256:a7…", "assetsRegistered": 6, "structuralDiff": { "removedBlocks": [], "…": [] } }
// 200
{ "result": "noop_same_hash", "templateVersionId": 14, "packageHash": "sha256:a7…" }
```
- **Errores**: `422 TPL_MANIFEST_INVALID` (con `details.violations = Violation[]`) · `422 TPL_PACKAGE_ASSET_MISMATCH` · `422 TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR` (con `details.diff`) · `409 TPL_VERSION_HASH_MISMATCH` · `413 TPL_ASSET_TOO_LARGE` · `415 TPL_ASSET_TYPE_UNSUPPORTED` · `502 TPL_ASSET_STORAGE_UNAVAILABLE`.
- **Idempotencia**: **real, por `packageHash`** (ADR-008). Reenviar el mismo paquete → `200 noop_same_hash`, sin fila nueva y sin reiniciar nada (P4). Reenviar el mismo `slug@version` con contenido distinto → `409`, nunca sobrescritura (mata H-09).
- **Auditoría**: **todo** intento —éxito o fallo— deja fila en `tpl_template_registration`, escrita con transacción propia para que sobreviva al rollback (`02 §2` V35).

### 3.18 `GET /master/templates2/versions`

- **Auth**: `MASTER`. **Query**: `slug`, `status`, `limit`, `cursor`.
```jsonc
{ "items": [ { "templateVersionId": 14, "slug": "boda-clasica", "version": "1.1.0",
               "status": "published", "packageHash": "sha256:a7…", "publishedAt": "…", "documentsUsing": 37 } ],
  "recentRegistrations": [ { "slug": "xv-jardin", "version": "1.0.1", "result": "rejected",
                             "errorCode": "TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR", "createdAt": "…" } ],
  "nextCursor": null }
```
`documentsUsing` es lo que permite decidir si una versión puede deprecarse sin dejar documentos colgados.

### 3.19 `POST /master/templates2/versions/{templateVersionId}:deprecate`

- **Auth**: `MASTER`. **Efecto**: `UPDATE tpl_template_version SET status = 'deprecated'`. No afecta a los documentos existentes; solo la retira del catálogo (`GET /editor/templates2/catalog`) y de `:choose-template` para documentos nuevos.
- **Errores**: `404 TPL_TEMPLATE_VERSION_NOT_FOUND` · `409 TPL_VERSION_LAST_PUBLISHED` si es la única versión `published` del slug y hay documentos usándola.
- **Idempotencia**: sí (deprecar lo ya deprecado → `200`).

### 3.20 `PUT /editor/invitations/{invitationId}/event`

Añadida en la fase 3-B (issue I-06, `ADR-3B-I06-01`) con autorización explícita del dueño. Es **la única ruta de cliente que escribe `invitation.date` / `invitation.time`**.

- **Auth**: invitación (`HierarchyValidationService.validateInvitationAccess`, ADR-015). `@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")` a nivel de clase (ADR-1R-B-10).
- **Cuerpo**: `{date: "YYYY-MM-DD", time?: "HH:mm"}`, leído con el lector estricto (`z.strictObject`): una clave desconocida es `400 TPL_MALFORMED_JSON`. `time` ausente = "no toques la hora"; **nunca** la borra.
- **Efecto**: `UPDATE invitation SET date = :date[, time = :time] WHERE id = :invitationId`, por SQL nativo desde `persistence/InvitationEventWriter` — el mismo camino por el que `BusinessSnapshotReader` ya lee esas columnas. **Sólo esas dos columnas**: ni `updated_at`, ni `updated_by`, ni nada más de `invitation`. No escribe un byte en ninguna tabla `tpl_*`.
- **Validación de formato**: `date` debe casar `^\d{4}-\d{2}-\d{2}$` **y** existir en el calendario; `time` debe casar `^\d{2}:\d{2}$` y ser una hora real. El patrón lo impone el consumidor: `composition/DateFormatting` parte `date` por `-` esperando tres segmentos numéricos y `time` por `:` esperando dos, y **devuelve el valor crudo** cuando no encajan (R6, punto 2), de modo que un formato inválido no revienta: se imprime tal cual en la invitación publicada. El módulo antiguo **no valida nada** (`InvitationEntity:29,31` son `String`; `InvitationAdminService.kt:414` asigna en crudo); esta ruta sí, y la divergencia es deliberada.
- **Respuesta**: `200 EventResponse = {invitationId, date, time, releaseStale, staleReason}`. `date`/`time` se **releen** del `BusinessSnapshot` tras escribir: es la verdad de Postgres, no el eco del cuerpo.
- **No invalida el release activo.** El `composed` publicado está congelado en `tpl_release` (ADR-007) y el mecanismo de "quedó desactualizado" ya existe: `EditorDocumentService.razonesDeStale` compara el `business_snapshot` congelado con el actual y `GET …/document` lo expone como `activeRelease.stale` + `staleReason: ["business.date"]` (§3.3). La clienta republica cuando quiera; `EventResponse` devuelve ese mismo cálculo para que el editor no tenga que pedirlo aparte.
- **Errores**: `422 TPL_EVENT_DATE_INVALID` (`details.field` ∈ `{date, time}`, `details.expected` con el formato) · `400 TPL_MALFORMED_JSON` · `413 TPL_BODY_TOO_LARGE` (8 KiB, como el resto de rutas JSON) · `403 TPL_FORBIDDEN` (también cuando la invitación no existe: no se filtra cuáles existen).
- **Idempotencia**: sí. Repetir la misma llamada deja exactamente el mismo estado; `tpl_document.revision` no cambia nunca.

## 4. Undo e historial (ADR-011, ADR-019, ADR-029)

El undo *interactivo* (Ctrl+Z mientras se edita) es enteramente del cliente (pila de operaciones inversas, ADR-019) — no genera tráfico de red. `GET .../document/history` y `POST .../document/restore` son la red de seguridad del **servidor**: recuperar una sesión de edición si el cliente perdió su estado (recarga de página, otro dispositivo). `restore` nunca hace `UPDATE … SET revision = <pasada>`: siempre crea una revisión nueva con el contenido de la vieja, preservando el historial completo (mismo espíritu que `attic`, ADR-006 — nada retrocede destructivamente). El pipeline exacto y la obligatoriedad de `baseRevision` están en §3.6.

**Ventana garantizada**: 200 revisiones o 30 días por documento (ADR-011), más cualquier revisión que respalde un release. Fuera de esa ventana, `restore` responde `404 TPL_SNAPSHOT_NOT_FOUND`; el cliente debe poder distinguirlo de "no existió nunca" solo por el mensaje, no por el código (no hay razón de seguridad para ocultarlo, pero tampoco para dos códigos).

## 5. Contrato de errores (ADR-016)

Todos los códigos del módulo, su HTTP y su origen. La fuente única en código es el `enum TplErrorCode` (`02 §7.1`); esta tabla y ese enum deben coincidir (prueba `ErrorCatalogParityTest`, §12).

| Código | HTTP | Cuándo |
|---|---|---|
| `TPL_FORBIDDEN` | 403 | `HierarchyValidationService.validateInvitationAccess` devuelve `false` — nunca 400 (mata H-52) |
| `TPL_NOT_MIGRATED` | 409 | La invitación aún la sirve el módulo antiguo (`invitation.uses_templates2 = false` y tiene `invitation_configs`) |
| `TPL_DOCUMENT_NOT_STARTED` | 404 | Ruta de documento sin haber llamado antes a `:choose-template` |
| `TPL_TEMPLATE_VERSION_NOT_FOUND` | 404 | `slug@version` no existe, o está `deprecated` y se pide para un documento nuevo |
| `TPL_PLAN_TIER_INSUFFICIENT` | 403 | `manifest.minPlanTier` > `business.planTier` en `:choose-template` |
| `TPL_MIGRATION_PLAN_MISSING` | 409 | `:choose-template` sube de versión sin `MigrationPlan` registrado para ese salto |
| `TPL_REVISION_CONFLICT` | 409 | `baseRevision` desactualizada (operations, restore, choose-template, release) |
| `TPL_OPERATION_INVALID` | 422 | Alguna `Operation` del lote no valida contra el manifiesto (detalle por índice) |
| `TPL_BLOCK_UNKNOWN` | 422 | Una operación referencia un `blockId` no declarado en la versión vigente |
| `TPL_BLOCK_NOT_EDITABLE` | 422 | Se intenta escribir un bloque con `source != "user"` (invariante I-21). `details.source` distingue `"business"` (el valor lo pone Postgres, R4) de `"fixed"` (el valor lo pone la plantilla y no es editable). Definición normativa: `01 §6.5` `OperationError` |
| `TPL_TEMP_ID_UNRESOLVED` | 422 | Una operación usa un `tempId` que ningún `addItem` previo del lote declaró |
| `TPL_TEMP_ID_DUPLICATE` | 422 | Dos `addItem` del mismo lote declaran el mismo `tempId` |
| `TPL_ASSET_NOT_OWNED` | 422 | Un `assetId` referenciado no pertenece a esta invitación ni a la plantilla vigente (ADR-030) |
| `TPL_ASSET_SPEC_MISMATCH` | 422 | El asset no cumple las restricciones que el `BlockSpec` declara para ese bloque: `image.maxBytes`/`audio.maxBytes` o `image.aspect`. Se comprueba en el reductor con los metadatos de `tpl_asset` (`bytes`, `width`, `height`), no contra el valor — `ImageValue`/`AudioValue` solo llevan `assetId` (decisión X-06, `01 §6.5`). `details.constraint` ∈ `{maxBytes, aspect}` |
| `TPL_ASSET_NOT_FOUND` | 404 | `DELETE /assets/{id}` con un `assetId` inexistente **o ajeno** (misma respuesta a propósito) |
| `TPL_ASSET_IN_USE` | 409 | Se intenta borrar un asset referenciado por el documento o por algún release |
| `TPL_ASSET_TOO_LARGE` | 413 | Asset por encima de 15 MiB |
| `TPL_ASSET_TYPE_UNSUPPORTED` | 415 | Tipo declarado fuera del catálogo, o incoherente con el número mágico |
| `TPL_ASSET_QUOTA_EXCEEDED` | 409 | Más de 200 assets por invitación |
| `TPL_ASSET_STORAGE_UNAVAILABLE` | 502 | S3 rechaza o no responde al subir/borrar (nunca un 500 opaco) |
| `TPL_DOCUMENT_TOO_LARGE` | 422 | El documento resultante supera 1 MiB serializado (`02 §2` V32) |
| `TPL_EVENT_DATE_INVALID` | 422 | `PUT …/event` con una fecha fuera de `YYYY-MM-DD` (o inexistente en el calendario) o una hora fuera de `HH:mm`. `details.field` ∈ `{date, time}`, `details.expected` con el formato (§3.20, `ADR-3B-I06-01`) |
| `TPL_BODY_TOO_LARGE` | 413 | Cuerpo HTTP por encima del límite de la ruta (768 KiB en `operations`) |
| `TPL_MALFORMED_JSON` | 400 | Cuerpo no parseable, o con claves desconocidas (los esquemas son `strictObject`) |
| `TPL_SNAPSHOT_NOT_FOUND` | 404 | `restore` de una revisión inexistente o ya purgada |
| `TPL_PUBLISH_BLOCKED_MISSING_REQUIRED` | 422 | Publicar con bloques `required` sin valor de usuario ni default |
| `TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT` | 422 | Publicar con bloques `required` aún en `provenance: default` (R3, mata H-03) |
| `TPL_PUBLISH_BLOCKED_INVALID_VALUES` | 422 | `report.invalidValues` no vacío al publicar |
| `TPL_RELEASE_NOT_FOUND` | 404 | Render público sin release activo, o `publicToken` inexistente/rotado (misma respuesta para todos) |
| `TPL_INVITATION_UNAVAILABLE` | 403 | Invitación deshabilitada, o su dueño deshabilitado o baneado (render público y publicación) |
| `TPL_PLAN_UNPAID` | 402 | Publicar (o su preflight) una invitación sin plan pagado: `invitation.is_paid` no es `true` (ADR-5-0B-01, ADR-5-4-02). Editar y previsualizar siguen siendo gratis; lo resuelve `/editor/[invitationId]/plan` |
| `TPL_MANIFEST_INVALID` | 422 | Registro: violaciones de `validateManifest` o del JSON Schema (lista completa en `details`) |
| `TPL_PACKAGE_ASSET_MISMATCH` | 422 | Registro: `sha256`/`bytes`/`contentType` de un asset no coincide con lo declarado en el manifiesto |
| `TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR` | 422 | Registro: diff estructural no vacío sin bump mayor, o mayor sin plan que lo cubra (ADR-028) |
| `TPL_VERSION_HASH_MISMATCH` | 409 | Registro: mismo `slug@version`, contenido distinto (mata H-09) |
| `TPL_VERSION_LAST_PUBLISHED` | 409 | Deprecar la única versión publicada de un slug con documentos que la usan |
| `TPL_INTERNAL` | 500 | Cualquier excepción no prevista, **con código y sin traza** (§10.3) |

**Prefijo `TPL_AI_*` — reservado, no listado (decisión X-14).** Los 11 códigos del contrato de IA (`07 §6`) **no** entran en esta tabla en la fase 1: las tres rutas `…/document/ai:*` están diseñadas y explícitamente **sin implementar** (ADR-027), y una tabla de errores que enumera códigos de rutas inexistentes es contrato falso. Se reserva el prefijo para que nadie lo reutilice y se vuelca la lista completa aquí en la misma fase que implemente las rutas; la tabla `tpl_ai_proposal` es la migración `V39` (fuera del rango `V29`-`V37` del módulo y de la `V38` de `tpl_migration_run`).

Regla dura (ADR-016): **ninguna ruta de `templates2` devuelve un 500 sin `code`**. `TPL_INTERNAL` es el único 500 posible y lo emite el handler propio, no el mecanismo genérico de Spring.

## 6. Preflight de publicación (mata H-03 en la vía de publicación)

`GET .../release/preflight` (§3.11) y el paso 5 de `POST .../release` (§3.12) corren **la misma** comprobación sobre el `CompositionReport` fresco. Bloques opcionales en `default` **no** bloquean — es legítimo publicar una sección opcional con placeholder mientras el cliente decide. Este preflight es la respuesta directa a H-03 en el punto exacto donde antes se publicaban datos de demo como si fueran reales.

## 7. Render público: caché, ETag y coherencia con `contentHash`

- **`ETag`** = `"<content_hash>"` (comillas incluidas, ETag **fuerte**; el valor completo con su prefijo, p. ej. `ETag: "sha256:3f…"`; el `contentHash` lo define `01 §5.5` sobre `{composed, report}`, ADR-1R-D-02). Es determinista: dos publicaciones del mismo contenido producen el mismo ETag, y publicar contenido distinto lo cambia siempre. **No hace falta purga activa de CDN**: el cambio de `ETag` basta como invalidación, con la ventana de `max-age` descrita abajo.
- **`Cache-Control: public, max-age=300, stale-while-revalidate=3600`.** Consecuencia asumida y ahora explícita: tras publicar, despublicar (§3.13) o rotar el token (§3.10), el CDN puede servir la respuesta anterior **hasta 300 s** (y hasta 1 h en modo `stale-while-revalidate`). Para una revocación inmediata hace falta purgar el CDN, que es una operación de la capa de despliegue, fuera de este módulo. El borrador afirmaba invalidación "automática" sin matizar esta ventana (objeción **A-08**).
- **`304`**: `If-None-Match` idéntico ⇒ `304` sin cuerpo, pero **después** de resolver el token y comprobar disponibilidad: un release despublicado o una invitación deshabilitada deben dejar de servirse aunque el cliente traiga el ETag correcto.
- **`assetId` → URL** se resuelve al **componer** (`02 §10.4`), con la plantilla `{templates2.assets.public-base-url}/{s3_key}` y sin llamar a S3. Nunca una URL firmada de corta duración en el render público (rompería el `max-age`).
- **Entropía del token**: `public_token` es `pub_` + ULID; la parte imprevisible de un ULID son sus **80 bits aleatorios** (los otros 48 son marca de tiempo). 80 bits siguen haciendo inviable la enumeración, pero el "≈130 bits" del borrador era incorrecto (objeción **A-09**).
- **Límite de tasa**: la capa de despliegue (CDN/proxy inverso, fuera de este módulo) debe aplicar un límite por IP sobre `/public/i/**` como defensa en profundidad. Con 80 bits de entropía no es una mitigación crítica, pero sí evita que la ruta sea un amplificador barato de tráfico contra Postgres.

## 8. Límites e idempotencia (resumen)

| Límite | Valor | Dónde se aplica |
|---|---|---|
| Cuerpo de `POST .../document/operations` | **768 KiB** (ADR-032) | `Templates2BodyLimitFilter` (§10.4) |
| Cuerpo de las demás rutas JSON del editor | 8 KiB | mismo filtro |
| Operaciones por lote | 1..50 | esquema (`operations.ts` `OperationBatch.operations`) + validación Kotlin |
| Documento serializado | 1 MiB | `DocumentStore` + `CHECK` sobre `doc_bytes` (`02 §2` V32) |
| Asset por archivo | 15 MiB | `EditorAssetService` por `Content-Length` y lectura contada |
| Assets por invitación | 200 (cuota blanda) | `AssetStore` |
| Paquete de plantilla | 200 assets, 15 MiB cada uno, 2 MiB de JSON | `TemplateRegistrar` |
| Secciones por documento | 16 | esquema (`document.ts` `Structure`) |
| Ítems por grupo | 24 | esquema (`blocks.ts` `GroupValue`) |

**Cómo se aplica el límite de cuerpo (corrección 1R, objeción A-10).** El borrador decía "límite de Spring MVC a configurar". **Spring MVC no tiene tal ajuste para cuerpos JSON**: `server.tomcat.max-http-form-post-size` solo afecta a `application/x-www-form-urlencoded`, y `spring.servlet.multipart.*` solo a multipart. Para un `application/json` no hay límite de plataforma. Por tanto se implementa `Templates2BodyLimitFilter` (`OncePerRequestFilter` registrado solo para `/editor/**` y `/master/templates2/**`): rechaza con `413 TPL_BODY_TOO_LARGE` si `Content-Length` excede el límite de la ruta y, cuando no hay `Content-Length` (`Transfer-Encoding: chunked`), envuelve el `InputStream` en uno contado que aborta al superarlo. Sin este filtro, H-45 ("acepta cualquier JSON") seguiría vivo en el módulo nuevo.

**Idempotencia real (no solo de código de estado):**

| Operación | Clave | Ventana | Respuesta al reintento |
|---|---|---|---|
| Registro de plantilla | `packageHash` por `template_id` | permanente | `200 {result:"noop_same_hash"}` |
| `OperationBatch` | `(document_id, clientBatchId)` | retención de snapshots (200 rev. / 30 d) | `200 {applied:false, revision:<la que produjo>}` |
| Subida de asset | `(invitation_id, sha256)` | permanente | `200 {reused:true, assetId:<el existente>}` |
| Publicación | `content_hash` del release activo | mientras siga activo | `200` con el release existente, sin fila nueva |
| Creación del documento (`:choose-template`; **nunca** un `GET`, X-07) | `UNIQUE (invitation_id)` + `ON CONFLICT DO NOTHING` | permanente | `200`, documento existente |
| Despublicar | estado | — | `204` también si ya estaba despublicado |
| Deprecar versión | estado | — | `200` también si ya estaba deprecada |
| `restore`, `rotate` | **no idempotentes por diseño** | — | protegidas por `baseRevision` / por ser explícitas |

## 9. Autorización

### 9.1 Matriz ruta × rol

Roles reales del sistema (`core/auth/model/Role.kt`, y `CHECK` en `V1__initial_schema.sql:82`): **`USER`** (el "cliente" del brief), **`ADMIN`**, **`MASTER`**. No existe ningún rol `CLIENTE`.

Semántica de `HierarchyValidationService.validateInvitationAccess` verificada en `HierarchyValidationService.kt:42-71`: `MASTER` → siempre `true`; `ADMIN` → `true` si es el dueño, si creó al dueño, o si él creó la invitación; `USER` → `true` solo si `invitation.customer.id == requesterId`. Requester deshabilitado → `false` en cualquier rol.

| # | Ruta | `USER` dueño | `USER` ajeno | `ADMIN` de ese cliente | `ADMIN` ajeno | `MASTER` | Anónimo |
|---|---|---|---|---|---|---|---|
| 1 | `GET /editor/templates2/catalog` | ✔ | ✔ | ✔ | ✔ | ✔ | 401 |
| 2 | `:choose-template` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 3 | `GET .../document` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 4 | `POST .../operations` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 5 | `GET .../history` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 6 | `POST .../restore` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 7 | `POST .../assets` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 8 | `GET .../assets` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 9 | `DELETE .../assets/{id}` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 10 | `GET .../release/preflight` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 11 | `POST .../release` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 12 | `DELETE .../release` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 13 | `GET .../releases` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 14 | `public-token:rotate` | ✔ | 403 | ✔ | 403 | ✔ | 401 |
| 15 | `GET /public/i/{t}/render` | ✔ | ✔ | ✔ | ✔ | ✔ | **✔ (público)** |
| 16 | `GET /public/i/{t}/exists` | ✔ | ✔ | ✔ | ✔ | ✔ | **✔ (público)** |
| 17 | `POST /master/templates2/versions` | 403 | 403 | 403 | 403 | ✔ | 401 |
| 18 | `GET /master/templates2/versions` | 403 | 403 | 403 | 403 | ✔ | 401 |
| 19 | `:deprecate` | 403 | 403 | 403 | 403 | ✔ | 401 |

Notas: el `401` de la fila "Anónimo" lo produce `AuthEntryPointJwt` a través de `SecurityConfig.kt:34`, **no** el handler de `templates2` (§10.5). El `403` de las filas 17-19 lo produce `InvitationsAccessDeniedHandler` (`SecurityConfig.kt:35`, `:44`), tampoco `templates2` — su cuerpo es el de la plataforma, no un `TPL_*`; documentarlo evita que fase 2 escriba una prueba que espere `TPL_FORBIDDEN` donde nunca lo habrá.

**Riesgo residual verificado:** `validateInvitationAccess` usa `invitationRepository.findByIdEvenIfDisabled` (`HierarchyValidationService.kt:44`), luego **una invitación deshabilitada (soft delete) sigue siendo accesible para su dueño**. Es coherente con el resto del backend, pero implica que las rutas de escritura de `templates2` deben comprobar `invitation.is_enabled` por su cuenta antes de **publicar** (§3.12 paso 3); editar una invitación deshabilitada se permite (el cliente puede estar preparándola para reactivarla), publicarla no.

### 9.2 Inyección de ids (H-13): ataques y por qué fallan

| Ataque | Qué manda el atacante | Por qué falla |
|---|---|---|
| Editar la invitación de otro | `invitationId` ajeno en la **ruta** | `validateInvitationAccess` → `403 TPL_FORBIDDEN` (§9.1) |
| Colar el id en el cuerpo | `{"invitationId": 200, …}` | **Ningún** DTO del módulo tiene ese campo y el `ObjectMapper` de `templates2` tiene `FAIL_ON_UNKNOWN_PROPERTIES` (`02 §8.1`) ⇒ `400 TPL_MALFORMED_JSON` |
| Reutilizar la foto de otro | `assetId` ajeno en un `ImageValue` | comprobación de pertenencia contra `tpl_asset` (§3.4 punto 3, ADR-030) ⇒ `422 TPL_ASSET_NOT_OWNED` |
| Borrar la foto de otro | `assetId` ajeno en la ruta 9 | filtrado por `invitation_id` ⇒ `404 TPL_ASSET_NOT_FOUND` (no `403`: no confirma existencia) |
| Usar una versión de plantilla no publicada | `templateVersion` de una versión `deprecated`/inexistente | `:choose-template` resuelve por `(slug, version)` **y** exige `status = 'published'` ⇒ `404 TPL_TEMPLATE_VERSION_NOT_FOUND`. Nunca se acepta un `templateVersionId` numérico del cliente |
| Restaurar la revisión de otro documento | `{"revision": 37}` esperando que sea global | las snapshots se resuelven **siempre** por `document_id` derivado del `invitationId` autorizado ⇒ `404 TPL_SNAPSHOT_NOT_FOUND` |
| Referenciar un release ajeno | `releaseId` en el cuerpo | ninguna ruta acepta `releaseId` de entrada; el activo se resuelve por `invitation_id` |
| Adivinar un enlace público | `publicToken` al azar | 80 bits aleatorios + misma respuesta `404` para token inexistente y sin release (§3.15) |
| Escribir un bloque no editable | `setBlock` sobre `blockId` con `source: "business"` o `"fixed"` | invariante I-21 ⇒ `422 TPL_BLOCK_NOT_EDITABLE` (`details.source`) |
| Escribir `attic` directamente | `attic` en un cuerpo | `attic` no es escribible por ninguna operación del catálogo cerrado (`operations.ts` `Operation`) |
| Colisión de `clientBatchId` entre invitaciones | mismo `clientBatchId` en dos invitaciones | la unicidad es `(document_id, client_batch_id)`, no global (`02 §2` V33) |
| Elevar el `itemId` | `itemId` ULID inventado en `removeItem` | el reductor solo acepta ítems presentes en el grupo ⇒ `422 TPL_OPERATION_INVALID` |

## 10. Errores: integración con el `GeneralExceptionHandler` real

### 10.1 Decisión: advice propio, acotado por paquete y con precedencia máxima

```kotlin
@RestControllerAdvice(basePackages = ["mx.evolutiondev.invitaciones.modules.templates2.api"])
@Order(Ordered.HIGHEST_PRECEDENCE)
class Templates2ExceptionHandler(private val dateFormatter: DateFormatter) { … }
```

Justificación con el código real, no por preferencia de estilo:

- **No se extiende `GeneralExceptionHandler`.** Es una clase `@RestControllerAdvice` del núcleo (`core/error/GeneralExceptionHandler.kt:26-29`) con 15 handlers de excepciones del módulo antiguo. Extenderla o modificarla es tocar el núcleo, que el contrato prohíbe.
- **`basePackages`** limita el advice a los controladores de `templates2`: **es imposible** que altere el comportamiento de errores del módulo antiguo, incluso teniendo un handler de `Exception`.
- **`@Order(HIGHEST_PRECEDENCE)`** es necesario porque los dos advices existentes (`GeneralExceptionHandler`, `InternalExceptionHandler`) **no declaran orden** y por tanto quedan en `LOWEST_PRECEDENCE`. Con el nuestro primero, las excepciones lanzadas desde `templates2.api` se resuelven aquí y nunca caen en los handlers genéricos.
- **Peligro concreto que esto evita** (objeción **A-11**): `GeneralExceptionHandler` tiene `@ExceptionHandler(IllegalArgumentException::class)` → `400` sin código (`GeneralExceptionHandler.kt:42-52`). En Kotlin, `require(...)` lanza `IllegalArgumentException` y `check(...)` lanza `IllegalStateException`. Si `templates2` usara `require`/`check` en una ruta de petición, el error saldría como un `400` genérico sin `TPL_*`, exactamente el patrón de H-14. **Regla de implementación**: en `templates2` está prohibido `require`/`check`/`error()` en cualquier camino alcanzable desde un controlador; toda condición de contrato lanza una subclase de `Templates2Exception`. Se verifica con una prueba de arquitectura (§12).

### 10.2 Cuerpo de error

`core/error/model/ErrorMessage.kt:251-256` tiene exactamente cuatro campos: `timestamp`, `statusCode`, `errorsListed`, `errors`. **No tiene `code`.** La afirmación del borrador ("devuelve el `ErrorMessage` existente con `code`") era imposible sin modificar una clase del núcleo (objeción **A-12**). `templates2` define su propio DTO, compatible en forma con lo que ya consume el frontend pero con el campo que el contrato necesita:

```jsonc
// cualquier 4xx/5xx de templates2
{
  "timestamp": "03/09/2026 12:05:00",
  "statusCode": 422,
  "code": "TPL_OPERATION_INVALID",
  "message": "Una o más operaciones no son válidas para la plantilla vigente.",
  "details": { "operations": [ { "index": 2, "code": "I-15_BLOCK_KIND_MISMATCH", "path": "cover.title" } ] }
}
```
`timestamp` usa el mismo `DateFormatter` y el mismo patrón `dd/MM/yyyy HH:mm:ss` que el resto del backend (`GeneralExceptionHandler.kt:34`), para no introducir un segundo formato de fecha en la API.

### 10.3 Handlers que el advice debe declarar (lista cerrada)

1. `Templates2Exception` (raíz sellada) → su `code`/`status`.
2. `HttpMessageNotReadableException` → `400 TPL_MALFORMED_JSON`. **Necesario**: sin él lo capturaría `GeneralExceptionHandler.kt:75-89`, que además **filtra `rootCause` al cliente** — una fuga de detalle interno que no queremos en el módulo nuevo.
3. `MethodArgumentNotValidException` → `400 TPL_MALFORMED_JSON` con `details.fields`. Sin él lo capturaría `InternalExceptionHandler` (`core/error/InternalExceptionHandler.kt:278-298`), sin `code`.
4. `MaxUploadSizeExceededException` → `413 TPL_ASSET_TOO_LARGE` (relevante en la ruta 17, la única multipart).
5. `MissingServletRequestPartException` → `422 TPL_MANIFEST_INVALID` (paquete incompleto en la ruta 17).
6. `ConstraintViolationException` → `400 TPL_MALFORMED_JSON`.
7. `DataIntegrityViolationException` → traducción por nombre de constraint: `uq_tpl_document_snapshot`/`ux_tpl_document_snapshot_batch` → idempotencia (§3.4 punto 6, **no** es un error); `uq_tpl_template_version` → `409 TPL_VERSION_HASH_MISMATCH`; `ux_tpl_release_active_per_invitation` → reintento; resto → `500 TPL_INTERNAL`.
8. `SdkException` del SDK de AWS → `502 TPL_ASSET_STORAGE_UNAVAILABLE`.
9. `Exception` (último) → `500 TPL_INTERNAL`, con `log.error` **con** traza en el servidor y **sin** traza en la respuesta. Es lo que garantiza que ninguna ruta del módulo devuelva un 500 sin código (ADR-016).

### 10.4 Lo que el advice **no** puede capturar

Nada lanzado por la cadena de filtros de Spring Security llega a un `@RestControllerAdvice`: el `401` de token ausente/inválido lo escribe `AuthEntryPointJwt` (`SecurityConfig.kt:34`) o directamente `JwtTokenFilter.sendErrorResponse` (`JwtTokenFilter.kt:44,49,54`), y el `403` por rol lo escribe `InvitationsAccessDeniedHandler` (`SecurityConfig.kt:35`). Sus cuerpos son los de la plataforma y **no llevan `TPL_*`**. También queda fuera `Templates2BodyLimitFilter` si aborta antes del controlador: por eso ese filtro debe **escribir él mismo** el cuerpo de error del §10.2 con `TPL_BODY_TOO_LARGE`, en vez de lanzar una excepción que nadie traduciría.

### 10.5 `server.error.include-message: always`

Está activo (`application.yml:3-6`). Solo afecta a la ruta `/error` del contenedor, a la que `templates2` nunca llega porque el advice responde antes. Se deja como está (es configuración del núcleo).

## 11. Integración reusada (solo lectura salvo lo indicado)

`HierarchyValidationService` (autorización, ADR-015) · `JwtTokenFilter`/`Authentication`/`authentication.userId()` (identidad) · `S3Service` (`uploadPublicFile`, `generatePresignedUrl` con duración explícita, `deleteFile`) y `S3Buckets.ASSETS` · `DateFormatter` (formato de `timestamp` en errores) · `InvitationRepository` **solo** para proyecciones de lectura del `BusinessSnapshot`. **No** se reusa `S3KeyService` (`02 §14`, objeción B-09) ni `FileValidationService` (sus límites son los del módulo antiguo). Ninguna integración escribe fuera de `tpl_*` salvo `invitation.uses_templates2` vía `Templates2FlagRepository` (`05-migracion.md` §4).

## 12. Casos de prueba de fallo parcial y de contrato (para fase 2)

Nombre del test · arreglo · acción · aserción. Los de persistencia pura viven en `02`; estos son los de API.

**Idempotencia y concurrencia**
1. `operationsBatch_replayAfterTimeout_isNoOp` · documento en revisión 42, lote `b_1` aplicado (revisión 43) · reenviar **el mismo cuerpo** (con `baseRevision: 42`) · `200`, `applied=false`, `revision=43`, `tpl_document.revision` sigue 43, hay **una sola** fila de snapshot con `client_batch_id='b_1'`.
2. `operationsBatch_staleBaseRevision_conflicts` · revisión 43 · enviar `baseRevision: 42` con `clientBatchId` nuevo · `409 TPL_REVISION_CONFLICT` con `currentRevision=43` y documento actual en el cuerpo.
3. `publishTwiceWithoutChanges_returns200SameRelease` · release activo con hash `H` · `POST .../release` sin cambios · `200`, `reusedActiveRelease=true`, `count(tpl_release)` no cambia.
4. `publishWhileBatchInFlight_serializes` · dos hilos: uno publica, otro aplica un lote · ambos terminan; el `document_revision` del release coincide exactamente con el `doc` compuesto (nunca una revisión intermedia).
5. `restoreWithStaleBaseRevision_conflicts` · dos pestañas · restaurar desde la vieja · `409`, el trabajo de la otra pestaña intacto.
6. `assetUpload_sameBytesTwice_returnsSameAssetId` · subir el mismo archivo dos veces · segunda respuesta `200`, `reused=true`, una sola fila en `tpl_asset`, un solo objeto en S3.
7. `templateRegister_samePackageTwice_isNoop` · registrar dos veces · `201` y luego `200 noop_same_hash`, una sola fila en `tpl_template_version`, dos filas en `tpl_template_registration`.

**Fallo parcial con S3**
8. `assetUpload_s3Fails_noRowPersisted` · `S3Service` simulado que lanza · subir · `502 TPL_ASSET_STORAGE_UNAVAILABLE`, `count(tpl_asset)` = 0.
9. `assetUpload_dbFailsAfterS3_orphanIsDeterministic` · fallo forzado del `INSERT` · reintentar la misma subida · la clave S3 escrita es idéntica (no se acumula un segundo objeto) y a la segunda hay exactamente una fila.
10. `assetDelete_s3Fails_rowGoneAndQueued` · `deleteFile` falla · borrar asset no referenciado · `204`, fila borrada, una fila en `tpl_asset_gc` con `deleted_at IS NULL`.
11. `invitationHardDelete_cascadesAndQueuesS3` · invitación con documento, release y 3 assets · `DELETE FROM invitation` · 0 filas `tpl_*` para esa invitación, 3 filas en `tpl_asset_gc`, ningún error de clave foránea.
12. `templateRegister_rollbackAfterAssets_auditRowSurvives` · fallo forzado en el `INSERT` de la versión · registrar · `422`/`409`, 0 filas de versión, **1** fila `tpl_template_registration` con `result='rejected'`.
13. `publish_withS3Down_succeeds` · S3 caído · publicar · `201`; publicar no toca S3.

**Autorización e inyección (H-13)**
14. `otherUsersInvitation_isForbidden` · `USER` A, invitación de B · cada una de las 13 rutas de invitación · `403 TPL_FORBIDDEN` en todas.
15. `adminOfOtherTree_isForbidden` · `ADMIN` que no creó al cliente ni la invitación · idem · `403`.
16. `masterCanAccessAnyInvitation` · `MASTER` · idem · `2xx`.
17. `foreignAssetId_isRejected` · `assetId` de otra invitación en un `setBlock` · `422 TPL_ASSET_NOT_OWNED`, documento sin cambios, revisión sin incrementar.
18. `foreignAssetDelete_returns404NotForbidden` · borrar `assetId` ajeno · `404 TPL_ASSET_NOT_FOUND`.
19. `unknownBodyField_isRejected` · cuerpo con `"invitationId": 999` extra · `400 TPL_MALFORMED_JSON` (P1: no se descarta en silencio).
20. `deprecatedVersion_cannotStartNewDocument` · versión `deprecated` · `:choose-template` · `404 TPL_TEMPLATE_VERSION_NOT_FOUND`.
21. `snapshotOfAnotherDocument_isNotVisible` · revisión que existe en otro documento · `restore` · `404 TPL_SNAPSHOT_NOT_FOUND`.
22. `businessBlockWrite_isRejected` · `setBlock` sobre bloque `source: "business"` · `422 TPL_BLOCK_NOT_EDITABLE` con `details.source == "business"`.
22b. `fixedBlockWrite_isRejected` · `setBlock` sobre bloque `source: "fixed"` · `422 TPL_BLOCK_NOT_EDITABLE` con `details.source == "fixed"` (el caso que el nombre anterior `TPL_BUSINESS_BLOCK_WRITE` no cubría).

**Límites**
23. `bodyOver768KiB_isRejectedBeforeParsing` · cuerpo de 800 KiB · `413 TPL_BODY_TOO_LARGE`, sin traza de deserialización en el log.
24. `batchOf51Operations_isRejected` · 51 operaciones · `422 TPL_OPERATION_INVALID`.
25. `documentOver1MiB_isRejected` · lotes sucesivos válidos hasta rebasar 1 MiB · el que rebasa → `422 TPL_DOCUMENT_TOO_LARGE`, revisión sin incrementar.
26. `asset16MiB_isRejected` · `413 TPL_ASSET_TOO_LARGE`, sin llamada a S3.
27. `asset201_isRejected` · 200 assets existentes · `409 TPL_ASSET_QUOTA_EXCEEDED`.
28. `contentTypeMismatchMagicBytes_isRejected` · PNG declarado como `image/webp` · `415 TPL_ASSET_TYPE_UNSUPPORTED`.

**Render público y caché**
29. `render_returnsEtagEqualToContentHash` · release publicado · `GET render` · `ETag` == `"<content_hash>"`.
30. `render_ifNoneMatch_returns304` · mismo ETag · `304` sin cuerpo.
31. `render_afterUnpublish_returns404` · `DELETE .../release` · `404 TPL_RELEASE_NOT_FOUND` incluso con `If-None-Match` correcto.
32. `render_afterTokenRotation_oldTokenIs404` · rotar · el token viejo → `404`; el nuevo → `200`.
33. `render_disabledInvitation_isUnavailable` · `is_enabled = false` · `403 TPL_INVITATION_UNAVAILABLE`.
34. `render_bannedOwner_isUnavailable` · `customer.is_banned = true` · `403 TPL_INVITATION_UNAVAILABLE`.
35. `render_unknownToken_sameShapeAsNoRelease` · token inventado y documento sin release · **misma** respuesta byte a byte (sin oráculo).
36. `render_neverWritesToDatabase` · con la conexión en modo solo lectura · `GET render` · `200`.

**Contrato de errores**
37. `errorCatalogParity` · recorre `TplErrorCode` · compara con la tabla de `03 §5` incrustada como recurso de prueba · sin diferencias.
38. `everyTplErrorHasHandler` · lanza cada excepción desde un controlador de prueba · todas responden con `code` y el HTTP de la tabla; **ninguna** cae en `GeneralExceptionHandler`.
39. `noRequireOrCheckInApiPaths` · prueba de arquitectura · ninguna clase de `templates2` alcanzable desde un controlador usa `require`/`check`/`error()` (§10.1).
40. `unhandledException_returns500WithCode` · servicio que lanza `RuntimeException` · `500` con `code = TPL_INTERNAL` y **sin** traza en el cuerpo.

## 13. Evidencia de código real leída para esta revisión

`core/auth/service/HierarchyValidationService.kt:42-71` · `core/auth/security/SecurityConfig.kt:17,34-48` · `core/auth/security/JwtTokenFilter.kt:31-72,89,104` · `core/auth/model/Role.kt` · `modules/admin/users/ktx/_AuthenticationExt.kt:7-12` · `core/error/GeneralExceptionHandler.kt:26-29,42-52,75-89,103-248` · `core/error/InternalExceptionHandler.kt:272-298` · `core/error/model/ErrorMessage.kt:251-256` · `core/s3/S3Service.kt:21-69` · `core/s3/S3KeyService.kt:130-138` · `core/s3/S3Buckets.kt:154-157` · `core/validation/FileValidationService.kt:9-48` · `modules/all/invitations/presentation/PublicGuestInfoController.kt:51-75` · `modules/admin/invitations/repository/model/InvitationEntity.kt:13-45` · `modules/admin/invitations/repository/InvitationRepository.kt:42-43` · `src/main/resources/application.yml:1-54,71-73` · `build.gradle.kts:6,31-35,42` · ausencia total de `spring.servlet.multipart` en `src/main/resources`.

## 14. Lo que no pude determinar

- Si el bucket `ASSETS` es de lectura pública (`02 §10.4`). El render público lo asume; la propiedad `templates2.assets.public-base-url` permite corregirlo sin migrar nada.
- Si existe una cuota real de almacenamiento por cliente/plan (supuesto: 200 assets/invitación).
- Si `minPlanTier` debe bloquear `:choose-template` (supuesto: sí, `403 TPL_PLAN_TIER_INSUFFICIENT`, con `planTier` tomado de `BusinessSnapshot`, `esquema/composed.ts` `BusinessSnapshot.planTier`).
- El dominio real del enlace público: se usa `app.frontend.url` (`application.yml:71-73`), que hoy vale `http://localhost` por defecto.
- Si algún cliente actual depende del cuerpo de error existente (`ErrorMessage`) de forma que un cuerpo con `code` extra le moleste — el módulo nuevo no tiene consumidores todavía, así que el riesgo es nulo hoy.

## 15. Revisión independiente (1R-backend)

| ID | Sev. | Objeción | Evidencia | Corrección aplicada | Estado |
|---|---|---|---|---|---|
| A-01 | **Alta** | No existía forma de **despublicar** ni de **revocar** un enlace filtrado; tampoco de listar/borrar assets ni de deprecar una versión | tabla de rutas del borrador (`03 §2`) | rutas 8, 9, 12, 14, 18, 19 añadidas con contrato completo (§3.8-3.10, §3.13, §3.18-3.19) | cerrada |
| A-02 | Media | `/editor/**` no está en `SecurityConfig`: cae en `anyRequest().authenticated()`, sin regla de rol explícita | `SecurityConfig.kt:36-48` | `@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")` a nivel de clase, posible por `@EnableMethodSecurity` (`SecurityConfig.kt:17`), sin tocar el núcleo (§2) | cerrada |
| A-03 | Media | `:choose-template` no llevaba `baseRevision`: cambiar de plantilla desde una pestaña vieja pisaba trabajo ajeno | `03 §3.1` del borrador | `baseRevision` obligatorio cuando el documento ya existe (§3.2) | cerrada |
| A-04 | Media | La resolución de `tempId` **dentro** del mismo lote no estaba especificada, y el esquema la permite | `esquema/operations.ts` `AnyItemId` / `setItemBlock` | mapa `tempId → ULID` durante la aplicación + `TPL_TEMP_ID_UNRESOLVED`/`TPL_TEMP_ID_DUPLICATE` (§3.4 punto 2) | cerrada |
| A-05 | **Alta** | La idempotencia del `OperationBatch` era nominal: tras un timeout el cliente reenvía con la misma `baseRevision` y el lote se aplica dos veces | razonamiento del borrador en `03 §3.3` | unicidad `(document_id, clientBatchId)` + respuesta `200 {applied:false}` (§3.4 punto 6, `02 §2` V33) | cerrada |
| A-06 | Media | 15 MiB por multipart es imposible con la configuración real (por defecto 1 MB) y elevarla relajaría una protección del módulo antiguo | ausencia de `spring.servlet.multipart` en `src/main/resources`; `FileValidationService.kt:11` | subida de assets por **cuerpo binario crudo**, sin cambio global (§3.7). La única multipart que queda es la ruta MASTER, con cambio declarado | cerrada |
| A-07 | **Alta** | Un `public_token` filtrado no se podía revocar: era "estable de por vida" sin ninguna vía de rotación | `02 §2` V32 del borrador | `POST .../public-token:rotate` (§3.10) + `unpublish` (§3.13) | cerrada |
| A-08 | Media | "La invalidación de CDN es automática por cambio de ETag" ocultaba la ventana de `max-age` tras despublicar o rotar | `03 §7` del borrador | ventana de 300 s/1 h documentada explícitamente y remitida a purga de CDN (§7, §3.10, §3.13) | cerrada |
| A-09 | Baja | "≈130 bits de entropía" del `publicToken` es incorrecto | ULID = 48 bits de tiempo + 80 aleatorios | corregido a 80 bits en §7 y en `02 §2` V32 | cerrada |
| A-10 | **Alta** | "Límite de body de Spring MVC a configurar" no existe para JSON: H-45 seguía abierto en el módulo nuevo | no hay ajuste de plataforma para cuerpos `application/json` | `Templates2BodyLimitFilter` con `Content-Length` y lectura contada, que además escribe él mismo el cuerpo de error (§8, §10.4) | cerrada |
| A-11 | **Alta** | Un `require()`/`check()` de Kotlin en cualquier ruta habría salido como `400` genérico por `GeneralExceptionHandler`, repitiendo H-14 | `GeneralExceptionHandler.kt:42-52` | advice propio con `@Order(HIGHEST_PRECEDENCE)` + prohibición de `require`/`check` verificada por prueba de arquitectura (§10.1, §12 caso 39) | cerrada |
| A-12 | Media | El contrato prometía `code` dentro del `ErrorMessage` existente, que no tiene ese campo | `core/error/model/ErrorMessage.kt:251-256` | DTO propio `TplErrorResponse` con `code`/`message`/`details` (§10.2) | cerrada |
| A-13 | **Alta** | El render público no comprobaba invitación deshabilitada ni dueño baneado: seguiría sirviendo contenido que el módulo antiguo ya bloquea | `PublicGuestInfoController.kt:65-75`; `InvitationEntity.kt:15` | `TPL_INVITATION_UNAVAILABLE` en render y en publicación (§3.12 paso 3, §3.15) | cerrada |
| A-14 | Media | `GET .../document` creaba el documento perezosamente según ADR-013, lo que reintroduce la ambigüedad de orden de H-39 | ADR-013; `03 §2` del borrador | la creación es **exclusiva** de `:choose-template`; `GET` responde `404 TPL_DOCUMENT_NOT_STARTED` (§3.3) | cerrada |
| A-15 | Media | 401/403 de la cadena de seguridad no pueden llevar `TPL_*` y el contrato daba a entender lo contrario | `SecurityConfig.kt:34-35`; `JwtTokenFilter.kt:44,49,54` | límite explícito documentado (§9.1 nota, §10.4) para que fase 2 no escriba pruebas imposibles | cerrada |
| A-16 | Baja | No existía código para "S3 no responde": habría acabado en un 500 genérico | ADR-016 | `TPL_ASSET_STORAGE_UNAVAILABLE` (502) y handler de `SdkException` (§5, §10.3) | cerrada |

**Contradicciones.** De las cinco que detecté contra `01-dominio-y-esquema.md`/`esquema/*.ts`, cuatro (C-01 `richText` sin validación de longitud, C-03 `StructureEntry.order`, C-04 clave de `attic`, C-05 `CompositionReport.fallbacks`) **las resolvió `1R-dominio` en paralelo durante esta misma ronda** — verificado al cerrar: `invariants.ts` valida ya la longitud de `richText`, `document.ts` usa `AtticKey` (`<slug>@<semver>`) y `composed.ts` mantiene `stillDefault`/`invalidValues`. Los contratos de este documento ya seguían el esquema TS, así que no requieren cambio. **C-02 quedó dirimida a favor de este documento** (X-07 / ADR-1R-X-03): la creación es exclusiva de `:choose-template` y `GET .../document` responde `404 TPL_DOCUMENT_NOT_STARTED` (§3.3). Crear en el `GET` obligaría al servidor a elegir plantilla por defecto (contra P3) y reintroduciría H-39. ADR-013 queda enmendada en esa cláusula.
