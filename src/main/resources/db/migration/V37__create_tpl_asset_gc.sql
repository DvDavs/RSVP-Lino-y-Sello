-- V37__create_tpl_asset_gc.sql
-- Fuente: 02-persistencia-y-catalogo.md §2 V37, ADR-1R-B-03 (objeción B-02, severidad ALTA). El
-- borrado de tpl_asset ocurre por tres caminos y solo uno pasa por código de templates2 (el otro es la
-- cascada de DELETE FROM invitation del módulo antiguo, que no se toca): solo un trigger de base de
-- datos captura los tres. Sin esta cola, borrar una invitación deja los objetos de S3 huérfanos para
-- siempre y sin rastro de su clave, lo que impide un derecho al olvido real.
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
