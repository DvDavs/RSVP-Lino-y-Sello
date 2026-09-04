-- V31__create_tpl_asset.sql
-- Fuente: 02-persistencia-y-catalogo.md §2 V31. ON DELETE CASCADE hacia invitation (ADR-1R-B-04,
-- objeción B-01): el borrado físico de una invitación existe hoy (InvitationRepository.hardDeleteById)
-- y sin cascada rompería. Un asset pertenece a EXACTAMENTE una plantilla o una invitación (ck_tpl_asset_owner).
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
