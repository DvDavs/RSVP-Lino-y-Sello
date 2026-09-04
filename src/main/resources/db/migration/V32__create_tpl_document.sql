-- V32__create_tpl_document.sql
-- Fuente: 02-persistencia-y-catalogo.md §2 V32. Una fila por invitación; revision es el contador de
-- control optimista (ADR-014); public_token es "pub_" + ULID = 30 caracteres (corrección de la ronda
-- 1R: el borrador decía 29). doc_bytes + su CHECK de 1 MiB son defensa en profundidad (objeción B-05).
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
