ALTER TABLE invitation ADD COLUMN IF NOT EXISTS created_by BIGINT;

CREATE INDEX IF NOT EXISTS idx_invitation_created_by ON invitation(created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_created_by_enabled ON invitation(created_by, is_enabled);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invitation_created_by'
    ) THEN
        ALTER TABLE invitation ADD CONSTRAINT fk_invitation_created_by 
            FOREIGN KEY (created_by) REFERENCES customer(id);
    END IF;
END $$;