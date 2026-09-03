-- Validation script to verify the integrity of hierarchy migrations
-- This script validates that the necessary structures are in place

-- Validate that the created_by column exists in customer
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customer' AND column_name = 'created_by'
    ) THEN
        RAISE EXCEPTION 'Column created_by is missing from customer table';
    END IF;
END $$;

-- Validate that the created_by column exists in invitation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invitation' AND column_name = 'created_by'
    ) THEN
        RAISE EXCEPTION 'Column created_by is missing from invitation table';
    END IF;
END $$;

-- Validate that the main indexes exist
DO $$
BEGIN
    -- Verify customer created_by index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'customer' AND indexname = 'idx_customer_created_by'
    ) THEN
        RAISE EXCEPTION 'Index idx_customer_created_by is missing';
    END IF;
    
    -- Verify invitation created_by index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'invitation' AND indexname = 'idx_invitation_created_by'
    ) THEN
        RAISE EXCEPTION 'Index idx_invitation_created_by is missing';
    END IF;
END $$;

-- Validate that the foreign key constraint exists in invitation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'invitation' 
        AND constraint_name = 'fk_invitation_created_by'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        RAISE EXCEPTION 'Foreign key constraint fk_invitation_created_by is missing from invitation table';
    END IF;
END $$;

-- Validation completed successfully
-- The hierarchical permissions system structures are correctly implemented
