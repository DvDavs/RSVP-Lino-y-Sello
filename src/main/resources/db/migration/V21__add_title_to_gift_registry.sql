-- Add title field to invitation_gift_registry table for physical gift registry type
-- title: stores the title/name for physical gift registry tables (e.g., "Mesa Física")

ALTER TABLE invitation_gift_registry 
    ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Add comment to document the purpose
COMMENT ON COLUMN invitation_gift_registry.title IS 'Title/name for physical gift registry tables (e.g., "Mesa Física")';

