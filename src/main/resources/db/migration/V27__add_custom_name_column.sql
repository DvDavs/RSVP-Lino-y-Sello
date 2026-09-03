-- Add new fields to invitation_gift_registry table for frontend compatibility
-- custom_name: stores a custom name for the gift registry, used for display purposes

ALTER TABLE invitation_gift_registry 
    ADD COLUMN IF NOT EXISTS custom_name VARCHAR(255);

-- Add comment to document the purpose
COMMENT ON COLUMN invitation_gift_registry.custom_name IS 'Custom name for the gift registry, used for display purposes';
