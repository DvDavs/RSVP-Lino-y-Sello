-- Rollback for V6: Remove audit fields from the customer table

ALTER TABLE customer
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;
