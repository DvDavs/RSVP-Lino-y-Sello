# 02 — Persistencia y catálogo

Autor: fase 1, rol `1-persistencia`. Estado: propuesto para aceptación (ADR-009…012).
Evidencia: `handoffs/0-resumen-auditoria-persistencia.md`, `fases/A-modelo-datos.md`, `fases/B-alta-plantillas.md`, `fases/C3-regeneracion.md`, `01-dominio-y-esquema.md` (esquema y ADR-001…008).

---

## 1. Decisión de fondo

PostgreSQL con `JSONB` es el único almacén transaccional del módulo nuevo (ADR-009). Ninguna tabla nueva usa MongoDB. El módulo antiguo (`modules/user/invitations`, `modules/master/templates`, `core/data/MongoDataInitializer.kt`) sigue intacto y usando Mongo — no se toca (P10). El paquete Kotlin del módulo nuevo es `mx.evolutiondev.invitaciones.modules.templates2` (ADR-012), con subpaquete `templates2.persistence` para entidades/repositorios JPA de este documento.

Esto elimina de raíz, **para el módulo nuevo**, H-08 (cero transaccionalidad Mongo/Postgres): toda escritura de `templates2` es una transacción JDBC única, con la misma base de datos que `invitation`/`invitation_guest`.

## 2. Tablas (DDL, Flyway del módulo nuevo)

Numeración de migración: la última existente es `V28__add_whatsapp_sent_column.sql` (`handoffs/0-inventario.md` §3); el módulo nuevo empieza en `V29`. Un archivo por tabla, para que revertir una migración concreta en desarrollo sea quirúrgico.

### V29 — `tpl_template`

```sql
CREATE TABLE tpl_template (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(40) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tpl_template_slug UNIQUE (slug)
);
```
Fila creada la primera vez que se registra cualquier versión de un `slug`. No se borra nunca desde la API (borrar un catálogo entero es una operación MASTER manual fuera de alcance de este módulo).

### V30 — `tpl_template_version`

```sql
CREATE TABLE tpl_template_version (
    id               BIGSERIAL PRIMARY KEY,
    template_id      BIGINT NOT NULL REFERENCES tpl_template(id),
    version          VARCHAR(20) NOT NULL,               -- semver estricto, validado en Kotlin antes del insert
    version_major    SMALLINT NOT NULL,
    version_minor    SMALLINT NOT NULL,
    version_patch    SMALLINT NOT NULL,
    manifest         JSONB NOT NULL,                      -- template.json completo (01 §2.2)
    theme            JSONB NOT NULL,                      -- theme.json completo (01 §2.6)
    defaults         JSONB NOT NULL,                      -- defaults.json completo
    package_hash     CHAR(64) NOT NULL,                    -- sha256 canónico (ADR-008)
    status           VARCHAR(20) NOT NULL DEFAULT 'published'
                         CHECK (status IN ('published','deprecated')),
    min_plan_tier    SMALLINT NOT NULL,
    event_kinds      TEXT[] NOT NULL,                      -- denormalizado de manifest->>eventKinds para filtros de catálogo sin GIN
    published_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tpl_template_version UNIQUE (template_id, version),
    CONSTRAINT uq_tpl_template_version_hash UNIQUE (template_id, package_hash)
);
CREATE INDEX ix_tpl_template_version_latest
    ON tpl_template_version (template_id, version_major DESC, version_minor DESC, version_patch DESC);
CREATE INDEX ix_tpl_template_version_manifest_gin
    ON tpl_template_version USING GIN (manifest jsonb_path_ops);
CREATE INDEX ix_tpl_template_version_event_kinds
    ON tpl_template_version USING GIN (event_kinds);
```
**Inmutable una vez insertada** (ADR-001, ADR-008): ninguna ruta de la API ejecuta `UPDATE` sobre `manifest`/`theme`/`defaults`/`package_hash` de una fila existente. `uq_tpl_template_version_hash` es la clave real de idempotencia del registro (§4). `status = 'deprecated'` oculta la versión del selector de plantillas nuevas sin afectar los `tpl_document` que ya la usan (nunca se borra una versión con documentos que dependen de ella — `ix ... invitation` en §2.4 hace esa comprobación explícita antes de deprecar).

### V31 — `tpl_asset`

```sql
CREATE TABLE tpl_asset (
    id                    BIGSERIAL PRIMARY KEY,
    public_id             VARCHAR(29) NOT NULL,            -- "as_" + ULID(26) = 29 (ADR-021)
    template_version_id   BIGINT NULL REFERENCES tpl_template_version(id),
    invitation_id         BIGINT NULL REFERENCES invitation(id),
    s3_key                VARCHAR(500) NOT NULL,
    sha256                CHAR(64) NOT NULL,
    content_type          VARCHAR(60) NOT NULL,
    bytes                 INTEGER NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tpl_asset_public_id UNIQUE (public_id),
    CONSTRAINT ck_tpl_asset_owner CHECK (
        (template_version_id IS NOT NULL AND invitation_id IS NULL) OR
        (template_version_id IS NULL AND invitation_id IS NOT NULL)
    )
);
CREATE INDEX ix_tpl_asset_invitation ON tpl_asset (invitation_id);
CREATE INDEX ix_tpl_asset_template_version ON tpl_asset (template_version_id);
```
Un asset pertenece exactamente a una plantilla (fondo, icono del paquete) o a una invitación (foto subida por el cliente), nunca a ambas — el `CHECK` lo hace estructuralmente imposible de confundir (evita repetir, en el nuevo módulo, el patrón de claves ambiguas que hoy tiene `S3KeyService`). `s3_key` reutiliza `core/s3/S3KeyService.kt` (integración de solo escritura vía el `S3Service` existente, ver `03-api.md` §7); `public_id` es lo único que aparece en `tpl_document.doc`/`tpl_release.composed` (ADR-021 — nunca la URL ni la `s3_key`).

### V32 — `tpl_document`

```sql
CREATE TABLE tpl_document (
    id                    BIGSERIAL PRIMARY KEY,
    invitation_id         BIGINT NOT NULL REFERENCES invitation(id),
    template_version_id   BIGINT NOT NULL REFERENCES tpl_template_version(id),
    doc                   JSONB NOT NULL,                  -- InvitationDocument (01 §4)
    revision              BIGINT NOT NULL DEFAULT 0,
    public_token          VARCHAR(29) NOT NULL,            -- "pub_" + ULID(26)=29? ver nota; opaco, estable, NUNCA el invitation_id
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tpl_document_invitation UNIQUE (invitation_id),
    CONSTRAINT uq_tpl_document_public_token UNIQUE (public_token)
);
CREATE INDEX ix_tpl_document_template_version ON tpl_document (template_version_id);
```
Nota de longitud: `public_token` real es `"pub_" + ULID` = 4+26 = 30 caracteres; el tipo de columna correcto es `VARCHAR(30)` (corregido respecto al primer borrador de esta fila, que decía 29 — 29 es la longitud de `assetId`, `"as_"+ULID`, no la de `public_token`). Usar `VARCHAR(30)` en la migración real.

Una fila por invitación (creada perezosamente en el primer `GET` autenticado vía `INSERT … ON CONFLICT (invitation_id) DO NOTHING` seguido de un `SELECT`, mata la carrera de `ReentrantLock` por JVM de H-44: la exclusión la da el índice único, no un lock en memoria). En ese mismo `INSERT` se genera `public_token` (servidor, ULID) — **estable de por vida de la invitación**, independiente de cuántas veces se publique o se cambie de plantilla (a diferencia de un token derivado del contenido, que rompería un enlace ya compartido en cuanto el cliente editara algo). `revision` es el contador de control optimista de ADR-014; cada `OperationBatch` aplicado hace `UPDATE … SET doc = ?, revision = revision + 1, updated_at = now() WHERE id = ? AND revision = ?` — 0 filas afectadas ⇒ `409 TPL_REVISION_CONFLICT` (`03-api.md` §5).

### V33 — `tpl_document_snapshot`

```sql
CREATE TABLE tpl_document_snapshot (
    id                BIGSERIAL PRIMARY KEY,
    document_id       BIGINT NOT NULL REFERENCES tpl_document(id),
    revision          BIGINT NOT NULL,
    doc               JSONB NOT NULL,
    client_batch_id   VARCHAR(64) NULL,                    -- trazabilidad del OperationBatch que produjo esta revisión
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tpl_document_snapshot UNIQUE (document_id, revision)
);
CREATE INDEX ix_tpl_document_snapshot_created ON tpl_document_snapshot (created_at);
```
Un snapshot por revisión aplicada, en la MISMA transacción que el `UPDATE` de `tpl_document` (§2.3). Es la base del undo del lado servidor y de la retención (ADR-011, §5).

### V34 — `tpl_release`

```sql
CREATE TABLE tpl_release (
    id                     BIGSERIAL PRIMARY KEY,
    invitation_id          BIGINT NOT NULL REFERENCES invitation(id),
    template_version_id    BIGINT NOT NULL REFERENCES tpl_template_version(id),
    document_revision      BIGINT NOT NULL,                -- revisión de tpl_document compuesta en este release
    composed               JSONB NOT NULL,                 -- ComposedDocument (01 §5.1/esquema/composed.ts)
    report                 JSONB NOT NULL,                 -- CompositionReport congelado al publicar
    content_hash           CHAR(64) NOT NULL,               -- sha256(canonicalJson(composed)) — verifica R9
    is_active              BOOLEAN NOT NULL DEFAULT true,
    published_by           BIGINT NULL REFERENCES customer(id),
    published_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_tpl_release_active_per_invitation
    ON tpl_release (invitation_id) WHERE is_active;
CREATE INDEX ix_tpl_release_invitation_history ON tpl_release (invitation_id, published_at DESC);
```
`composed`/`report` son inmutables desde el momento en que se insertan (nunca `UPDATE`). Publicar de nuevo inserta una fila nueva y, en la misma transacción, pone `is_active = false` en la anterior (`ux_tpl_release_active_per_invitation` garantiza como máximo un release activo por invitación — el render público solo puede leer ese). Un cambio en `invitation.date`/`hashtag`/etc. **no** actualiza `tpl_release`: el release activo sigue sirviendo el contenido con el que se publicó hasta la siguiente publicación explícita — el editor marca ese release `stale` calculando en caliente si `business` actual difiere del congelado, nunca reescribiendo la fila (ADR-007).

### V35 — `tpl_template_registration`

```sql
CREATE TABLE tpl_template_registration (
    id               BIGSERIAL PRIMARY KEY,
    template_slug    VARCHAR(40) NOT NULL,
    version          VARCHAR(20) NOT NULL,
    requested_hash   CHAR(64) NOT NULL,
    result           VARCHAR(20) NOT NULL CHECK (result IN ('created', 'noop_same_hash', 'rejected')),
    error_code       VARCHAR(60) NULL,                     -- TPL_xxx si result = 'rejected'
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tpl_template_registration_slug ON tpl_template_registration (template_slug, created_at DESC);
```
Auditoría append-only de **cada intento** de registrar una plantilla, éxito o fallo — mata H-16/H-17 en su forma silenciosa: "la app arrancó sin plantillas" o "se creó sin visual" deja de ser posible sin una fila que lo explique. No tiene FK a `tpl_template_version` a propósito: un intento rechazado no tiene versión que referenciar.

### V36 — bandera de corte en `invitation` (única columna tocada de una tabla existente)

```sql
ALTER TABLE invitation ADD COLUMN uses_templates2 BOOLEAN NOT NULL DEFAULT false;
```
Justificado en ADR-023 (`05-migracion.md` §4). Es el único cambio de este módulo sobre una tabla que no le pertenece; no se tocan `invitation_template`, `default_visual_configs` ni ninguna otra tabla/colección del módulo antiguo.

## 3. Relación con el catálogo antiguo

`tpl_template`/`tpl_template_version` son tablas **nuevas y separadas** de `invitation_template` (Postgres, catálogo actual) y de `default_visual_configs`/`default_content_configs` (Mongo). No hay FK cruzada entre `tpl_template` e `invitation_template`: son dos catálogos independientes mientras dura la convivencia (P10). Esto evita repetir H-09 (colisión de ids con la secuencia de `invitation_template` en 10 tras `V25`): `tpl_template.id` tiene su propia secuencia, sin relación numérica con `invitation_template.id`. La migración (`05-migracion.md`) asocia una plantilla vieja con su equivalente nueva por `slug`, no por id.

## 4. Registro de plantillas: un solo paso, idempotente (ADR-008)

```kotlin
// templates2.persistence.TemplateRegistrar
fun register(pkg: TemplatePackageInput): RegistrationResult
```
1. Valida el manifiesto completo contra `invariants.ts`/`Invariants.kt` (`validateManifest`, `01 §2.2`+ADR-005). Cualquier violación → `INSERT tpl_template_registration(result='rejected', error_code=...)` y `422 TPL_MANIFEST_INVALID` con la lista de violaciones — nunca una fila parcial en `tpl_template_version`.
2. Calcula `packageHash`. `SELECT id FROM tpl_template_version WHERE template_id = ? AND package_hash = ?`:
   - Existe → `INSERT tpl_template_registration(result='noop_same_hash')`, responde `200` con la versión existente (idempotencia real, no solo de status code).
   - No existe pero `(template_id, version)` sí existe con otro hash → `INSERT tpl_template_registration(result='rejected', error_code='TPL_VERSION_HASH_MISMATCH')`, responde `409` (mata H-09: una versión publicada nunca se pisa).
   - No existe → sigue.
3. `INSERT INTO tpl_template (slug) VALUES (?) ON CONFLICT (slug) DO NOTHING` (crea el padre si es la primera versión del slug) + `INSERT INTO tpl_template_version (...)` + `INSERT tpl_template_registration(result='created')`, todo en **una transacción**. Cualquier fallo revierte las tres inserciones — no queda un `tpl_template` huérfano sin versión (mata H-16 en su forma nueva).
4. Los assets del paquete (`assets/*.webp` etc.) se suben a S3 (`core/s3/S3Service.kt`, bucket `ASSETS`) y se registran en `tpl_asset` con `template_version_id` **antes** del paso 3, dentro de la misma transacción JDBC de aplicación (la subida a S3 no es transaccional con Postgres — si S3 falla, el paso 3 no se ejecuta y no queda fila de versión; si Postgres falla tras subir a S3, el objeto en S3 queda huérfano pero inerte, limpiable por un job de basura por prefijo `template/<slug>/<version>/` sin urgencia, documentado como riesgo aceptado en `preguntas-abiertas.md`).

No existe una segunda vía de alta. A diferencia de las 6 vías actuales (`0-resumen-auditoria-persistencia.md`: Flyway, seed, `POST /master/templates`, `POST /master/templates/complete`, scripts `mongosh`/`psql`, edición manual), este único camino es el que expone la API MASTER y el que usa el kit de autor de fase 4 — sin atajos.

## 5. Retención (ADR-011)

Job diario (`@Scheduled(cron = "0 30 3 * * *")`, `templates2.persistence.SnapshotRetentionJob`) que purga `tpl_document_snapshot`:

```sql
DELETE FROM tpl_document_snapshot s
WHERE s.created_at < now() - interval '30 days'
  AND s.revision NOT IN (
      SELECT revision FROM tpl_document_snapshot s2
      WHERE s2.document_id = s.document_id
      ORDER BY revision DESC LIMIT 200
  )
  AND NOT EXISTS (
      SELECT 1 FROM tpl_release r
      WHERE r.invitation_id = (SELECT invitation_id FROM tpl_document WHERE id = s.document_id)
        AND r.document_revision = s.revision
  );
```
Protege siempre las últimas 200 revisiones y cualquier revisión que respalde un `tpl_release` existente (activo o no — un release histórico sigue siendo auditable). `tpl_release` en sí **nunca** se purga por este job (§2.4); su retiro es una operación MASTER manual fuera de alcance.

## 6. Convivencia con Postgres/Mongo actuales

- **Mongo no cambia**: `default_visual_configs`, `default_content_configs`, `invitation_configs` siguen existiendo, servidos por el módulo antiguo mientras `invitation.uses_templates2 = false` para esa invitación (ADR-023).
- **Postgres compartido**: `templates2` añade tablas nuevas (§2) y una columna a `invitation` (§2, V36); no modifica `invitation_template`, `invitation_guest`, `customer` ni ninguna tabla del dominio de auth/RSVP.
- **Transacciones cruzadas con `invitation`**: la única operación que toca `invitation` además de `tpl_*` es activar `uses_templates2` durante la migración (`05-migracion.md` §4) — una sola transacción JDBC que hace `INSERT tpl_document` + `UPDATE invitation SET uses_templates2 = true` juntos.

## 7. Lo que no pude determinar

- Tamaño real esperado de `manifest`/`composed` en producción (no hay acceso a documentos reales fuera de las 8 plantillas sembradas del repo). El `GIN` sobre `manifest` (§2.2) asume catálogos de decenas, no miles, de plantillas — razonable para el tamaño de negocio descrito en el brief, pero no verificado con datos reales. **Supuesto tomado, registrado en `preguntas-abiertas.md`.**
- Si `customer(id)` es el tipo correcto para `tpl_release.published_by` (podría ser un admin/master publicando en nombre del cliente) — asumido que cualquier rol autorizado por `HierarchyValidationService` puede publicar y el `id` que se guarda es el del `requesterId` autenticado, no necesariamente el dueño de la invitación.
