-- V29__create_tpl_template.sql
-- templates2 (fase 2, bloque 2-1). Fuente: docs/rediseno-plantillas/diseno/02-persistencia-y-catalogo.md
-- §2 V29, contratos.md §5, ADR-009/ADR-012. Primera de las 9 migraciones del módulo nuevo (V29-V37);
-- V38/V39 quedan reservadas para fases futuras (tpl_migration_run, tpl_ai_proposal).
CREATE TABLE tpl_template (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(40)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_tpl_template_slug UNIQUE (slug),
    CONSTRAINT ck_tpl_template_slug_format CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$')
);
