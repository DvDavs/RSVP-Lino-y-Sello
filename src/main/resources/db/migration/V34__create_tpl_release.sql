-- V34__create_tpl_release.sql
-- Fuente: 02-persistencia-y-catalogo.md §2 V34. Inmutable salvo is_active/unpublished_at (publicar de
-- nuevo inserta una fila y desactiva la anterior en la misma transacción); ux_tpl_release_active_per_invitation
-- garantiza como máximo un release activo por invitación (11.2, objeción B-11).
CREATE TABLE tpl_release (
    id                     BIGSERIAL   PRIMARY KEY,
    invitation_id          BIGINT      NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
    template_version_id    BIGINT      NOT NULL REFERENCES tpl_template_version(id) ON DELETE RESTRICT,
    document_revision      BIGINT      NOT NULL,
    composed               JSONB       NOT NULL,
    report                 JSONB       NOT NULL,
    business_snapshot      JSONB       NOT NULL,
    content_hash           VARCHAR(71) NOT NULL,
    is_active              BOOLEAN     NOT NULL DEFAULT true,
    published_by           BIGINT      NULL REFERENCES customer(id) ON DELETE SET NULL,
    published_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    unpublished_at         TIMESTAMPTZ NULL,
    CONSTRAINT ck_tpl_release_hash     CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
    CONSTRAINT ck_tpl_release_revision CHECK (document_revision >= 0),
    CONSTRAINT ck_tpl_release_composed CHECK (jsonb_typeof(composed) = 'object'),
    CONSTRAINT ck_tpl_release_unpublished CHECK (is_active = false OR unpublished_at IS NULL)
);
CREATE UNIQUE INDEX ux_tpl_release_active_per_invitation
    ON tpl_release (invitation_id) WHERE is_active;
CREATE INDEX ix_tpl_release_invitation_history ON tpl_release (invitation_id, published_at DESC);
CREATE INDEX ix_tpl_release_hash ON tpl_release (invitation_id, content_hash);
