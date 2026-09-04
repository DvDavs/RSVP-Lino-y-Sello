-- V35__create_tpl_template_registration.sql
-- Fuente: 02-persistencia-y-catalogo.md §2 V35. Auditoría append-only de CADA intento de registro de
-- plantilla, éxito o fallo (mata H-16/H-17 en su forma silenciosa). Una fila 'rejected' solo sobrevive
-- si se escribe FUERA de la transacción que se revierte (Propagation.REQUIRES_NEW en
-- TemplateRegistrationAuditor, objeción B-04) — responsabilidad de la capa de servicio, no de esta migración.
CREATE TABLE tpl_template_registration (
    id                    BIGSERIAL   PRIMARY KEY,
    template_slug         VARCHAR(40) NOT NULL,
    version               VARCHAR(20) NOT NULL,
    requested_hash        VARCHAR(71) NOT NULL,
    result                VARCHAR(20) NOT NULL,
    error_code            VARCHAR(60) NULL,
    detail                JSONB       NULL,
    template_version_id   BIGINT      NULL REFERENCES tpl_template_version(id) ON DELETE SET NULL,
    requested_by          BIGINT      NULL REFERENCES customer(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_tpl_template_registration_hash   CHECK (requested_hash ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT ck_tpl_template_registration_result CHECK (result IN ('created','noop_same_hash','rejected')),
    CONSTRAINT ck_tpl_template_registration_error  CHECK (
        (result = 'rejected' AND error_code IS NOT NULL) OR (result <> 'rejected' AND error_code IS NULL))
);
CREATE INDEX ix_tpl_template_registration_slug ON tpl_template_registration (template_slug, created_at DESC);
