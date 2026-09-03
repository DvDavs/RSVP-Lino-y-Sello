-- Rollback script for V2__add_created_by_to_invitation.sql
-- This script reverts the changes made in migration V2

-- Remove the foreign key constraint
ALTER TABLE invitation DROP CONSTRAINT IF EXISTS fk_invitation_created_by;

-- Remove the created indexes
DROP INDEX IF EXISTS idx_invitation_created_by;
DROP INDEX IF EXISTS idx_invitation_created_by_enabled;

-- Remove the created_by column from the invitation table
ALTER TABLE invitation DROP COLUMN IF EXISTS created_by;
