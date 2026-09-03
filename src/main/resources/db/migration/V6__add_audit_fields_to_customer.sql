-- V6: Add audit fields (updated_by, deleted_by) to the customer table
-- This migration enhances auditing capabilities by tracking which administrator
-- performs update and soft-delete operations on user records.

ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;
