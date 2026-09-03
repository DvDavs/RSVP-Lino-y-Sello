-- Rollback script for V3__add_customer_indexes_for_hierarchy.sql
-- This script reverts the changes made in migration V3

-- Remove all indexes created for hierarchical optimization
DROP INDEX IF EXISTS idx_customer_created_by;
DROP INDEX IF EXISTS idx_customer_created_by_enabled;
DROP INDEX IF EXISTS idx_customer_role_enabled;
DROP INDEX IF EXISTS idx_customer_hierarchy;
DROP INDEX IF EXISTS idx_customer_phone_enabled;
