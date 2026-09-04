-- V33__create_tpl_document_snapshot.sql
-- Fuente: 02-persistencia-y-catalogo.md §2 V33. ux_tpl_document_snapshot_batch es la idempotencia
-- REAL del OperationBatch (objeción B-03, severidad ALTA): el reintento con el mismo
-- (document_id, client_batch_id) choca contra el índice único y la capa de aplicación responde
-- 200 con el resultado de la revisión que ese lote produjo, en vez de duplicar la escritura.
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
