-- Rollback script for created_by changes in V1__insert_admin_master.sql
-- This script reverts the additional field changes added to the customer table

-- WARNING: This rollback will delete user data
-- Execute only in emergency cases and with data backup

-- Remove the columns added in V1 (except MASTER/ADMIN users which are critical)
ALTER TABLE customer DROP COLUMN IF EXISTS created_by;
ALTER TABLE customer DROP COLUMN IF EXISTS phone;
ALTER TABLE customer DROP COLUMN IF EXISTS birthdate;
ALTER TABLE customer DROP COLUMN IF EXISTS address;
ALTER TABLE customer DROP COLUMN IF EXISTS city;
ALTER TABLE customer DROP COLUMN IF EXISTS postal_code;
ALTER TABLE customer DROP COLUMN IF EXISTS state;
ALTER TABLE customer DROP COLUMN IF EXISTS how_know;
