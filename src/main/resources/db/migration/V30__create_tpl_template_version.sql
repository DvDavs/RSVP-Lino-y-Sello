-- V30__create_tpl_template_version.sql
-- Fuente: 02-persistencia-y-catalogo.md §2 V30. Manifiesto/theme/defaults inmutables (ADR-001,
-- ADR-008); event_kinds es JSONB (no TEXT[]) por ADR-1R-B-09: ddl-auto: validate convierte un
-- desajuste de mapeo de array SQL en caída de arranque de TODA la aplicación.
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
    package_hash     VARCHAR(71) NOT NULL,
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
    CONSTRAINT ck_tpl_template_version_hash   CHECK (package_hash ~ '^sha256:[0-9a-f]{64}$'),
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
