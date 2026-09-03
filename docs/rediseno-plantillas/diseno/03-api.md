# 03 — API del editor y del render público

Autor: fase 1, rol `1-api`. Estado: propuesto para aceptación (ADR-013…016).
Evidencia: `handoffs/0-resumen-auditoria-api.md`, `fases/D-consumo.md`, `01-dominio-y-esquema.md` (esquema, ADR-001…008), `02-persistencia-y-catalogo.md` (tablas), `handoffs/1-aura-lecciones.md` (publicación precompilada).

---

## 1. Principio de diseño

Tres superficies separadas por autorización y por caché (ADR-013): **edición** (autenticada, documento de trabajo mutable), **publicación** (autenticada, produce un `tpl_release` inmutable) y **render público** (sin auth, lee solo `tpl_release`, cacheable, nunca toca `tpl_document`). El invitado nunca dispara composición ni toca la tabla mutable — corrige de raíz H-04/H-05 y adopta la lección de aura.build de publicación como artefactos precompilados (`handoffs/1-aura-lecciones.md` #3).

Todas las rutas autenticadas exigen `HierarchyValidationService.validateInvitationAccess(requesterId, invitationId)` (ADR-015) antes de tocar cualquier tabla `tpl_*`. `invitationId` viene siempre de la ruta; ningún body acepta un id de documento, snapshot o release — se resuelven por el `invitationId` ya autorizado (mata H-13 por construcción).

## 2. Tabla de rutas

| Método y ruta | Auth | Qué hace | Body / query | Respuesta 2xx |
|---|---|---|---|---|
| `POST /editor/invitations/{invitationId}/document:choose-template` | editor | Crea el documento (primera vez) o cambia de plantilla (ADR-023 aplica migración/mueve a `attic`) | `{templateSlug, templateVersion}` | `201`/`200` `{revision, composed, report}` |
| `GET /editor/invitations/{invitationId}/document` | editor | Documento de trabajo + vista compuesta actual | — | `200 {document, revision, composed, report, templateVersion}` |
| `POST /editor/invitations/{invitationId}/document/operations` | editor | Aplica un lote de operaciones (reductor único, ADR-014) | `OperationBatch` | `200 {revision, idMap, composed, report}` |
| `GET /editor/invitations/{invitationId}/document/history` | editor | Lista paginada de snapshots (§4) | `?limit&cursor` | `200 {items:[{revision, createdAt, clientBatchId}], nextCursor}` |
| `POST /editor/invitations/{invitationId}/document/restore` | editor | Restaura `content`/`structure`/`theme` de una revisión pasada, RENORMALIZADOS contra la plantilla vigente (§4, ADR-029), como una revisión NUEVA | `{revision}` | `200 {revision, composed, report, movedToAttic: BlockId[]}` |
| `POST /editor/invitations/{invitationId}/assets` | editor | Sube un asset (foto/audio) del cliente | `multipart/form-data` | `201 {assetId, previewUrl}` |
| `GET /editor/invitations/{invitationId}/release/preflight` | editor | Reglas de publicación sin publicar (§6) | — | `200 {canPublish, report}` |
| `POST /editor/invitations/{invitationId}/release` | editor | Publica: congela `composed` en un `tpl_release` nuevo e inmutable | — | `201 {releaseId, publicUrl, contentHash, publishedAt}` |
| `GET /editor/invitations/{invitationId}/releases` | editor | Historial de publicaciones | `?limit&cursor` | `200 {items:[{releaseId, publishedAt, contentHash, isActive}]}` |
| `GET /public/i/{publicToken}/render` | ninguna | Documento renderizable del release activo | — | `200 {composed}` (§7, caché) |
| `GET /public/i/{publicToken}/exists` | ninguna | Sonda liviana para el editor ("¿ya es visible el link?") | — | `200 {published: boolean}` |
| `POST /master/templates2/versions` | rol `MASTER` (control de rol simple de `modules/master/**`, no `HierarchyValidationService` — no hay invitación que autorizar aquí) | Registro de plantilla, único camino de alta (`02 §4`, cierra el hallazgo adversarial S-02: ruta ausente de esta tabla en el primer borrador) | paquete completo: `template.json`+`theme.json`+`defaults.json`+`assets/*` (multipart) | `201 {templateVersionId, result:'created'}` / `200 {result:'noop_same_hash'}` |

`publicToken` es `tpl_document.public_token` (`02 §2.4`), nunca `invitationId`. El editor obtiene `publicUrl` (`https://.../i/{publicToken}`) en la respuesta de `POST .../release` y de `GET .../document`.

## 3. Contratos de request/response (extractos)

### 3.1 `POST .../document:choose-template`
```jsonc
// request
{ "templateSlug": "boda-clasica", "templateVersion": "1.0.0" }
// 201 si es la primera vez: documento nuevo con structure=defaultOrder del manifiesto, content={}
// 200 si ya existía documento con OTRA plantilla: aplica ADR-023 (mueve content actual a
//     attic["<slugAntiguo>@<versionAntigua>"], crea content nuevo vacío para la plantilla elegida)
// 200 si ya existía CON LA MISMA plantilla pero otra versión: aplica MigrationPlan (01 §6) con dryRun
//     obligatorio primero (ver 05-migracion.md §5); si no hay MigrationPlan registrado para ese salto
//     de versión → 409 TPL_MIGRATION_PLAN_MISSING
```

### 3.2 `GET .../document`
```jsonc
{
  "document": { "schemaVersion": 1, "template": {...}, "theme": {...}, "structure": {...}, "content": {...}, "attic": {...}, "meta": {...} },
  "revision": 42,
  "composed": { "composedVersion": 1, "template": {...}, "theme": {...}, "sections": [...] },
  "report": { "missingRequired": [], "stillDefault": ["couple.brideText"], "orphanContent": [], "orphanSections": [], "invalidValues": [], "themeFallback": null },
  "templateVersion": { "slug": "boda-clasica", "version": "1.0.0", "status": "published" }
}
```
`composed` se calcula en cada `GET` (`compose()`, ADR-007) — nunca se lee de una tabla; el `business` snapshot se toma de `invitation`/`invitation_guest` en la misma transacción de lectura.

### 3.3 `POST .../document/operations`
Body: `OperationBatch` (`esquema/operations.ts`). Comportamiento **todo o nada** para el editor humano (a diferencia del pipeline de IA de `07-extension-ia.md`, que descarta operación por operación): cada `Operation` se valida contra el manifiesto de la versión vigente (mismo `validateValueAgainstSpec` que `invariants.ts`) **antes** de aplicar ninguna; si una sola es inválida, se rechaza el lote completo con `422 TPL_OPERATION_INVALID` y el detalle de cuál. Justificación: un lote humano es pequeño (≤ 50), interactivo, y una aplicación parcial confundiría al undo del cliente (ADR-019); el pipeline de IA sí necesita descartar-y-continuar porque genera lotes sin supervisión operación por operación (`handoffs/1-aura-lecciones.md` #5).

**Validación de propiedad de `assetId` (ADR-030, cierra el hallazgo adversarial S-01).** Toda `Operation` que porte un `ImageValue`/`AudioValue` (directamente en `setBlock`/`addItem`/`setItemBlock`, o dentro de los `values` de un `addItem`) se valida, además de por forma (`AssetId` regex), por **pertenencia**: `SELECT 1 FROM tpl_asset WHERE public_id = ? AND (invitation_id = :invitationId OR template_version_id = :templateVersionId)` (`invitationId` de la ruta ya autorizada, `templateVersionId` vigente del documento). Sin fila → `422 TPL_ASSET_NOT_OWNED`, el lote completo se rechaza (mismo régimen todo-o-nada de esta sección). Sin este control, un `assetId` válido en formato pero perteneciente a OTRA invitación (visto por captura de red, o por acceso jerárquico legítimo a esa otra invitación) podría reutilizarse para mostrar la foto privada de un cliente ajeno — misma familia de riesgo que H-13 (referenciar un recurso ajeno por id), cerrada aquí de la misma forma: verificación de pertenencia en el servidor, nunca confianza en el formato del id.

Si `baseRevision` ≠ `tpl_document.revision` actual → `409 TPL_REVISION_CONFLICT` con `{currentRevision, currentDocument}` para que el cliente reconcilie (rebase local de sus operaciones pendientes sobre el documento fresco; no hay merge automático de conflictos de contenido — versión optimista + reintento, según `contratos.md` §2 "sin colaboración en tiempo real").

Reintentar el mismo `clientBatchId` tras un timeout de red es un no-op seguro: `UPDATE ... WHERE id=? AND revision=?` ya aplicado por un intento anterior hace que el segundo intento falle su propio chequeo de `baseRevision` (que el cliente actualiza tras cada éxito) — el servidor además guarda `client_batch_id` en el snapshot (`02 §2.5`) por si el cliente necesita confirmar "¿ya se aplicó mi lote?" con `GET .../document/history?clientBatchId=...`.

`addItem` con `tempId` devuelve `idMap: {"tmp:abc123": "01J8..."}" — el cliente reemplaza el id temporal en su estado local por el ULID definitivo.

### 3.4 `POST .../assets`
Multipart, campo `file`. Valida `content-type` contra `image/webp|png|jpeg`, `audio/mpeg|aac` y tamaño ≤ 15 MiB (límite duro de la API, independiente del `maxBytes` por bloque que valida `invariants.ts` cuando el asset se referencia desde un `setBlock`). Sube a S3 vía `S3Service.uploadPublicFile` con key `S3KeyService` (reusado, `invitation/{invitationId}/asset/{assetId}.{ext}`), inserta `tpl_asset(invitation_id=..., public_id=assetId, ...)`. Responde `assetId` (nunca la URL de S3 cruda — el `previewUrl` es una URL firmada de corta duración solo para que el editor muestre el preview inmediato; el documento nunca la persiste, ADR-021).

## 4. Undo e historial (ADR-011, ADR-019, ADR-029)

El undo *interactivo* (Ctrl+Z mientras se edita) es enteramente del cliente (pila de operaciones inversas, ADR-019) — no genera tráfico de red. `GET .../document/history` y `POST .../document/restore` son la red de seguridad del **servidor**: recuperar una sesión de edición si el cliente perdió su estado (recarga de página, otro dispositivo). `restore` nunca hace `UPDATE ... SET revision = <pasada>`: siempre crea una revisión nueva con el contenido de la vieja, preservando el historial completo (mismo espíritu que `attic`, ADR-006 — nada retrocede destructivamente).

**Revalidación obligatoria contra la plantilla vigente (ADR-029, cierra el hallazgo adversarial E-02).** `restore` NUNCA copia el `doc` crudo de la snapshot elegida. El caso que lo exige: una invitación edita `boda-clasica@1.0.0`, luego cambia de plantilla a `xv-jardin@1.0.0` (flujo C, `04 §2.1` — el `content` de boda se mueve a `attic`, `template_version_id` de la fila pasa a apuntar a `xv-jardin`); si el cliente restaura después una revisión de cuando la fila era `boda-clasica`, el `content` de esa snapshot tiene `blockId`s que no existen en `xv-jardin`. Por eso `restore` sigue este pipeline, no una copia:
1. Toma `content`/`structure`/`theme` de la snapshot elegida (ignora su campo `template` — es solo informativo/histórico).
2. Los pasa por el MISMO normalizador que usa `:choose-template` al cambiar de plantilla (§3.1): todo `blockId`/`sectionKey` de la snapshot que no exista en el manifiesto del `template_version_id` **actual** de la fila se mueve a `attic["<snapshot.template.slug>@<version>"]`, nunca se reintroduce tal cual.
3. Lo que sí coincide con el manifiesto vigente se valida contra `invariants.ts`/`Invariants.kt` igual que cualquier escritura (mismo `validateValueAgainstSpec`).
4. Se persiste como una revisión nueva; la respuesta incluye `movedToAttic` con los `blockId`s que no sobrevivieron la restauración, para que el chrome pueda avisar "parte de lo restaurado no aplica a tu plantilla actual".

Si la snapshot restaurada es de la MISMA versión de plantilla que la fila actual, este pipeline es un no-op funcional (todo coincide, nada va a `attic`) — el costo adicional solo aparece en el caso adversarial que lo motivó.

## 5. Contrato de errores (ADR-016)

Excepciones tipadas de `templates2.api`, cada una con handler explícito en `GeneralExceptionHandler.kt` (o un advice paralelo que no reemplaza el existente — decisión de implementación de fase 2). Nunca cae una excepción de este módulo al 500 genérico de Spring sin pasar por esta tabla:

| Código | HTTP | Cuándo |
|---|---|---|
| `TPL_TEMPLATE_VERSION_NOT_FOUND` | 404 | `slug@version` no existe o está `deprecated` y se intenta usar para un documento nuevo |
| `TPL_DOCUMENT_NOT_STARTED` | 404 | `GET .../document` sin haber llamado antes a `:choose-template` |
| `TPL_MANIFEST_INVALID` | 422 | Registro de plantilla: violaciones de `validateManifest` (lista completa en el body) |
| `TPL_VERSION_HASH_MISMATCH` | 409 | Registro de plantilla: mismo `slug@version`, contenido distinto (§`02` §4) |
| `TPL_MIGRATION_PLAN_MISSING` | 409 | `:choose-template` pide subir de versión mayor sin plan de migración registrado |
| `TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR` | 422 | Registro de plantilla: el diff estructural contra la versión anterior no está vacío y el bump no es mayor, o es mayor pero sin `MigrationPlan` que cubra cada elemento (`02 §4` paso 1.5, ADR-028) |
| `TPL_OPERATION_INVALID` | 422 | Alguna `Operation` del lote no valida contra el manifiesto (detalle por operación) |
| `TPL_ASSET_NOT_OWNED` | 422 | Un `assetId` referenciado no pertenece a esta invitación ni a la plantilla vigente (§3.3, ADR-030) |
| `TPL_REVISION_CONFLICT` | 409 | `baseRevision` desactualizada (control optimista, §3.3) |
| `TPL_BLOCK_UNKNOWN` | 422 | Una operación referencia un `blockId` no declarado en la versión vigente |
| `TPL_ASSET_TOO_LARGE` / `TPL_ASSET_TYPE_UNSUPPORTED` | 413 / 415 | Límite de `POST .../assets` (§3.4) |
| `TPL_PUBLISH_BLOCKED_MISSING_REQUIRED` | 422 | Publicar con bloques `required` sin valor de usuario ni default (§6) |
| `TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT` | 422 | Publicar con bloques `required` que siguen en `provenance: default` (R3, mata H-03: nunca se publica el placeholder de demo de un campo obligatorio sin que el cliente lo confirme) |
| `TPL_RELEASE_NOT_FOUND` | 404 | `GET /public/i/{token}/render` sin release activo, o `publicToken` inexistente (misma respuesta para ambos casos — no distinguir evita enumerar tokens válidos) |
| `TPL_FORBIDDEN` | 403 | `HierarchyValidationService` deniega — nunca 400 (mata H-52: un solo código para "sin permiso" en todo el módulo) |

Todo error 4xx del módulo devuelve el `ErrorMessage` existente (`core/error`) con `code` = uno de los anteriores, nunca el mensaje de excepción crudo de Kotlin.

## 6. Preflight de publicación (mata H-03 en la vía de publicación)

`GET .../release/preflight` y el paso previo de `POST .../release` corren la misma comprobación: sobre el `CompositionReport` fresco, si `report.missingRequired` no está vacío → bloquea con `TPL_PUBLISH_BLOCKED_MISSING_REQUIRED`; si algún `blockId` en `report.stillDefault` corresponde a un bloque `required` de la sección → bloquea con `TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT`, listando qué bloques (el editor los resalta). Bloques opcionales en `default` NO bloquean — es legítimo que una sección opcional se publique con placeholder mientras el cliente decide. Este preflight es la respuesta directa a H-03 en el punto exacto donde antes se publicaban datos de demo como si fueran reales.

## 7. Render público: caché e idempotencia

`GET /public/i/{publicToken}/render` lee **solo** `tpl_release` (join por `public_token` de `tpl_document` → `invitation_id` → release activo, `02 §2.4`/§2.4). Headers: `ETag: "<contentHash>"`, `Cache-Control: public, max-age=300, stale-while-revalidate=3600`. Un `If-None-Match` que coincide con `contentHash` responde `304` sin tocar Postgres para el body (el `SELECT` que resuelve `publicToken→release` sigue corriendo, es liviano y usa el índice único de `02 §2.4`). Publicar un release nuevo cambia `contentHash` automáticamente (R9, ADR-007): la invalidación de caché de CDN es automática por cambio de `ETag`, sin necesidad de purga activa.

`assetId` dentro de `composed` se resuelve a URL pública (bucket `ASSETS`, ya público hoy según `S3Buckets.kt`) en el momento de componer — nunca una URL firmada de corta duración en el render público (eso rompería el `Cache-Control` de 5 minutos).

**Límite de tasa (defensa en profundidad, cierra el hallazgo adversarial S-06, baja severidad — no bloqueante).** `publicToken` tiene ≈130 bits de entropía (ULID Crockford base32, no adivinable por fuerza bruta en la práctica), pero la capa de despliegue (CDN/reverse proxy, fuera de alcance de este módulo) debe aplicar igualmente un límite de tasa básico por IP sobre `/public/i/**` como práctica estándar, no como mitigación de un riesgo específico identificado.

## 8. Límites e idempotencia (resumen)

- `OperationBatch.operations` ≤ 50 (esquema); body HTTP ≤ 768 KiB (límite de Spring MVC a configurar en `templates2`, evita repetir H-45 "acepta cualquier JSON"). El valor 768 KiB, no 256 KiB como en el primer borrador de esta sección, corrige el hallazgo adversarial S-05: 50 operaciones `setBlock` sobre `richText` cerca de su máximo de 8000 caracteres (`esquema/blocks.ts`) pesan, solo en `value`, ≈ 400 KB antes de contar la estructura de `RichDoc` y el escape JSON — un límite de 256 KiB rechazaría lotes legítimos que el propio esquema permite construir.
- Asset ≤ 15 MiB por archivo (§3.4), máximo 200 assets por invitación (cuota blanda, `409 TPL_ASSET_QUOTA_EXCEEDED`, valor configurable, no ligado a hallazgo específico — registrado en `preguntas-abiertas.md` como supuesto conservador).
- Idempotencia real (no solo de status code) en: registro de plantilla (`packageHash`, `02 §4`), `OperationBatch` (`clientBatchId` + `baseRevision`), creación perezosa de `tpl_document` (`ON CONFLICT DO NOTHING`).
- Publicar (`POST .../release`) NO es idempotente por diseño: cada llamada crea un release nuevo aunque el contenido no haya cambiado (permite "republicar" para forzar recomposición si `business` cambió sin republicar antes) — pero es barato detectarlo: si `content_hash` del nuevo `composed` es igual al del release activo, la API responde `200` (no `201`) sin insertar fila nueva, evitando historial ruidoso de releases idénticos.

## 9. Integración reusada (solo lectura salvo lo indicado)

`HierarchyValidationService` (autorización, ADR-015), `S3Service`/`S3KeyService`/`S3Buckets` (assets, §3.4/§7), `JwtTokenFilter`/`Authentication` (identidad del `requesterId`), `InvitationGuestsRepository` (solo lectura, para que `03-api.md` futuro de RSVP —fuera de alcance— pueda cruzar conteos si se pidiera; este módulo no lo usa todavía), `GeneralExceptionHandler.kt` (handlers nuevos, §5). Ninguna integración escribe fuera de `tpl_*` salvo `invitation.uses_templates2` (`05-migracion.md` §4).

## 10. Lo que no pude determinar

- Si existe hoy algún límite de cuota de almacenamiento S3 por cliente/plan que este módulo deba respetar para `POST .../assets` — no hay evidencia en el inventario de fase 0. Supuesto conservador: 200 assets/invitación, registrado en `preguntas-abiertas.md`.
- Si `minPlanTier` del manifiesto (§`01` §2.2) debe bloquear `:choose-template` en la API (plan del cliente insuficiente) o si es solo informativo para el catálogo — el inventario no aclara cómo se lee hoy el plan del cliente en tiempo real desde `templates2`. Asumido: se valida en `:choose-template` contra un campo de plan ya resuelto en `BusinessSnapshot` (`composed.ts`), con `403 TPL_PLAN_TIER_INSUFFICIENT` si no alcanza — registrado como supuesto.
