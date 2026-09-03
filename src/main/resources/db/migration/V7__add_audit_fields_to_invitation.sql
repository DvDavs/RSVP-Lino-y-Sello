-- V7: Add audit fields (updated_by, deleted_by) to the invitation table
-- This migration enhances auditing capabilities by tracking which administrator
-- performs update and soft-delete operations on invitation records.

ALTER TABLE invitation
    ADD COLUMN IF NOT EXISTS updated_by BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_invitation_updated_by ON invitation(updated_by);
CREATE INDEX IF NOT EXISTS idx_invitation_deleted_by ON invitation(deleted_by);

-- Add foreign key constraints to maintain referential integrity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invitation_updated_by'
    ) THEN
        ALTER TABLE invitation ADD CONSTRAINT fk_invitation_updated_by 
            FOREIGN KEY (updated_by) REFERENCES customer(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invitation_deleted_by'
    ) THEN
        ALTER TABLE invitation ADD CONSTRAINT fk_invitation_deleted_by 
            FOREIGN KEY (deleted_by) REFERENCES customer(id);
    END IF;
END $$;
