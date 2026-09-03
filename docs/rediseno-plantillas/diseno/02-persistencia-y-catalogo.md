# 02 — Persistencia y catálogo

Autor: fase 1, rol `1-persistencia`. **Revisado y profundizado a grado de implementación por `1R-backend` (ronda 1R, 2026-09-03).** Estado: propuesto para aceptación (ADR-009…012, ADR-1R-B-01…ADR-1R-B-10).
Evidencia: `handoffs/0-resumen-auditoria-persistencia.md`, `fases/A-modelo-datos.md`, `fases/B-alta-plantillas.md`, `fases/C3-regeneracion.md`, `01-dominio-y-esquema.md` (esquema y ADR-001…008) y **lectura directa del código real** citada línea a línea en §12 y §14.

> **Cómo leer este documento.** §2 es el DDL final, copiable, con el nombre exacto de cada archivo Flyway. §7 es el árbol de clases Kotlin, una línea por clase. §8-§9 fijan el mapeo JSONB y la validación contra el JSON Schema emitido. §10 fija el orden exacto de efectos con S3. §11 enumera los casos de prueba de fallo parcial. §14 es la tabla de objeciones de la ronda 1R.

---

## 1. Decisión de fondo

PostgreSQL con `JSONB` es el único almacén transaccional del módulo nuevo (ADR-009). Ninguna tabla nueva usa MongoDB. El módulo antiguo (`modules/user/invitations`, `modules/master/templates`, `core/data/MongoDataInitializer.kt`) sigue intacto y usando Mongo — no se toca (P10). El paquete Kotlin del módulo nuevo es `mx.evolutiondev.invitaciones.modules.templates2` (ADR-012), con subpaquete `templates2.persistence` para entidades/repositorios JPA de este documento.

Esto elimina de raíz, **para el módulo nuevo**, H-08 (cero transaccionalidad Mongo/Postgres): toda escritura de `templates2` es una transacción JDBC única, con la misma base de datos que `invitation`/`invitation_guest`.

Tres decisiones de la ronda 1R que condicionan todo lo demás y que no estaban fijadas antes:

1. **Persistencia con JPA/Hibernate, no con JDBC suelto** (ADR-1R-B-08). Verificado: `spring-boot-starter-data-jpa` está en `build.gradle.kts:35` y el `PlatformTransactionManager` de la aplicación es el `JpaTransactionManager` que crea Spring Boot. Usar `JdbcTemplate` en paralelo **no garantiza** compartir la conexión de la transacción JPA salvo que el `JpaTransactionManager` tenga el `DataSource` explícitamente inyectado, cosa que este proyecto no configura en ningún sitio (no hay ningún `@Bean` de `PlatformTransactionManager` en el repositorio — verificado por búsqueda). Con entidades JPA + `@Query(nativeQuery = true)` sobre repositorios Spring Data, toda sentencia va por el mismo `EntityManager` y, por tanto, por la misma transacción, sin depender de esa configuración. P6 exige esa garantía, no una probabilidad.
2. **El JSON lo serializa un único `ObjectMapper` de `templates2`**, no el de Spring ni uno ad-hoc (ADR-1R-B-06, cierra H-35 en el módulo nuevo — hoy el repositorio tiene cinco `ObjectMapper` distintos: `MongoDataInitializer.kt:27`, `JwtTokenFilter.kt:89`, `:104`, `AuthEntryPointJwt.kt:36`, `InvitationsAccessDeniedHandler.kt:44`, más el autoconfigurado de Spring que inyecta `MasterTemplatesService.kt:33`).
3. **`jsonb` no preserva el orden de claves ni los espacios.** Es una propiedad del tipo, no una opción. Por tanto `content_hash`/`package_hash` **no** pueden calcularse sobre "los bytes que están en la columna": se calculan sobre el JSON canónico (claves ordenadas lexicográficamente, sin espacios, `\n` ausente) producido por `Templates2Json.canonical()` **antes** de persistir, y se recalculan a partir del objeto deserializado cuando hay que verificarlos. R9 (`01 §5.2`) ya exige exactamente ese canónico; aquí se fija que es la única fuente del hash (ADR-1R-B-07).

## 2. Tablas (DDL final, Flyway del módulo nuevo)

**Numeración verificada el 2026-09-03**: `ls src/main/resources/db/migration/` da como última migración real `V28__add_whatsapp_sent_column.sql`. No existe ninguna `V29`+. La numeración `V29`-`V36` de `contratos.md` §5 **es correcta**; la ronda 1R añade **una migración más, `V37`**, para la cola de recolección de basura de S3 (§10.3), de modo que el rango real del módulo pasa a ser **`V29`-`V37`** (cambio de contrato, ADR-1R-B-03).

Configuración Flyway verificada en `src/main/resources/application.yml:39-45`: `locations: classpath:db/migration`, prefijo `V`, separador `__`, sufijo `.sql`, `baseline-on-migrate: true`. Los nombres de archivo de abajo son literales y deben crearse tal cual.

| Archivo Flyway (nombre exacto) | Objeto |
|---|---|
| `V29__create_tpl_template.sql` | `tpl_template` |
| `V30__create_tpl_template_version.sql` | `tpl_template_version` |
| `V31__create_tpl_asset.sql` | `tpl_asset` |
| `V32__create_tpl_document.sql` | `tpl_document` |
| `V33__create_tpl_document_snapshot.sql` | `tpl_document_snapshot` |
| `V34__create_tpl_release.sql` | `tpl_release` |
| `V35__create_tpl_template_registration.sql` | `tpl_template_registration` |
| `V36__add_uses_templates2_to_invitation.sql` | `invitation.uses_templates2` |
| `V37__create_tpl_asset_gc.sql` | `tpl_asset_gc` + trigger `trg_tpl_asset_gc` |

**Convención de tipos** (fijada aquí para que fase 2 no la reinvente): claves primarias `BIGSERIAL` (coherente con `invitation.id bigint` / `customer.id bigint`, verificado en `V1__initial_schema.sql:265-282` y `:60-83`); marcas de tiempo `TIMESTAMPTZ` (el resto del esquema usa `timestamp(6) with time zone`, compatible); hashes `CHAR(64)` en hexadecimal minúsculas; ningún `TEXT[]` ni tipo exótico (ver §8.3).

### V29 — `tpl_template`

```sql
-- V29__create_tpl_template.sql
CREATE TABLE tpl_template (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(40)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_tpl_template_slug UNIQUE (slug),
    CONSTRAINT ck_tpl_template_slug_format CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$')
);
```
Fila creada la primera vez que se registra cualquier versión de un `slug`. No se borra nunca desde la API (borrar un catálogo entero es una operación MASTER manual fuera de alcance de este módulo). El `CHECK` replica el patrón `TemplateSlug` de `esquema/common.ts:16` en la base, para que ni un script suelto pueda meter un slug fuera de contrato (P1).

### V30 — `tpl_template_version`

```sql
-- V30__create_tpl_template_version.sql
CREATE TABLE tpl_template_version (
    id               BIGSERIAL   PRIMARY KEY,
    template_id      BIGINT      NOT NULL REFERENCES tpl_template(id) ON DELETE RESTRICT,
    version          VARCHAR(20) NOT NULL,
    version_major    INTEGER     NOT NULL,
    version_minor    INTEGER     NOT NULL,
    version_patch    INTEGER     NOT NULL,
    manifest         JSONB       NOT NULL,
    theme            JSONB       NOT NULL,
    defaults         JSONB       NOT NULL,
    migration_plans  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    package_hash     CHAR(64)    NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'published',
    min_plan_tier    SMALLINT    NOT NULL DEFAULT 1,
    event_kinds      JSONB       NOT NULL,
    published_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_by     BIGINT      NULL REFERENCES customer(id) ON DELETE SET NULL,
    CONSTRAINT uq_tpl_template_version        UNIQUE (template_id, version),
    CONSTRAINT uq_tpl_template_version_hash   UNIQUE (template_id, package_hash),
    CONSTRAINT ck_tpl_template_version_status CHECK (status IN ('published','deprecated')),
    CONSTRAINT ck_tpl_template_version_semver CHECK (version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
    CONSTRAINT ck_tpl_template_version_tier   CHECK (min_plan_tier BETWEEN 1 AND 3),
    CONSTRAINT ck_tpl_template_version_hash   CHECK (package_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_tpl_template_version_kinds  CHECK (jsonb_typeof(event_kinds) = 'array' AND jsonb_array_length(event_kinds) BETWEEN 1 AND 8),
    CONSTRAINT ck_tpl_template_version_manifest CHECK (jsonb_typeof(manifest) = 'object'),
    CONSTRAINT ck_tpl_template_version_theme    CHECK (jsonb_typeof(theme) = 'object'),
    CONSTRAINT ck_tpl_template_version_defaults CHECK (jsonb_typeof(defaults) = 'object')
);
CREATE INDEX ix_tpl_template_version_latest
    ON tpl_template_version (template_id, version_major DESC, version_minor DESC, version_patch DESC);
CREATE INDEX ix_tpl_template_version_manifest_gin
    ON tpl_template_version USING GIN (manifest jsonb_path_ops);
CREATE INDEX ix_tpl_template_version_event_kinds_gin
    ON tpl_template_version USING GIN (event_kinds jsonb_path_ops);
CREATE INDEX ix_tpl_template_version_catalog
    ON tpl_template_version (status, min_plan_tier);
```

Cambios de la ronda 1R respecto al borrador y su motivo:

- **`event_kinds` pasa de `TEXT[]` a `JSONB`** (ADR-1R-B-09). `application.yml:32` fija `spring.jpa.hibernate.ddl-auto: validate`: Hibernate valida **al arrancar** cada entidad contra el esquema real, y un desajuste **no rompe solo `templates2`, rompe el arranque de toda la aplicación**. El mapeo de arrays SQL de Hibernate 6 sobre PostgreSQL es la parte del mapeo con más aristas (`@JdbcTypeCode(SqlTypes.ARRAY)` + tipo de componente + dialecto); `jsonb` es el mismo mecanismo que ya usamos para `manifest`, con un solo camino de mapeo para todo el módulo. La consulta de catálogo pasa de `event_kinds && ARRAY['wedding']` a `event_kinds @> '["wedding"]'::jsonb`, igual de indexada con GIN.
- **`version_major/minor/patch` pasan de `SMALLINT` a `INTEGER`.** `Semver` (`esquema/common.ts:19`) no acota el número; `SMALLINT` (máx. 32767) es un límite artificial que produciría un fallo de inserción en vez de un error de contrato.
- **`migration_plans JSONB`**: mapa `{"<from>": MigrationPlan}` con los planes que trae el paquete (`migrations/<from>-to-<version>.json`, `esquema/manifest.ts:95-100`). Sin esta columna, `:choose-template` no puede aplicar `MigrationPlan` (`03 §3.1`) sin leer del sistema de archivos en tiempo de ejecución — que es precisamente el acoplamiento que ADR-004/ADR-008 eliminan. Es un cambio de contrato (ADR-1R-B-02).
- **`published_by`** para auditoría del alta (quién registró la versión), `ON DELETE SET NULL` por el motivo de §5.3.
- **`ON DELETE RESTRICT` hacia `tpl_template`**: una plantilla con versiones no se borra por accidente.

**Inmutable una vez insertada** (ADR-001, ADR-008): ninguna ruta de la API ejecuta `UPDATE` sobre `manifest`/`theme`/`defaults`/`migration_plans`/`package_hash`/`version` de una fila existente. El único `UPDATE` admitido es `status: 'published' → 'deprecated'` (y solo desde una operación MASTER). `uq_tpl_template_version_hash` es la clave real de idempotencia del registro (§4). `status = 'deprecated'` oculta la versión del selector de plantillas nuevas sin afectar los `tpl_document` que ya la usan (nunca se borra una versión con documentos que dependen de ella — lo garantiza el `ON DELETE RESTRICT` de `tpl_document.template_version_id`, §2 V32).

### V31 — `tpl_asset`

```sql
-- V31__create_tpl_asset.sql
CREATE TABLE tpl_asset (
    id                    BIGSERIAL   PRIMARY KEY,
    public_id             VARCHAR(29) NOT NULL,
    template_version_id   BIGINT      NULL REFERENCES tpl_template_version(id) ON DELETE RESTRICT,
    invitation_id         BIGINT      NULL REFERENCES invitation(id)           ON DELETE CASCADE,
    bucket                VARCHAR(63) NOT NULL,
    s3_key                VARCHAR(500) NOT NULL,
    sha256                CHAR(64)    NOT NULL,
    content_type          VARCHAR(60) NOT NULL,
    bytes                 BIGINT      NOT NULL,
    width                 INTEGER     NULL,
    height                INTEGER     NULL,
    created_by            BIGINT      NULL REFERENCES customer(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tpl_asset_public_id UNIQUE (public_id),
    CONSTRAINT uq_tpl_asset_key       UNIQUE (bucket, s3_key),
    CONSTRAINT ck_tpl_asset_public_id_format CHECK (public_id ~ '^as_[0-9A-HJKMNP-TV-Z]{26}$'),
    CONSTRAINT ck_tpl_asset_sha256    CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_tpl_asset_bytes     CHECK (bytes > 0 AND bytes <= 15728640),
    CONSTRAINT ck_tpl_asset_content_type CHECK (content_type IN (
        'image/webp','image/png','image/jpeg','image/svg+xml','audio/mpeg','audio/aac','font/woff2')),
    CONSTRAINT ck_tpl_asset_owner CHECK (
        (template_version_id IS NOT NULL AND invitation_id IS NULL) OR
        (template_version_id IS NULL     AND invitation_id IS NOT NULL)
    )
);
CREATE INDEX ix_tpl_asset_invitation        ON tpl_asset (invitation_id);
CREATE INDEX ix_tpl_asset_template_version  ON tpl_asset (template_version_id);
CREATE UNIQUE INDEX ux_tpl_asset_invitation_sha
    ON tpl_asset (invitation_id, sha256) WHERE invitation_id IS NOT NULL;
CREATE UNIQUE INDEX ux_tpl_asset_version_sha
    ON tpl_asset (template_version_id, sha256) WHERE template_version_id IS NOT NULL;
```

Un asset pertenece exactamente a una plantilla (fondo, icono del paquete) o a una invitación (foto subida por el cliente), nunca a ambas — el `CHECK` lo hace estructuralmente imposible de confundir. `public_id` es lo único que aparece en `tpl_document.doc`/`tpl_release.composed` (ADR-021 — nunca la URL ni la `s3_key`).

Cambios de la ronda 1R:

- **`ON DELETE CASCADE` hacia `invitation`** (ADR-1R-B-04, objeción **B-01**, severidad ALTA). Verificado en código real: `InvitationRepository.kt:42-43` declara `@Query(value = "DELETE FROM invitation WHERE id = :id", nativeQuery = true) fun hardDeleteById(...)` y se invoca desde `InvitationAdminService.kt:382` y `AdminUsersService.kt:426`. Es decir, **el borrado físico de una invitación existe hoy y se ejecuta desde la administración**. Con el DDL del borrador (sin cláusula `ON DELETE`, es decir `NO ACTION`), la primera invitación con documento `templates2` que un administrador intentara borrar habría fallado con violación de clave foránea, rompiendo una función existente del producto. `V9__add_cascade_delete_to_invitation_relations.sql` demuestra que la convención del proyecto para cualquier tabla hija de `invitation` es exactamente `ON DELETE CASCADE`; `templates2` la sigue.
- **`ux_tpl_asset_invitation_sha` / `ux_tpl_asset_version_sha`**: índices únicos parciales por `sha256` dentro del dueño. Son la clave de idempotencia real de la subida de assets (§10.1): subir dos veces el mismo archivo devuelve el mismo `assetId` en vez de duplicar el objeto en S3 y la fila.
- **`bucket`** explícito: `S3Buckets.kt:155-157` declara dos buckets (`EDITOR`, `ASSETS`); guardar solo la clave dejaría la fila ambigua si mañana el módulo usa el otro. `uq_tpl_asset_key` sobre `(bucket, s3_key)` impide que dos filas reclamen el mismo objeto.
- **`bytes BIGINT`** (era `INTEGER`) y `CHECK` contra el mismo tope que `AssetEntry.bytes` de `esquema/manifest.ts:49` (15 728 640).
- **`width`/`height`** nulos: `AssetIndex` de `esquema/composed.ts:23-25` los declara opcionales; sin columna no habría de dónde sacarlos.
- **`created_by`**: quién subió el asset, para la traza de borrado GDPR de §5.3.

### V32 — `tpl_document`

```sql
-- V32__create_tpl_document.sql
CREATE TABLE tpl_document (
    id                    BIGSERIAL   PRIMARY KEY,
    invitation_id         BIGINT      NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
    template_version_id   BIGINT      NOT NULL REFERENCES tpl_template_version(id) ON DELETE RESTRICT,
    doc                   JSONB       NOT NULL,
    revision              BIGINT      NOT NULL DEFAULT 0,
    public_token          VARCHAR(30) NOT NULL,
    doc_bytes             INTEGER     NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by            BIGINT      NULL REFERENCES customer(id) ON DELETE SET NULL,
    CONSTRAINT uq_tpl_document_invitation   UNIQUE (invitation_id),
    CONSTRAINT uq_tpl_document_public_token UNIQUE (public_token),
    CONSTRAINT ck_tpl_document_public_token CHECK (public_token ~ '^pub_[0-9A-HJKMNP-TV-Z]{26}$'),
    CONSTRAINT ck_tpl_document_revision     CHECK (revision >= 0),
    CONSTRAINT ck_tpl_document_doc          CHECK (jsonb_typeof(doc) = 'object'),
    CONSTRAINT ck_tpl_document_doc_bytes    CHECK (doc_bytes >= 0 AND doc_bytes <= 1048576)
);
CREATE INDEX ix_tpl_document_template_version ON tpl_document (template_version_id);
```

`public_token` es `"pub_" + ULID` = 4 + 26 = **30 caracteres**, de ahí `VARCHAR(30)` (el borrador decía 29, que es la longitud de `assetId`, `"as_" + ULID`; corregido y ahora blindado con `CHECK`). Entropía: ULID lleva 48 bits de tiempo + **80 bits aleatorios**; la parte imprevisible es de 80 bits, no de 130 — la afirmación de "≈130 bits de entropía" de `03 §7` (heredada de `09 §S-06`) es incorrecta y se corrige en `03 §7`. 80 bits siguen siendo suficientes contra enumeración por fuerza bruta, pero el número correcto importa para la decisión de límite de tasa.

Una fila por invitación (creada perezosamente en el primer acceso autenticado vía `INSERT … ON CONFLICT (invitation_id) DO NOTHING` seguido de un `SELECT`, mata la carrera de `ReentrantLock` por JVM de H-44: la exclusión la da el índice único, no un lock en memoria). En ese mismo `INSERT` se genera `public_token` (servidor, ULID) — **estable de por vida de la invitación** salvo rotación explícita (`03 §3.10`), independiente de cuántas veces se publique o se cambie de plantilla.

`revision` es el contador de control optimista de ADR-014; cada `OperationBatch` aplicado hace
`UPDATE tpl_document SET doc = ?, doc_bytes = ?, revision = revision + 1, updated_at = now(), updated_by = ? WHERE id = ? AND revision = ?`
— 0 filas afectadas ⇒ `409 TPL_REVISION_CONFLICT` (`03 §5`).

**`doc_bytes` y su `CHECK` de 1 MiB** son una corrección de la ronda 1R (objeción **B-05**, severidad ALTA). Motivo verificado: `validateValueAgainstSpec` (`esquema/invariants.ts:93-134`) **no tiene rama para `richText`**, así que `RichTextSpec.constraints.maxLength` (`esquema/blocks.ts:148`, tope 8000) **nunca se comprueba**; y el esquema puro de `RichDoc` (`esquema/blocks.ts:17-18`) permite 40 párrafos × 50 spans × 2000 caracteres ≈ 4·10⁶ caracteres en **un solo valor**. Sin un tope de documento, un cliente autenticado puede hacer crecer su `doc` sin cota, lote legítimo tras lote legítimo (cada uno por debajo del límite de body de 768 KiB), hasta degradar toda la tabla por TOAST. El tope se comprueba en la aplicación **antes** del `UPDATE` (`TPL_DOCUMENT_TOO_LARGE`, `03 §5`) y el `CHECK` sobre `doc_bytes` es la red de seguridad de la base. No se usa `CHECK (octet_length(doc::text) <= …)` porque la conversión `jsonb→text` por E/S no es aceptada como expresión inmutable en todas las versiones de PostgreSQL y rompería la migración: se guarda el tamaño calculado por la aplicación en una columna, que sí es comprobable.

### V33 — `tpl_document_snapshot`

```sql
-- V33__create_tpl_document_snapshot.sql
CREATE TABLE tpl_document_snapshot (
    id                BIGSERIAL   PRIMARY KEY,
    document_id       BIGINT      NOT NULL REFERENCES tpl_document(id) ON DELETE CASCADE,
    revision          BIGINT      NOT NULL,
    doc               JSONB       NOT NULL,
    client_batch_id   VARCHAR(64) NULL,
    origin            VARCHAR(20) NOT NULL DEFAULT 'operations',
    created_by        BIGINT      NULL REFERENCES customer(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tpl_document_snapshot          UNIQUE (document_id, revision),
    CONSTRAINT ck_tpl_document_snapshot_revision CHECK (revision >= 0),
    CONSTRAINT ck_tpl_document_snapshot_origin   CHECK (origin IN ('operations','choose_template','restore','import','ai'))
);
CREATE INDEX ix_tpl_document_snapshot_created  ON tpl_document_snapshot (created_at);
CREATE INDEX ix_tpl_document_snapshot_doc_rev  ON tpl_document_snapshot (document_id, revision DESC);
CREATE UNIQUE INDEX ux_tpl_document_snapshot_batch
    ON tpl_document_snapshot (document_id, client_batch_id) WHERE client_batch_id IS NOT NULL;
```

Un snapshot por revisión aplicada, en la MISMA transacción que el `UPDATE` de `tpl_document`. Es la base del undo del lado servidor y de la retención (ADR-011, §5).

**`ux_tpl_document_snapshot_batch` es la idempotencia real del `OperationBatch`** (corrección de la ronda 1R, objeción **B-03**, severidad ALTA). El borrador afirmaba que reenviar el mismo `clientBatchId` "es un no-op seguro porque el segundo intento falla su propio chequeo de `baseRevision`". Eso **no es cierto en el caso que importa**: si el cliente no llegó a ver la respuesta del primer intento (timeout de red), su `baseRevision` local **sigue siendo la vieja**, luego el reintento no falla por conflicto — vuelve a aplicar el mismo lote sobre una revisión que ya lo incorporó, duplicando ítems de grupo y pisando textos. Con este índice, el reintento con el mismo `(document_id, clientBatchId)` choca contra el índice único; la capa de aplicación lo captura y responde **`200` con el resultado de la revisión que ese lote produjo** (§10.5, `03 §3.3`), que es la semántica de idempotencia que ADR-014 promete. Ventana de idempotencia = la de retención de snapshots (§5): 200 revisiones o 30 días.

`origin` distingue qué produjo la revisión, para que `restore` (`03 §4`) y la auditoría no tengan que adivinarlo.

### V34 — `tpl_release`

```sql
-- V34__create_tpl_release.sql
CREATE TABLE tpl_release (
    id                     BIGSERIAL   PRIMARY KEY,
    invitation_id          BIGINT      NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
    template_version_id    BIGINT      NOT NULL REFERENCES tpl_template_version(id) ON DELETE RESTRICT,
    document_revision      BIGINT      NOT NULL,
    composed               JSONB       NOT NULL,
    report                 JSONB       NOT NULL,
    business_snapshot      JSONB       NOT NULL,
    content_hash           CHAR(64)    NOT NULL,
    is_active              BOOLEAN     NOT NULL DEFAULT true,
    published_by           BIGINT      NULL REFERENCES customer(id) ON DELETE SET NULL,
    published_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    unpublished_at         TIMESTAMPTZ NULL,
    CONSTRAINT ck_tpl_release_hash     CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_tpl_release_revision CHECK (document_revision >= 0),
    CONSTRAINT ck_tpl_release_composed CHECK (jsonb_typeof(composed) = 'object'),
    CONSTRAINT ck_tpl_release_unpublished CHECK (is_active = false OR unpublished_at IS NULL)
);
CREATE UNIQUE INDEX ux_tpl_release_active_per_invitation
    ON tpl_release (invitation_id) WHERE is_active;
CREATE INDEX ix_tpl_release_invitation_history ON tpl_release (invitation_id, published_at DESC);
CREATE INDEX ix_tpl_release_hash ON tpl_release (invitation_id, content_hash);
```

`composed`/`report`/`business_snapshot`/`content_hash` son inmutables desde el momento en que se insertan (nunca `UPDATE`). Los únicos campos mutables de la fila son `is_active` y `unpublished_at`. Publicar de nuevo inserta una fila nueva y, en la misma transacción, pone `is_active = false` en la anterior (`ux_tpl_release_active_per_invitation` garantiza como máximo un release activo por invitación — el render público solo puede leer ese). Un cambio en `invitation.date`/`hashtag`/etc. **no** actualiza `tpl_release`: el release activo sigue sirviendo el contenido con el que se publicó hasta la siguiente publicación explícita; el editor marca ese release `stale` comparando `business_snapshot` congelado contra el actual, nunca reescribiendo la fila (ADR-007).

Cambios de la ronda 1R: `business_snapshot` congelado (sin él no hay forma de calcular `stale` sin recomponer, que es lo que `03 §6` promete y el borrador no permitía); `unpublished_at` y la relajación del `UNIQUE` parcial para soportar despublicar (`03 §3.9`, ADR-1R-B-05); `ON DELETE CASCADE`/`SET NULL` por el mismo motivo verificado que en V31.

### V35 — `tpl_template_registration`

```sql
-- V35__create_tpl_template_registration.sql
CREATE TABLE tpl_template_registration (
    id                    BIGSERIAL   PRIMARY KEY,
    template_slug         VARCHAR(40) NOT NULL,
    version               VARCHAR(20) NOT NULL,
    requested_hash        CHAR(64)    NOT NULL,
    result                VARCHAR(20) NOT NULL,
    error_code            VARCHAR(60) NULL,
    detail                JSONB       NULL,
    template_version_id   BIGINT      NULL REFERENCES tpl_template_version(id) ON DELETE SET NULL,
    requested_by          BIGINT      NULL REFERENCES customer(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_tpl_template_registration_result CHECK (result IN ('created','noop_same_hash','rejected')),
    CONSTRAINT ck_tpl_template_registration_error  CHECK (
        (result = 'rejected' AND error_code IS NOT NULL) OR (result <> 'rejected' AND error_code IS NULL))
);
CREATE INDEX ix_tpl_template_registration_slug ON tpl_template_registration (template_slug, created_at DESC);
```

Auditoría append-only de **cada intento** de registrar una plantilla, éxito o fallo — mata H-16/H-17 en su forma silenciosa: "la app arrancó sin plantillas" o "se creó sin visual" deja de ser posible sin una fila que lo explique. `detail` guarda la lista de violaciones (`Violation[]` de `esquema/invariants.ts:8`) o los elementos del diff estructural rechazado, para que el autor de la plantilla sepa exactamente qué corregir sin releer logs.

**Punto crítico de implementación (objeción B-04, severidad MEDIA):** una fila de auditoría de un intento **rechazado** solo sobrevive si se escribe **fuera** de la transacción que se revierte. Con `@Transactional` por defecto, `INSERT tpl_template_registration(result='rejected') ` + lanzar la excepción = la fila desaparece con el rollback, y la auditoría no audita nada. Fase 2 debe escribir esa fila con `@Transactional(propagation = Propagation.REQUIRES_NEW)` en `TemplateRegistrationAuditor` (§7), commit propio, antes de propagar la excepción al controlador. Está enumerado como caso de prueba en §11 (`registrationRejected_auditRowSurvivesRollback`).

### V36 — bandera de corte en `invitation`

```sql
-- V36__add_uses_templates2_to_invitation.sql
ALTER TABLE invitation ADD COLUMN uses_templates2 BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX ix_invitation_uses_templates2 ON invitation (uses_templates2) WHERE uses_templates2;
```
Única columna añadida a una tabla existente (ADR-023, `05-migracion.md` §4). El índice parcial es lo que permite listar "invitaciones ya migradas" sin recorrer la tabla entera.

**Aviso de acoplamiento verificado (objeción B-08, severidad MEDIA):** `InvitationEntity` (`modules/admin/invitations/repository/model/InvitationEntity.kt:17-173`) es una `data class` JPA sobre la tabla `invitation` y la aplicación arranca con `spring.jpa.hibernate.ddl-auto: validate` (`application.yml:32`). Añadir una columna **`NOT NULL` sin mapearla en la entidad no rompe la validación de Hibernate** (validate comprueba que exista lo mapeado, no que no exista lo demás), pero **sí rompería cualquier `INSERT` generado por Hibernate si la columna no tuviera `DEFAULT`** — por eso el `DEFAULT false` es obligatorio y no cosmético. `templates2` **no** mapea `uses_templates2` en `InvitationEntity` (sería tocar el módulo antiguo, prohibido); lo lee y escribe con un `@Query(nativeQuery = true)` propio en `Templates2FlagRepository` (§7).

### V37 — `tpl_asset_gc` (cola de borrado de objetos S3)

```sql
-- V37__create_tpl_asset_gc.sql
CREATE TABLE tpl_asset_gc (
    id            BIGSERIAL    PRIMARY KEY,
    bucket        VARCHAR(63)  NOT NULL,
    s3_key        VARCHAR(500) NOT NULL,
    public_id     VARCHAR(29)  NOT NULL,
    reason        VARCHAR(30)  NOT NULL DEFAULT 'row_deleted',
    attempts      INTEGER      NOT NULL DEFAULT 0,
    last_error    VARCHAR(500) NULL,
    enqueued_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ  NULL,
    CONSTRAINT uq_tpl_asset_gc_key CHECK (attempts >= 0)
);
CREATE INDEX ix_tpl_asset_gc_pending ON tpl_asset_gc (enqueued_at) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION tpl_asset_gc_enqueue() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tpl_asset_gc (bucket, s3_key, public_id, reason)
    VALUES (OLD.bucket, OLD.s3_key, OLD.public_id, 'row_deleted');
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tpl_asset_gc
    AFTER DELETE ON tpl_asset
    FOR EACH ROW EXECUTE FUNCTION tpl_asset_gc_enqueue();
```

Por qué un *trigger* y no una llamada desde el servicio (ADR-1R-B-03): el borrado de `tpl_asset` ocurre por **tres** caminos, y solo uno pasa por código de `templates2`. (a) borrado explícito de un asset por el editor; (b) **cascada** desde `DELETE FROM invitation` (`InvitationRepository.kt:42-43`, invocado en `InvitationAdminService.kt:382` y `AdminUsersService.kt:426`) — código del módulo antiguo, que no podemos tocar; (c) borrado manual por operación. Solo un trigger de base de datos captura los tres. Sin él, borrar una invitación deja los objetos de S3 **huérfanos para siempre y sin rastro de su clave**, lo que además impide cumplir un derecho al olvido: no quedaría ninguna fila desde la que saber qué borrar (objeción **B-02**, severidad ALTA). Con la cola, `AssetGcJob` (§7) borra en S3 lo que la base ya soltó, con reintentos y sin bloquear ninguna transacción de usuario.

## 3. Relación con el catálogo antiguo

`tpl_template`/`tpl_template_version` son tablas **nuevas y separadas** de `invitation_template` (Postgres, catálogo actual) y de `default_visual_configs`/`default_content_configs` (Mongo). No hay FK cruzada entre `tpl_template` e `invitation_template`: son dos catálogos independientes mientras dura la convivencia (P10). Esto evita repetir H-09 (colisión de ids con la secuencia de `invitation_template` en 10 tras `V25`): `tpl_template.id` tiene su propia secuencia, sin relación numérica con `invitation_template.id`. La migración (`05-migracion.md`) asocia una plantilla vieja con su equivalente nueva por `slug`, no por id.

**Lo único que ambos mundos comparten es la fila `invitation`** y, por tanto, el borrado en cascada de §2 V31/V32/V34. Verificado: `invitation` es tabla de la aplicación completa, no del módulo antiguo (`V1__initial_schema.sql:265`).

## 4. Registro de plantillas: un solo paso, idempotente (ADR-008, ADR-028)

```kotlin
// mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrar
fun register(pkg: TemplatePackageInput, requesterId: Long): RegistrationResult
```

Orden exacto de efectos (todo lo numerado 3-7 está dentro de **una** transacción; 1, 2 y 8 no):

1. **Fuera de transacción.** Se leen las partes del multipart en memoria (`template.json`, `theme.json`, `defaults.json`, `migrations/*.json`, `assets/*`), con el límite de tamaño de `03 §8`. Se valida cada archivo JSON contra su **JSON Schema emitido** (§9): `template-manifest`, `theme`, `defaults`, `migration-plan`. Cualquier fallo → auditoría `rejected` (§2 V35, transacción propia) + `422 TPL_MANIFEST_INVALID` con la lista de errores del validador. **Nada más se ejecuta.**
2. **Fuera de transacción.** Se ejecutan las invariantes de paquete `validateManifest(m, theme, defaults)` (`esquema/invariants.ts:25-61` ⇄ `Invariants.kt`). Violaciones → auditoría `rejected` + `422 TPL_MANIFEST_INVALID` con `Violation[]` en `detail`. Se verifica además que **cada `AssetEntry.sha256`/`bytes`/`contentType` del manifiesto coincida con el archivo realmente subido**; si no, `422 TPL_PACKAGE_ASSET_MISMATCH` (código nuevo, ronda 1R — sin esta comprobación el `packageHash` de ADR-008 puede calcularse sobre un manifiesto que no describe los bytes que se van a subir).
3. **Transacción abierta.** `SELECT id FROM tpl_template WHERE slug = ? FOR UPDATE` tras `INSERT INTO tpl_template (slug) VALUES (?) ON CONFLICT (slug) DO NOTHING`. El `FOR UPDATE` sobre la fila del slug serializa dos registros concurrentes del mismo slug (evita que dos MASTER registren `1.1.0` y `1.2.0` a la vez y ambos calculen el diff contra `1.0.0`).
4. **Idempotencia.** `SELECT id, version FROM tpl_template_version WHERE template_id = ? AND package_hash = ?`:
   - Existe → auditoría `noop_same_hash` (misma transacción, aquí sí, porque no hay rollback) y `200` con la versión existente. **Fin.** Idempotencia real, no solo de código de estado.
   - No existe, pero `(template_id, version)` sí existe con otro hash → auditoría `rejected('TPL_VERSION_HASH_MISMATCH')` (transacción propia, la principal se revierte) y `409`. Mata H-09: una versión publicada nunca se pisa.
5. **Diff estructural (ADR-028).** Si el slug ya tiene alguna versión `published`, se carga la de mayor `(major, minor, patch)` y se calcula `structuralDiff(anterior, nueva)`: `blockId`s presentes antes y ausentes ahora, `sectionKey`s removidos, `type` de un `blockId` que cambió, `min`/`max` de un grupo que se redujo, `Ident` de paleta/fontSet eliminado.
   - Diff no vacío y bump **no** mayor → auditoría `rejected('TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR')` + `422` con la lista.
   - Diff no vacío y bump mayor → se exige un `MigrationPlan` en `migration_plans` cuyas `ops` cubran **cada** elemento del diff (`removeBlock`/`renameBlock`/`changeBlockType`/`removeSection`/`renameSection`/`shrinkGroup`/`renamePalette`/`renameFontSet`, `esquema/manifest.ts:81-94`); si falta cobertura de algún elemento → mismo código, mismo `422`.
   - Diff vacío → sigue sin exigir plan.
6. **Assets del paquete.** Para cada `AssetEntry`: `s3_key = "templates2/template/<slug>/<version>/<sha256>.<ext>"` (determinista, §10.1); `SELECT` en `tpl_asset` por `(template_version_id IS NULL AND sha256 = ?)` **no** aplica todavía porque la versión aún no existe, así que se acumulan en memoria y se insertan en el paso 7. **La subida a S3 ocurre ANTES de abrir la transacción**, en el paso 2b (ver §10.2): S3 no es transaccional y el orden correcto es "primero el objeto, después la fila", nunca al revés.
7. `INSERT INTO tpl_template_version (...) RETURNING id` + `INSERT INTO tpl_asset (...)` por cada asset + `INSERT tpl_template_registration(result='created', template_version_id=…)`. **Commit.**
8. **Fuera de transacción.** Si el commit falló, los objetos ya subidos a S3 quedan huérfanos pero **inertes y deterministas**: la misma clave se reescribiría idéntica en el reintento, así que no se acumulan copias. `AssetGcJob` (§10.3, modo *scan*) los detecta comparando el prefijo `templates2/template/<slug>/<version>/` contra `tpl_asset` y los borra pasada una ventana de gracia de 24 h.

No existe una segunda vía de alta. A diferencia de las 6 vías actuales (`0-resumen-auditoria-persistencia.md`: Flyway, seed, `POST /master/templates`, `POST /master/templates/complete`, scripts `mongosh`/`psql`, edición manual), este único camino es el que expone la API MASTER (`POST /master/templates2/versions`, ADR-033) y el que usa el kit de autor de fase 4 — sin atajos.

## 5. Retención, borrado y derecho al olvido

### 5.1 Purga de snapshots (ADR-011)

Job diario `templates2.persistence.SnapshotRetentionJob`, `@Scheduled(cron = "0 30 3 * * *")`, en lotes de 5 000 filas para no tomar un bloqueo largo:

```sql
DELETE FROM tpl_document_snapshot s
USING (
    SELECT s2.id
    FROM   tpl_document_snapshot s2
    JOIN   tpl_document d ON d.id = s2.document_id
    WHERE  s2.created_at < now() - interval '30 days'
      AND  s2.revision <= (
             SELECT max(s3.revision) - 200
             FROM   tpl_document_snapshot s3
             WHERE  s3.document_id = s2.document_id)
      AND  NOT EXISTS (
             SELECT 1 FROM tpl_release r
             WHERE  r.invitation_id = d.invitation_id
               AND  r.document_revision = s2.revision)
    ORDER BY s2.id
    LIMIT 5000
) victim
WHERE s.id = victim.id;
```

Protege siempre las últimas 200 revisiones de cada documento y cualquier revisión que respalde un `tpl_release` existente (activo o no — un release histórico sigue siendo auditable). La reescritura respecto al borrador es funcional, no cosmética: el `NOT IN (SELECT … ORDER BY … LIMIT 200)` correlacionado del borrador es un `LIMIT` sin correlación válida en PostgreSQL y habría purgado de más o fallado; aquí se compara contra `max(revision) - 200`, que es lo que "las últimas 200" significa cuando las revisiones son un contador monótono por documento (objeción **B-06**, severidad MEDIA).

`tpl_release` **nunca** se purga por este job; su retiro es una operación MASTER manual fuera de alcance.

### 5.2 Borrado de invitación (soft y duro)

- **Soft delete** — `@SQLDelete(sql = "UPDATE invitation SET is_enabled = false …")` en `InvitationEntity.kt:15`: la fila permanece, `tpl_document`/`tpl_release`/`tpl_asset` permanecen. **Efecto obligatorio para `templates2`**: el render público debe dejar de servir esa invitación (`03 §7`, `TPL_INVITATION_UNAVAILABLE`), replicando la comprobación que ya hace `PublicGuestInfoController.kt:65-75` para el flujo de invitados. Sin esto, deshabilitar una invitación desde la administración **no** la retiraría del público — regresión funcional respecto al módulo antiguo (objeción **B-07**, severidad ALTA).
- **Borrado duro** — `InvitationRepository.kt:42-43` + `InvitationAdminService.kt:382` / `AdminUsersService.kt:426`: la cascada de §2 borra `tpl_document` (y con él sus snapshots), `tpl_release` y `tpl_asset`; el trigger de §2 V37 encola los objetos S3 para borrado real. Ningún `templates2` bloquea el borrado de una invitación.

### 5.3 Borrado de cliente y derecho al olvido

`CustomerRepository.hardDeleteById` existe (`core/auth/repository/CustomerRepository.kt:85`) y se invoca en `AdminUsersService.kt:433`, tras borrar sus invitaciones (`:426`). Todas las referencias de `templates2` a `customer(id)` (`tpl_document.updated_by`, `tpl_document_snapshot.created_by`, `tpl_release.published_by`, `tpl_asset.created_by`, `tpl_template_version.published_by`, `tpl_template_registration.requested_by`) son `NULL`ables con `ON DELETE SET NULL`: **`templates2` nunca impide borrar un cliente**, y no conserva su identidad tras el borrado. Con el borrado en cascada de sus invitaciones más la cola de §2 V37, el contenido personal (documentos, releases, fotos en S3) desaparece de verdad. Lo que queda es `tpl_template_registration` (auditoría de altas de plantillas, sin dato personal salvo `requested_by`, que se anula) — retención justificada por integridad del catálogo, no por el cliente.

**Supuesto tomado** (registrado en `preguntas-abiertas.md`): no existe un requisito legal explícito de plazo máximo para la cola `tpl_asset_gc`; se fija un objetivo operativo de **24 h** entre el borrado de la fila y el borrado del objeto en S3.

## 6. Convivencia con Postgres/Mongo actuales

- **Mongo no cambia**: `default_visual_configs`, `default_content_configs`, `invitation_configs` siguen existiendo, servidos por el módulo antiguo mientras `invitation.uses_templates2 = false` para esa invitación (ADR-023).
- **`MongoDataInitializer` sigue ejecutándose tal cual.** Verificado: es un `CommandLineRunner` (`core/data/MongoDataInitializer.kt:24`) que siembra el catálogo antiguo en cada arranque. `templates2` **no lo toca, no lo desactiva y no depende de él**; el catálogo nuevo se puebla exclusivamente por `POST /master/templates2/versions` (§4). Que el seeder falle (H-16/H-17) ya no puede dejar al módulo nuevo sin plantillas, porque no comparten almacén.
- **Invitaciones aún no migradas** (`uses_templates2 = false`): no tienen fila en `tpl_document`. Toda ruta `/editor/**` de `templates2` responde `409 TPL_NOT_MIGRATED` si la bandera está en `false` y la invitación no ha pasado por `:choose-template`. **Esto es una decisión de la ronda 1R** (ADR-1R-B-10): sin ella, un cliente podría empezar a editar en `templates2` una invitación que el módulo antiguo sigue sirviendo, y tendríamos exactamente el estado mixto de H-04/H-05 en el módulo nuevo. La bandera se activa **solo** por el proceso de migración (`05-migracion.md` §4) o por el primer `:choose-template` de una invitación **sin** `invitation_configs` en Mongo (invitación nueva); nunca implícitamente.
- **Postgres compartido**: `templates2` añade tablas nuevas (§2) y una columna a `invitation` (V36); no modifica `invitation_template`, `invitation_guest`, `customer` ni ninguna tabla del dominio de auth/RSVP.
- **Transacciones cruzadas con `invitation`**: la única operación que escribe en `invitation` es activar `uses_templates2` — una sola transacción JDBC que hace `INSERT tpl_document` + `UPDATE invitation SET uses_templates2 = true` juntos (`05-migracion.md` §4), vía `Templates2FlagRepository` (§7), nunca vía `InvitationEntity`.

## 7. Estructura de paquetes Kotlin (una línea por clase)

Raíz: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/templates2/` (ADR-012). Nada fuera de aquí salvo las migraciones Flyway y las dos líneas de `build.gradle.kts` de §9.

### 7.1 `templates2.domain` — tipos puros, sin Spring, sin JPA, sin Jackson

| Clase | Qué hace |
|---|---|
| `TemplateSlug.kt` | `@JvmInline value class` con el patrón de `esquema/common.ts:16`; rechaza en el constructor. |
| `SemverVersion.kt` | `data class(major,minor,patch)` comparable; `parse`/`toString`; sin prerelease (contrato de `common.ts:19`). |
| `BlockId.kt` | value class con `BLOCK_ID_PATTERN` (`common.ts:8`). |
| `SectionKey.kt` | value class con `SECTION_KEY_PATTERN` (`common.ts:12`). |
| `AssetId.kt` | value class `as_<ULID>`; `AssetId.of(ulid)`. |
| `PublicToken.kt` | value class `pub_<ULID>`. |
| `ItemId.kt` | value class ULID de ítem de grupo. |
| `Revision.kt` | value class `Long` no negativo. |
| `InvitationDocument.kt` | espejo Kotlin de `esquema/document.ts:16-26` (`schemaVersion`, `template`, `theme`, `structure`, `content`, `attic`, `meta`). |
| `BlockValue.kt` | jerarquía `sealed` de los 14 tipos de valor de `esquema/blocks.ts`. |
| `BlockSpec.kt` | jerarquía `sealed` de las 14 especificaciones + `SpecBase` (`blocks.ts:133-196`). |
| `TemplateManifest.kt` | espejo de `esquema/manifest.ts:56-71`. |
| `ThemeSpec.kt` | espejo de `manifest.ts:38-43`. |
| `DefaultsFile.kt` | espejo de `manifest.ts:74-78`. |
| `MigrationPlan.kt` | espejo de `manifest.ts:81-100` (`MigrationOp` sealed). |
| `TemplatePackage.kt` | agregado inmutable `manifest + theme + defaults + planes` que consume `compose`. |
| `BusinessSnapshot.kt` | espejo de `esquema/composed.ts:9-20`. |
| `ComposedDocument.kt` | espejo de `composed.ts:79-85`. |
| `CompositionReport.kt` | espejo de `composed.ts:87-94` (`missingRequired`, `stillDefault`, `orphanContent`, `orphanSections`, `invalidValues`, `themeFallback`). |
| `Operation.kt` | `sealed interface` con las 10 operaciones de `esquema/operations.ts:10-22`. |
| `OperationBatch.kt` | `data class(baseRevision, clientBatchId, operations)`. |
| `EditProposal.kt` | espejo de `operations.ts:32-36` (lo consume fase de IA, aquí solo el tipo). |
| `StructuralDiff.kt` | resultado de `structuralDiff` (§4 paso 5): elementos eliminados/renombrados/estrechados. |
| `RegistrationResult.kt` | `sealed`: `Created`, `NoopSameHash`, `Rejected(code, detail)`. |
| `Templates2Exception.kt` | `sealed class` raíz de todas las excepciones del módulo, con `code: TplErrorCode` y `status: HttpStatus`. |
| `TplErrorCode.kt` | `enum class` con **todos** los códigos de `03 §5`; es la fuente única de la tabla de errores. |

### 7.2 `templates2.schema` — validación y JSON

| Clase | Qué hace |
|---|---|
| `Templates2Json.kt` | `object` con **el único** `ObjectMapper` del módulo (§8.1), `canonical(node): String` (claves ordenadas, sin espacios) y `sha256Canonical(node): String`. |
| `JsonSchemaRegistry.kt` | `@Component` que carga los 10 `*.schema.json` del classpath una sola vez (`JsonSchemaFactory` draft 2020-12) y los cachea por nombre. |
| `JsonSchemaValidatorService.kt` | valida un `JsonNode` contra un esquema por nombre; traduce `ValidationMessage` a `Violation`. |
| `Invariants.kt` | puerto Kotlin de `esquema/invariants.ts`: `validateManifest`, `validateDocument`, `validateValueAgainstSpec`. |
| `InvariantCode.kt` | `enum` con `I-01`…`I-23` exactamente como `invariants.ts:9-17`. |
| `Violation.kt` | `data class(code, path, detail?)`. |
| `CanonicalJson.kt` | serialización canónica determinista (ordenación lexicográfica recursiva de claves de objeto; los arrays conservan orden). |
| `PackageHasher.kt` | `packageHash = sha256(canonical(manifest) ‖ sha256 de cada asset ordenado por ruta)` (ADR-008). |

### 7.3 `templates2.composition` — funciones puras

| Clase | Qué hace |
|---|---|
| `Composer.kt` | `fun interface` con la firma de `01 §5.1`. |
| `DefaultComposer.kt` | implementación de R1-R9; sin reloj, sin E/S, sin `Locale.getDefault()`. |
| `ValueResolver.kt` | cascada de R2 (user → default → empty) y marca de `provenance` (R3). |
| `BusinessProjector.kt` | R4: resuelve bloques `source = "business"` desde `BusinessSnapshot` por `businessField`. |
| `ThemeResolver.kt` | R8: paleta/tipografía elegidas o por defecto, con `themeFallback`. |
| `DateFormatting.kt` | `formatDate(value, formatId, locale)` con catálogo cerrado de `formatId` (R6, mata H-27). |
| `AssetUrlResolver.kt` | `AssetId → URL pública`, puro: recibe el mapa `assetId → (bucket, key)` ya cargado; construye la URL con la plantilla de `§10.4`. |
| `OperationReducer.kt` | **el reductor único**: `(doc, ops, manifest) → (doc', idMap, violations)`; lo comparten editor, autoguardado e IA (ADR-014). |
| `DocumentNormalizer.kt` | normalización contra el manifiesto vigente (mueve a `attic`); lo usan `:choose-template` y `restore` (ADR-029). |
| `ContentHasher.kt` | `contentHash = sha256(canonical(composed))` (R9). |

### 7.4 `templates2.persistence` — entidades, repositorios y almacenes

| Clase | Qué hace |
|---|---|
| `TplTemplateEntity.kt` … `TplAssetGcEntity.kt` (8) | entidades JPA 1:1 con las 8 tablas de §2. |
| `TplTemplateRepository.kt` | `JpaRepository`; `findBySlug`, `insertIgnoreConflict` (`@Query` nativo con `ON CONFLICT DO NOTHING`), `lockBySlug` (`FOR UPDATE`). |
| `TplTemplateVersionRepository.kt` | `findByTemplateIdAndVersion`, `findByTemplateIdAndPackageHash`, `findLatestPublished`, `searchCatalog(eventKind, planTier)` (`@>` sobre `event_kinds`). |
| `TplAssetRepository.kt` | `findByPublicId`, `existsOwned(publicId, invitationId, templateVersionId)`, `findByInvitationIdAndSha256`, `countByInvitationId`. |
| `TplDocumentRepository.kt` | `findByInvitationId`, `insertIfAbsent` (nativo, `ON CONFLICT (invitation_id) DO NOTHING`), `lockByInvitationId` (`FOR UPDATE`), `applyRevision(id, doc, bytes, expectedRevision, userId)` (nativo, devuelve filas afectadas), `findByPublicToken`, `rotatePublicToken`. |
| `TplDocumentSnapshotRepository.kt` | `insertSnapshot`, `findByDocumentIdAndRevision`, `findByDocumentIdAndClientBatchId`, `pageHistory`. |
| `TplReleaseRepository.kt` | `findActiveByInvitationId`, `findActiveByPublicToken` (join con `tpl_document`), `deactivateActive`, `insertRelease`, `pageHistory`. |
| `TplTemplateRegistrationRepository.kt` | `insertAudit` (append-only). |
| `TplAssetGcRepository.kt` | `pollPending(limit)`, `markDeleted`, `markFailed`. |
| `Templates2FlagRepository.kt` | **único** acceso a `invitation.uses_templates2` (`@Query` nativo de lectura y de `UPDATE`); nunca vía `InvitationEntity`. |
| `BusinessSnapshotReader.kt` | construye `BusinessSnapshot` leyendo `invitation` + plan con una consulta de proyección de solo lectura (no carga el grafo de `InvitationEntity`). |
| `DocumentStore.kt` | operaciones transaccionales sobre el documento: crear perezosamente, aplicar lote, restaurar, cambiar plantilla. |
| `ReleaseStore.kt` | publicar / despublicar / historial, con el bloqueo de §11.2. |
| `AssetStore.kt` | alta y baja de assets, cuota, idempotencia por `sha256`. |
| `Templates2S3KeyService.kt` | construye las claves deterministas de §10.1. **No** reutiliza `S3KeyService.generateInvitationAssetKey` (§14, objeción B-09). |
| `TemplateRegistrar.kt` | el algoritmo de §4. |
| `TemplateRegistrationAuditor.kt` | escribe `tpl_template_registration` con `REQUIRES_NEW` (§2 V35). |
| `SnapshotRetentionJob.kt` | `@Scheduled` de §5.1. |
| `AssetGcJob.kt` | `@Scheduled` de §10.3 (cola + barrido por prefijo). |
| `UlidGenerator.kt` | ULID Crockford base32 monótono; **la única** fuente de `assetId`, `itemId` y `public_token` (P8). |
| `Templates2JsonConfig.kt` | `@Configuration`: bean `templates2ObjectMapper` (no `@Primary`) + `HibernatePropertiesCustomizer` que fija el `FormatMapper` de Hibernate (§8.1). |

### 7.5 `templates2.api` — controladores, DTO y errores

| Clase | Qué hace |
|---|---|
| `EditorDocumentController.kt` | `:choose-template`, `GET /document`, `POST /document/operations`, `GET /document/history`, `POST /document/restore`. |
| `EditorAssetController.kt` | `POST /assets`, `DELETE /assets/{assetId}`, `GET /assets`. |
| `EditorReleaseController.kt` | `preflight`, `POST /release`, `DELETE /release`, `GET /releases`, `POST /public-token:rotate`. |
| `PublicRenderController.kt` | `GET /public/i/{token}/render`, `GET /public/i/{token}/exists`. |
| `MasterTemplateRegistryController.kt` | `POST /master/templates2/versions`, `GET /master/templates2/versions`, `POST /master/templates2/versions/{id}:deprecate`. |
| `CatalogController.kt` | `GET /editor/templates2/catalog` (plantillas publicadas visibles para el plan del cliente). |
| `EditorDocumentService.kt` | orquesta autorización + `DocumentStore` + `Composer`; una transacción por operación de escritura. |
| `EditorAssetService.kt` | orquesta validación de archivo, S3 y `AssetStore` con el orden de §10.1. |
| `ReleaseService.kt` | preflight, publicación, despublicación. |
| `PublicRenderService.kt` | resolución de token → release activo + comprobaciones de disponibilidad (§5.2). |
| `Templates2ExceptionHandler.kt` | `@RestControllerAdvice(basePackages = ["…templates2.api"])` + `@Order(HIGHEST_PRECEDENCE)` (`03 §10`). |
| `Templates2BodyLimitFilter.kt` | `OncePerRequestFilter` que aplica el límite de 768 KiB por `Content-Length` y por lectura contada (`03 §8`). |
| `TplErrorResponse.kt` | DTO de error del módulo: `{timestamp, statusCode, code, message, details?}` (§14, objeción B-10). |
| DTO de petición/respuesta | `ChooseTemplateRequest/Response`, `DocumentResponse`, `OperationBatchRequest`, `OperationBatchResponse`, `HistoryPageResponse`, `RestoreRequest/Response`, `AssetUploadResponse`, `AssetListResponse`, `PreflightResponse`, `ReleaseResponse`, `ReleaseListResponse`, `RenderResponse`, `ExistsResponse`, `RegisterTemplateResponse`, `CatalogResponse`. |
| Excepciones | `TemplateVersionNotFoundException`, `DocumentNotStartedException`, `RevisionConflictException`, `OperationInvalidException`, `BlockUnknownException`, `AssetNotOwnedException`, `AssetQuotaExceededException`, `AssetTooLargeException`, `AssetTypeUnsupportedException`, `ManifestInvalidException`, `VersionHashMismatchException`, `BreakingChangeNotMajorException`, `MigrationPlanMissingException`, `PublishBlockedException`, `ReleaseNotFoundException`, `InvitationUnavailableException`, `NotMigratedException`, `PlanTierInsufficientException`, `DocumentTooLargeException`, `BodyTooLargeException`, `ForbiddenException` — todas heredan de `Templates2Exception` (§7.1). |

### 7.6 `templates2.migration`

| Clase | Qué hace |
|---|---|
| `DocumentMigrator.kt` | `migrate(doc, from, to, plan)` de `01 §6`, puro. |
| `StructuralDiffCalculator.kt` | `structuralDiff(anterior, nueva)` de §4 paso 5. |
| `MigrationPlanCoverageChecker.kt` | comprueba que un `MigrationPlan` cubre cada elemento del diff (ADR-028). |
| `LegacyConfigExtractor.kt` | extracción desde `invitation_configs` (fase 5; aquí solo el hueco). |
| `LegacyMigrationRunner.kt` | corte por invitación: `INSERT tpl_document` + `UPDATE invitation SET uses_templates2 = true` en una transacción (`05 §4`). |

## 8. JSONB con Hibernate 6 y el `ObjectMapper` único (H-35)

### 8.1 Un solo `ObjectMapper`, no `@Primary`

```kotlin
// templates2.persistence.Templates2JsonConfig
@Configuration
class Templates2JsonConfig {

    @Bean("templates2ObjectMapper")          // NO @Primary: no cambia el mapper de la aplicación
    fun templates2ObjectMapper(): ObjectMapper =
        JsonMapper.builder()
            .addModule(KotlinModule.Builder().build())
            .addModule(JavaTimeModule())
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)   // P1: nada se descarta en silencio
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .serializationInclusion(JsonInclude.Include.NON_NULL)
            .build()

    @Bean
    fun templates2HibernateJsonMapper(
        @Qualifier("templates2ObjectMapper") mapper: ObjectMapper
    ) = HibernatePropertiesCustomizer { props ->
        props[AvailableSettings.JSON_FORMAT_MAPPER] = JacksonJsonFormatMapper(mapper)
    }
}
```

Por qué así y no de otra forma:

- **No `@Primary`.** Cambiar el `ObjectMapper` de la aplicación activaría `FAIL_ON_UNKNOWN_PROPERTIES` para el módulo antiguo, que explícitamente depende de lo contrario (H-35: la API tolera claves desconocidas; diez clases de `EditorModels.kt` no llevan `@JsonIgnoreProperties`). Sería romper el módulo antiguo desde el nuevo, justo lo que P10 prohíbe.
- **`FAIL_ON_UNKNOWN_PROPERTIES = true` es P1 literal.** El JSON de `templates2` procede de un esquema cerrado (`z.strictObject` en todo `esquema/*.ts`); una clave desconocida es un error de contrato, no algo que descartar.
- **`HibernatePropertiesCustomizer`** es la única forma limpia de que la serialización que hace Hibernate al escribir `jsonb` use *ese* mapper y no uno por defecto. Efecto colateral acotado y verificado: **ninguna entidad del repositorio usa hoy tipos JSON** (búsqueda de `JdbcTypeCode`/`SqlTypes` en `src/main/kotlin`: 0 resultados), así que el `FormatMapper` global solo lo consumirá `templates2`.
- **Sin dependencias nuevas.** Hibernate 6.6 (que arrastra Spring Boot 3.4.1, `build.gradle.kts:6`) trae `SqlTypes.JSON` y `JacksonJsonFormatMapper` en el núcleo; `jackson-module-kotlin` ya está (`build.gradle.kts:42`). **No hace falta `hypersistence-utils`.**

### 8.2 Anotación exacta en las entidades

```kotlin
@Entity
@Table(name = "tpl_document")
class TplDocumentEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,

    @Column(name = "invitation_id", nullable = false, updatable = false)
    var invitationId: Long = 0,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "doc", columnDefinition = "jsonb", nullable = false)
    var doc: JsonNode = NullNode.instance,
    …
)
```

- El tipo del atributo es **`com.fasterxml.jackson.databind.JsonNode`**, no `String` ni una clase de dominio. Motivos: (a) el `FormatMapper` de Jackson serializa/deserializa `JsonNode` sin ambigüedad, mientras que un `String` anotado como JSON puede acabar doble-codificado según la versión de Hibernate — riesgo que no hace falta correr; (b) el documento se valida contra el JSON Schema como árbol antes de convertirlo a dominio, así que el árbol es la representación natural en la frontera; (c) mantiene la entidad estable aunque el dominio evolucione. La conversión `JsonNode ⇄ InvitationDocument` la hace `Templates2Json` en la capa de servicio.
- `columnDefinition = "jsonb"` es **obligatorio** para que `ddl-auto: validate` (`application.yml:32`) no falle el arranque de **toda** la aplicación.
- `@GenerationType.IDENTITY` sobre `BIGSERIAL`, igual que el resto del proyecto (`InvitationEntity.kt:18`).
- Ninguna entidad de `templates2` usa `@SQLDelete` ni `@Filter`: no hay borrado lógico en este módulo.

### 8.3 Tipos prohibidos en `templates2`

`TEXT[]` y cualquier array SQL (ver §2 V30), tipos enumerados de PostgreSQL, `hstore`, `json` (sin la `b`), `money`, `timestamp` sin zona. Motivo común: `ddl-auto: validate` convierte un desajuste de mapeo en un fallo de arranque de la aplicación completa, y el coste de esos tipos no compensa ese riesgo.

## 9. Validación contra el JSON Schema emitido desde Zod

### 9.1 Librería

- Coordenada Maven: **`com.networknt:json-schema-validator:1.5.4`** (`implementation("com.networknt:json-schema-validator:1.5.4")`).
- Draft: **2020-12**, que es el que emite `emit-json-schema.ts:22` (`target: "draft-2020-12"`). Soportado por networknt desde 1.0.73; se fija 1.5.x por ser la línea con soporte completo de `$dynamicRef`/`unevaluatedProperties`. **Verificación pendiente de fase 2**: confirmar la última 1.5.x disponible en el repositorio Maven en el momento de implementar; el requisito duro es el soporte de draft 2020-12, no el número exacto.
- Usa Jackson, ya presente (`build.gradle.kts:42`); no arrastra dependencias transitivas problemáticas.
- Alternativa descartada: `everit-org/json-schema` (solo hasta draft-07; los esquemas emitidos usan `prefixItems`/`const` de 2020-12).

### 9.2 Dónde vive el esquema emitido

`emit-json-schema.ts:3-5` ya lo fija: la salida es `frontend/packages/schema/json-schema/<nombre>.schema.json` y **Gradle la incluye como recurso, sin copiarla a mano**:

```kotlin
// build.gradle.kts — dos líneas, la única modificación de build de este módulo
sourceSets.main { resources.srcDir("frontend/packages/schema/json-schema") }
dependencies { implementation("com.networknt:json-schema-validator:1.5.4") }
```

En tiempo de ejecución, `JsonSchemaRegistry` carga `classpath:/<nombre>.schema.json` para los 10 nombres de `emit-json-schema.ts:15-19`: `template-manifest`, `theme`, `defaults`, `migration-plan`, `invitation-document`, `operation-batch`, `edit-proposal`, `composed-document`, `business-snapshot`, `composition-report`.

### 9.3 Mecanismo que rompe el build si el backend y el frontend divergen

Tres cierres independientes, todos en `check`:

1. **Tarea Gradle `verifyJsonSchemaEmitted`** (tipo `Exec` + comparación): ejecuta `pnpm --filter @invitaciones/schema schema:emit "$buildDir/schema-check"` y falla si `diff -r frontend/packages/schema/json-schema "$buildDir/schema-check"` no está vacío. Es decir: **si alguien editó a mano un `.schema.json`, o cambió un `.ts` sin regenerar, el build de Kotlin falla.** Se engancha con `tasks.named("check") { dependsOn("verifyJsonSchemaEmitted") }`. Si `pnpm` no está disponible (entorno sin Node), la tarea se marca `onlyIf { project.hasProperty("withNode") || System.getenv("CI") != null }` — en CI siempre corre, en local es opcional.
2. **Prueba Kotlin `JsonSchemaPresenceTest`**: afirma que los 10 nombres esperados existen en el classpath, que cada uno declara `"$schema": "https://json-schema.org/draft/2020-12/schema"` y que su `$id` coincide con `https://invitaciones.evolutiondev.mx/schema/<nombre>.schema.json` (`emit-json-schema.ts:23`). Falla si alguien añade un esquema al TS y no lo publica, o al revés.
3. **Prueba Kotlin `InvariantParityTest`**: recorre `frontend/packages/schema/golden/invariants/*.json` (la tabla compartida de `contratos.md` §6) y exige que `Invariants.kt` produzca **el mismo conjunto de códigos** que el caso declara. Es lo que impide que la implementación Kotlin de las 23 invariantes se separe de la de TypeScript, que es el riesgo real de tenerlas duplicadas (ADR-005).

## 10. Assets y S3: orden exacto de efectos y compensación

S3 **no** participa de la transacción de Postgres. Toda la política se reduce a dos reglas y una cola:

> **R-S3-1.** Al crear: primero el objeto en S3, después la fila. Un objeto sin fila es basura barata y determinista; una fila sin objeto es una imagen rota en una invitación publicada.
> **R-S3-2.** Al borrar: primero la fila (dentro de la transacción), después el objeto (fuera, por la cola). Borrar el objeto antes del commit deja rotas las invitaciones si la transacción se revierte.

### 10.1 Subida de un asset de invitación (`POST /editor/invitations/{id}/assets`)

1. Autorización (`HierarchyValidationService.validateInvitationAccess`, `HierarchyValidationService.kt:42-71`) → `403 TPL_FORBIDDEN` si falla.
2. Comprobación de bandera y de documento existente (§6) → `409 TPL_NOT_MIGRATED` / `404 TPL_DOCUMENT_NOT_STARTED`.
3. Lectura del cuerpo con el límite de tamaño (`03 §3.6`). Excedido → `413 TPL_ASSET_TOO_LARGE`, sin tocar S3 ni la base.
4. Validación de tipo: `content_type` declarado **y** verificación de los primeros bytes (número mágico) para WebP/PNG/JPEG/MP3/AAC. Discrepancia → `415 TPL_ASSET_TYPE_UNSUPPORTED`. (El módulo antiguo solo mira el `content-type` declarado, `FileValidationService.kt:21-24`; aquí no basta.)
5. `sha256` de los bytes. `SELECT … FROM tpl_asset WHERE invitation_id = ? AND sha256 = ?` → **si existe, se devuelve el `assetId` existente con `200`** y se termina: la subida es idempotente por contenido (índice `ux_tpl_asset_invitation_sha`, §2 V31).
6. Cuota: `SELECT count(*) FROM tpl_asset WHERE invitation_id = ?` ≥ 200 → `409 TPL_ASSET_QUOTA_EXCEEDED`. Es una cuota **blanda**: dos subidas simultáneas pueden dejar 201; aceptado explícitamente (el coste de un bloqueo por invitación para esto no se justifica).
7. `assetId = "as_" + ULID`; `s3_key = "templates2/invitation/{invitationId}/{sha256}.{ext}"`. **Clave determinista por contenido**: un reintento tras un fallo escribe exactamente el mismo objeto, sin acumular copias.
8. `S3Service.uploadPublicFile(S3Buckets.ASSETS, key, bytes, contentType)` (`S3Service.kt:57-69`). Fallo → `502 TPL_ASSET_STORAGE_UNAVAILABLE` (código nuevo); **no queda ninguna fila**.
9. Transacción: `INSERT INTO tpl_asset (...)`. Si falla, el objeto queda en S3 sin fila → lo recoge `AssetGcJob` en modo barrido (§10.3) pasadas 24 h.
10. Respuesta `201 {assetId, previewUrl, bytes, contentType, width?, height?}`. `previewUrl` se genera con `S3Service.generatePresignedUrl(bucket, key, Duration.ofMinutes(15))` — **pasando la duración explícitamente**: el valor por defecto del método es `Duration.ofDays(7)` (`S3Service.kt:33`), que como "URL firmada de corta duración" es falso.

**Nunca** se persiste una URL en `tpl_document.doc` (ADR-021): el documento solo lleva `assetId`.

### 10.2 Subida de los assets de un paquete de plantilla

Igual, con `s3_key = "templates2/template/{slug}/{version}/{sha256}.{ext}"` y ejecutada **antes** de abrir la transacción del registro (§4 paso 6). Si el registro se rechaza después, los objetos quedan huérfanos y el barrido los retira; ningún estado intermedio es visible por la API porque la versión no llega a existir.

### 10.3 Borrado y recolección

- **Cola** (`tpl_asset_gc`, §2 V37): la alimenta el trigger `trg_tpl_asset_gc` en **cualquier** borrado de fila, incluida la cascada desde `DELETE FROM invitation`.
- **`AssetGcJob`** (`@Scheduled(cron = "0 15 * * * *")`, cada hora): toma hasta 500 filas pendientes, llama a `S3Service.deleteFile(bucket, key)` (`S3Service.kt:48-55`), marca `deleted_at`. Un fallo incrementa `attempts` y guarda `last_error`; a partir de 10 intentos se deja de reintentar y se registra a nivel `ERROR` para intervención manual (nunca se borra la fila de la cola: perder la clave es perder la posibilidad de cumplir un borrado).
- **Barrido de huérfanos** (`@Scheduled(cron = "0 45 4 * * SUN")`, semanal): lista los objetos bajo `templates2/` con más de 24 h y borra los que no tengan fila en `tpl_asset` ni en `tpl_asset_gc` con `deleted_at IS NULL`. Es la compensación de los casos §10.1 paso 9 y §10.2.

### 10.4 URL pública en la composición

`AssetUrlResolver` construye `"{templates2.assets.public-base-url}/{s3_key}"`, con
`templates2.assets.public-base-url` por defecto `https://{bucket}.s3.{aws.region}.amazonaws.com` (region `us-east-2`, `application.yml:13`). Se construye por patrón, **sin llamar a S3**, para que componer no dependa de la disponibilidad de S3 (R6: `compose` es pura y sin E/S).

**No verificable desde el repositorio**: que el bucket `ASSETS` (`S3Buckets.kt:156`) sea realmente de lectura pública. `S3Service.uploadPublicFile` **no** fija ninguna ACL (`S3Service.kt:57-69`): solo construye la URL con `s3Client.utilities().getUrl`. La afirmación de `03 §7` ("bucket `ASSETS`, ya público hoy según `S3Buckets.kt`") **no se sostiene sobre ese archivo**, que solo contiene dos constantes de nombre. Registrado en `preguntas-abiertas.md`; supuesto conservador: la propiedad `templates2.assets.public-base-url` es configurable para poder apuntar a un CDN o a una ruta firmada sin cambiar ni una fila.

### 10.5 Qué queda inconsistente en cada fallo (resumen)

| Fallo | Estado en Postgres | Estado en S3 | Compensación |
|---|---|---|---|
| S3 cae durante `POST /assets` | sin cambios | sin objeto | ninguna necesaria; `502 TPL_ASSET_STORAGE_UNAVAILABLE`, el cliente reintenta |
| `INSERT tpl_asset` falla tras subir | sin fila | objeto huérfano | barrido semanal (§10.3); clave determinista ⇒ el reintento no duplica |
| `DELETE` de asset commitea y S3 cae | fila borrada, fila en `tpl_asset_gc` | objeto vivo | `AssetGcJob` reintenta cada hora |
| Borrado duro de invitación con S3 caído | filas en cascada borradas, claves en cola | objetos vivos | idem |
| Publicación con S3 caído | release insertado, correcto | irrelevante | ninguna: publicar no toca S3; el render devuelve URLs que fallarán mientras S3 esté caído (degradación visible, no corrupción) |
| Registro de plantilla revertido tras subir assets | sin versión, sin filas de asset | objetos huérfanos | barrido semanal |
| Reenvío del mismo `OperationBatch` | segunda inserción de snapshot choca con `ux_tpl_document_snapshot_batch` | — | se responde `200` con el resultado de la revisión ya aplicada |
| Reenvío de la misma subida de asset | ningún cambio | ningún cambio | `200` con el `assetId` existente (§10.1 paso 5) |
| Registro repetido del mismo paquete | ningún cambio | mismo objeto reescrito | `200 {result: 'noop_same_hash'}` (§4 paso 4) |

## 11. Concurrencia y aislamiento

Nivel de aislamiento: **`READ COMMITTED`** (el de PostgreSQL por defecto; no se cambia). Todo lo que hace falta se consigue con dos mecanismos explícitos, no con el nivel de aislamiento:

### 11.1 Dos pestañas editando el mismo documento

`UPDATE tpl_document … WHERE id = ? AND revision = ?`. La pestaña que pierde recibe 0 filas afectadas ⇒ `409 TPL_REVISION_CONFLICT` con `{currentRevision, currentDocument}`. No hay merge automático (`contratos.md` §2: sin colaboración en tiempo real). El `UNIQUE (document_id, revision)` de los snapshots es la segunda barrera: aunque dos transacciones leyeran la misma `revision`, solo una puede insertar el snapshot correspondiente.

### 11.2 Autoguardado contra publicación simultánea

`POST .../release` abre la transacción con `SELECT … FROM tpl_document WHERE invitation_id = ? FOR UPDATE` (`TplDocumentRepository.lockByInvitationId`). Con eso, entre "leo el documento y su `revision`", "compongo", "calculo `content_hash`" y "escribo el release con `document_revision`", ningún `OperationBatch` puede colarse: el lote concurrente espera al commit y luego falla su propio chequeo de `baseRevision` (o pasa, si su base seguía siendo válida). **Sin ese bloqueo**, `tpl_release.document_revision` podría no corresponder al contenido de `composed` — un release que miente sobre qué revisión publicó. Es una corrección de la ronda 1R (objeción **B-11**, severidad MEDIA).

### 11.3 `restore` contra un lote en vuelo

`POST .../document/restore` **exige `baseRevision`** en el cuerpo, igual que `operations` (cambio de contrato de la ronda 1R, ADR-1R-B-11). El borrador solo pedía `{revision}` — la revisión a restaurar —, de modo que un `restore` disparado desde una pestaña con estado viejo pisaba en silencio el trabajo que otra pestaña acababa de guardar. Con `baseRevision`, restaurar es una escritura optimista más y produce `409 TPL_REVISION_CONFLICT` en ese caso.

### 11.4 Registro concurrente de la misma plantilla

`SELECT … FROM tpl_template WHERE slug = ? FOR UPDATE` (§4 paso 3) serializa por slug; el `UNIQUE (template_id, version)` y el `UNIQUE (template_id, package_hash)` son la red final. Dos registros idénticos simultáneos: uno crea, el otro obtiene violación de unicidad, la captura y responde `200 noop_same_hash` tras releer la fila.

### 11.5 Creación perezosa del documento

`INSERT … ON CONFLICT (invitation_id) DO NOTHING` + `SELECT`. Nunca un `ReentrantLock` en memoria (H-44: el lock actual es por JVM y no sobrevive a escalar horizontalmente).

## 12. Evidencia de código real leída para esta revisión

| Archivo:línea | Qué se verificó |
|---|---|
| `src/main/resources/db/migration/` (`ls`) | última migración real `V28__add_whatsapp_sent_column.sql`; `V29`-`V37` libres |
| `src/main/resources/application.yml:30-45` | `ddl-auto: validate`, Flyway `classpath:db/migration`, prefijo/separador/sufijo |
| `src/main/resources/application.yml:13` | `aws.region = us-east-2` (base de la URL pública de §10.4) |
| `build.gradle.kts:6,35,42,51-52,64` | Spring Boot 3.4.1 (⇒ Hibernate 6.6), `data-jpa`, `jackson-module-kotlin`, Flyway 10.21, SDK de S3 |
| `V1__initial_schema.sql:265-282` | `invitation.id bigint`, `is_enabled boolean` (nullable), `customer_id`, `template_id` |
| `V1__initial_schema.sql:60-83` | `customer.id bigint`, `role` con `CHECK` a `USER/ADMIN/MASTER` |
| `V9__add_cascade_delete_to_invitation_relations.sql:1-40` | convención del proyecto: toda hija de `invitation` con `ON DELETE CASCADE` |
| `InvitationEntity.kt:15-17` | `@SQLDelete` (borrado lógico) + `@Filter(enabledFilter)` |
| `InvitationRepository.kt:42-43` | `DELETE FROM invitation` nativo (borrado **duro** real) |
| `InvitationAdminService.kt:382`, `AdminUsersService.kt:426,433` | invocaciones reales del borrado duro de invitación y de cliente |
| `CustomerRepository.kt:85` | `hardDeleteById` de cliente |
| `HierarchyValidationService.kt:42-71` | firma `(requesterId, invitationId): Boolean`, roles `MASTER/ADMIN/USER`, uso de `findByIdEvenIfDisabled` |
| `S3Service.kt:21-69` | `uploadFile`, `generatePresignedUrl` (por defecto **7 días**), `deleteFile`, `uploadPublicFile` (sin ACL) |
| `S3KeyService.kt:130-138` | `generateInvitationAssetKey` incluye un `UUID.randomUUID()` ⇒ **no** determinista |
| `S3Buckets.kt:154-157` | solo dos constantes de nombre; nada sobre visibilidad pública |
| `core/data/MongoDataInitializer.kt:24-32` | `CommandLineRunner` de siembra del catálogo antiguo; `ObjectMapper` propio (H-35) |
| búsqueda `JdbcTypeCode|SqlTypes` en `src/main/kotlin` | 0 resultados ⇒ ninguna entidad usa JSON hoy |

## 13. Lo que no pude determinar

- Tamaño real esperado de `manifest`/`composed` en producción. El `GIN` sobre `manifest` (§2 V30) asume catálogos de decenas, no miles, de plantillas.
- Si el bucket `ASSETS` es realmente de lectura pública (§10.4). Mitigado con una propiedad configurable.
- Si existe un requisito legal de plazo para el borrado efectivo en S3 (§5.3). Objetivo operativo asumido: 24 h.
- El valor real de la secuencia y el contenido de las plantillas `templateId` 11/12/14/16/17 (fuera del repositorio, H-11/H-42) — no afecta a este documento porque los catálogos son independientes (§3).
- Si `com.networknt:json-schema-validator:1.5.4` es la última 1.5.x disponible (§9.1); el requisito duro es draft 2020-12.

## 14. Revisión independiente (1R-backend)

Objeciones encontradas atacando este documento y su corrección **ya aplicada arriba**.

| ID | Sev. | Objeción | Evidencia | Corrección aplicada | Estado |
|---|---|---|---|---|---|
| B-01 | **Alta** | Las FK hacia `invitation` sin `ON DELETE` habrían roto el borrado de invitaciones y de usuarios que la administración ya ejecuta hoy | `InvitationRepository.kt:42-43`, `InvitationAdminService.kt:382`, `AdminUsersService.kt:426,433`; convención de `V9__…sql` | `ON DELETE CASCADE` en `tpl_document`/`tpl_release`/`tpl_asset` hacia `invitation`; `ON DELETE SET NULL` en todas las referencias a `customer`; `ON DELETE RESTRICT` hacia `tpl_template_version` (§2 V31/V32/V34) | cerrada |
| B-02 | **Alta** | Borrar una invitación dejaba los objetos de S3 huérfanos **y sin rastro de su clave**, impidiendo el derecho al olvido | la cascada de B-01 borra `tpl_asset` sin pasar por código de `templates2` | `tpl_asset_gc` + trigger `trg_tpl_asset_gc` (V37, migración nueva) + `AssetGcJob` (§10.3) | cerrada |
| B-03 | **Alta** | La idempotencia de `OperationBatch` por `clientBatchId` era nominal: tras un timeout de red el cliente reenvía con la **misma** `baseRevision` y el lote se aplica dos veces | `03 §3.3` del borrador (razonamiento "el segundo intento falla su chequeo de `baseRevision`") | índice `ux_tpl_document_snapshot_batch` (§2 V33) + respuesta `200` con la revisión ya producida (§10.5, `03 §3.3`) | cerrada |
| B-04 | Media | La auditoría de un registro **rechazado** se perdía con el rollback de la propia transacción que la escribía | `02 §4` del borrador (pasos 1/2/4 insertan y luego lanzan) | `TemplateRegistrationAuditor` con `Propagation.REQUIRES_NEW` (§2 V35, §7.4) | cerrada |
| B-05 | **Alta** | `tpl_document.doc` podía crecer sin cota: `validateValueAgainstSpec` no valida `richText` y el esquema permite ~4·10⁶ caracteres por valor | `esquema/invariants.ts:93-134` (sin rama `richText`); `esquema/blocks.ts:17-18` (40×50×2000) | columna `doc_bytes` + `CHECK ≤ 1 MiB` + `TPL_DOCUMENT_TOO_LARGE` (§2 V32, `03 §5`); contradicción con el esquema registrada para dirimir | cerrada (con contradicción abierta) |
| B-06 | Media | La consulta de purga de snapshots del borrador no es válida: `NOT IN (SELECT … ORDER BY … LIMIT 200)` sin correlación real | §5 del borrador | consulta reescrita con `max(revision) - 200` y borrado por lotes (§5.1) | cerrada |
| B-07 | **Alta** | Deshabilitar una invitación (soft delete) no la retiraba del render público: regresión frente al módulo antiguo | `InvitationEntity.kt:15`; `PublicGuestInfoController.kt:65-75` | comprobación obligatoria de disponibilidad en el render público (§5.2, `03 §3.8`/§7) con `TPL_INVITATION_UNAVAILABLE` | cerrada |
| B-08 | Media | Añadir `uses_templates2 NOT NULL` a `invitation` sin `DEFAULT` habría roto los `INSERT` de Hibernate del módulo antiguo | `application.yml:32` (`validate`), `InvitationEntity.kt:17-173` (no mapea la columna) | `DEFAULT false` obligatorio + acceso exclusivo por `Templates2FlagRepository` con SQL nativo (§2 V36, §7.4) | cerrada |
| B-09 | Media | `03 §3.4` afirmaba reutilizar `S3KeyService` con la clave `invitation/{id}/asset/{assetId}.{ext}`; ese método no existe y el que existe inyecta un `UUID` aleatorio, que rompe la idempotencia por contenido | `S3KeyService.kt:130-138` | `Templates2S3KeyService` propio con claves deterministas por `sha256` (§7.4, §10.1) | cerrada |
| B-10 | Media | El contrato prometía devolver `code` en el `ErrorMessage` existente, que **no tiene** ese campo | `core/error/model/ErrorMessage.kt:251-256` (`timestamp`, `statusCode`, `errorsListed`, `errors`) | DTO propio `TplErrorResponse` con `code` (§7.5, `03 §10`), sin tocar `core/error` | cerrada |
| B-11 | Media | Publicar sin bloquear la fila podía grabar un `document_revision` que no corresponde al `composed` congelado | §11.2 | `SELECT … FOR UPDATE` al abrir la transacción de publicación (§11.2) | cerrada |
| B-12 | Media | `event_kinds TEXT[]` arriesgaba el arranque de **toda** la aplicación por `ddl-auto: validate` | `application.yml:32`; ausencia total de mapeos de array/JSON en el repositorio | `event_kinds JSONB` + GIN `jsonb_path_ops` (§2 V30, §8.3) | cerrada |
| B-13 | Baja | `public_token VARCHAR(29)` era incorrecto (30) y no había `CHECK` de formato | aritmética `"pub_" + ULID(26)` | `VARCHAR(30)` + `CHECK` de patrón (§2 V32) | cerrada |
| B-14 | Baja | Sin `migration_plans` persistidos, `:choose-template` no podía aplicar un `MigrationPlan` sin leer del disco en runtime | `esquema/manifest.ts:95-100`; `03 §3.1` | columna `migration_plans JSONB` (§2 V30) | cerrada |
| B-15 | Baja | `bytes INTEGER` y ausencia de `bucket`, `width`, `height`, `created_by` en `tpl_asset` | `esquema/composed.ts:23-25`, `S3Buckets.kt:154-157` | columnas añadidas (§2 V31) | cerrada |

**Nota de convergencia (verificada al cerrar esta ronda).** Las contradicciones C-01 (`richText` sin validación de longitud), C-03 (`StructureEntry.order`), C-04 (clave de `attic`) y C-05 (`CompositionReport.fallbacks`) que detecté contra `01-dominio-y-esquema.md`/`esquema/*.ts` **fueron resueltas en paralelo por `1R-dominio` durante esta misma ronda**: `esquema/invariants.ts` ya valida la longitud de `richText` contra `spec.constraints.maxLength` (`richTextLength`, caso `"richText"`), `document.ts` usa `AtticKey` (`<slug>@<semver>`) y `composed.ts`/`01 §5` usan `stillDefault`/`invalidValues`. No quedan pendientes de dirimir por este bloque salvo **C-02** (`GET .../document` perezoso según ADR-013 vs. creación exclusiva por `:choose-template`, `03 §3.3`), que es una decisión de contrato de API, no de esquema. Detalle en `handoffs/1R-backend.md` §C.

El tope de 1 MiB por documento (objeción B-05) **se mantiene** aunque C-01 esté cerrada: es defensa en profundidad frente a la acumulación de muchos valores válidos, no solo frente a un valor gigante.
